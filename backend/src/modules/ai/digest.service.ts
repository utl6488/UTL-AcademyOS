import { getPrompt } from './prompts/registry.js';
import { pickProvider } from './providers/index.js';
import { recordUsage } from './usage.service.js';

import { logger } from '@/common/logger.js';
import { getPrisma, withTenant } from '@/db/prisma.js';
import { enqueueEmail } from '@/jobs/email.queue.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEAK_TOPIC_THRESHOLD_PCT = 60;

export interface WeeklyMetrics {
  tenantId: string;
  tenantName: string;
  examsConducted: number;
  attemptsSubmitted: number;
  activeStudents: number;
  averageScorePct: number;
  weakTopics: Array<{ topic: string; averageAccuracy: number }>;
  topExam: { title: string; averageScore: number } | null;
}

interface DigestNarrative {
  subject: string;
  opening: string;
  wins: string[];
  risks: string[];
  focusNextWeek: string[];
}

/**
 * Runs the weekly digest pass across all active tenants. For each tenant we
 * aggregate the last 7 days, compose a short narrative (LLM or heuristic),
 * and enqueue an email to every INSTITUTE_OWNER of that tenant.
 * Returns per-tenant status so the worker can log/report.
 */
export async function runWeeklyDigestPass(): Promise<{
  tenants: number;
  emailsQueued: number;
  errors: number;
}> {
  const prisma = getPrisma();
  // Scope-bypass is safe here — this is a platform-level cross-tenant scan.
  const tenants = await withTenant({ tenantId: '__system__', bypass: true }, () =>
    prisma.tenant.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true } }),
  );

  let emailsQueued = 0;
  let errors = 0;

  for (const t of tenants) {
    try {
      const { metrics, owners } = await withTenant({ tenantId: t.id }, async () => {
        const metrics = await computeWeeklyMetrics(t.id, t.name);
        const owners = await prisma.user.findMany({
          where: { role: 'INSTITUTE_OWNER', status: 'ACTIVE', emailVerifiedAt: { not: null } },
          select: { email: true, name: true },
        });
        return { metrics, owners };
      });
      if (!owners.length) continue;

      const narrative = await withTenant({ tenantId: t.id }, () => composeNarrative(t.id, metrics));
      for (const o of owners) {
        await enqueueEmail({
          to: o.email,
          subject: narrative.subject,
          text: toPlainText(o.name, narrative, metrics),
          html: toHtml(o.name, narrative, metrics),
        });
        emailsQueued += 1;
      }
    } catch (err) {
      errors += 1;
      logger.error({ err, tenantId: t.id }, 'weekly digest: tenant failed');
    }
  }

  return { tenants: tenants.length, emailsQueued, errors };
}

async function computeWeeklyMetrics(tenantId: string, tenantName: string): Promise<WeeklyMetrics> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - WEEK_MS);

  const [examsConducted, submittedAttempts, activeStudentIds, weekResults] = await Promise.all([
    prisma.exam.count({
      where: { OR: [{ publishedAt: { gte: since } }, { updatedAt: { gte: since } }] },
    }),
    prisma.examAttempt.count({
      where: {
        submittedAt: { gte: since },
        status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
      },
    }),
    prisma.examAttempt.findMany({
      where: { createdAt: { gte: since }, status: { not: 'NOT_STARTED' } },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    prisma.result.findMany({
      where: { createdAt: { gte: since } },
      include: { exam: { select: { title: true, totalMarks: true } } },
    }),
  ]);

  const scorePcts = weekResults
    .map((r) => (r.exam.totalMarks > 0 ? (r.score / r.exam.totalMarks) * 100 : 0))
    .filter((v) => Number.isFinite(v));
  const averageScorePct = scorePcts.length
    ? Math.round((scorePcts.reduce((s, v) => s + v, 0) / scorePcts.length) * 10) / 10
    : 0;

  // Best-performing exam this week (by avg score %).
  const perExam = new Map<string, { title: string; sum: number; count: number }>();
  for (const r of weekResults) {
    const key = r.examId;
    const bucket = perExam.get(key) ?? { title: r.exam.title, sum: 0, count: 0 };
    bucket.sum += r.exam.totalMarks > 0 ? (r.score / r.exam.totalMarks) * 100 : 0;
    bucket.count += 1;
    perExam.set(key, bucket);
  }
  const topExam =
    Array.from(perExam.values())
      .filter((e) => e.count > 0)
      .map((e) => ({ title: e.title, averageScore: Math.round((e.sum / e.count) * 10) / 10 }))
      .sort((a, b) => b.averageScore - a.averageScore)[0] ?? null;

  const answers = await prisma.attemptAnswer.findMany({
    where: { updatedAt: { gte: since }, scoredMarks: { not: null } },
    include: { question: { select: { topicId: true, topic: { select: { name: true } } } } },
  });
  const topicAgg = new Map<string, { topic: string; correct: number; total: number }>();
  for (const a of answers) {
    if (!a.question.topicId) continue;
    const b = topicAgg.get(a.question.topicId) ?? {
      topic: a.question.topic?.name ?? '',
      correct: 0,
      total: 0,
    };
    b.total += 1;
    if ((a.scoredMarks ?? 0) > 0) b.correct += 1;
    topicAgg.set(a.question.topicId, b);
  }
  const weakTopics = Array.from(topicAgg.values())
    .map((v) => ({
      topic: v.topic,
      averageAccuracy: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
    }))
    .filter((t) => t.averageAccuracy < WEAK_TOPIC_THRESHOLD_PCT)
    .sort((a, b) => a.averageAccuracy - b.averageAccuracy)
    .slice(0, 5);

  return {
    tenantId,
    tenantName,
    examsConducted,
    attemptsSubmitted: submittedAttempts,
    activeStudents: activeStudentIds.length,
    averageScorePct,
    weakTopics,
    topExam,
  };
}

async function composeNarrative(
  tenantId: string,
  metrics: WeeklyMetrics,
): Promise<DigestNarrative> {
  const provider = pickProvider();
  const prompt = getPrompt('institute.weeklyDigest');

  try {
    const result = await provider.chat({
      feature: 'institute.weeklyDigest',
      jsonMode: true,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: JSON.stringify(metrics) },
      ],
    });
    await recordUsage(tenantId, 'institute.weeklyDigest', result);

    const parsed = safeJson<Partial<DigestNarrative>>(result.text);
    const fallback = heuristicNarrative(metrics);
    return {
      subject: parsed.subject || fallback.subject,
      opening: parsed.opening || fallback.opening,
      wins: Array.isArray(parsed.wins) && parsed.wins.length ? parsed.wins : fallback.wins,
      risks: Array.isArray(parsed.risks) && parsed.risks.length ? parsed.risks : fallback.risks,
      focusNextWeek:
        Array.isArray(parsed.focusNextWeek) && parsed.focusNextWeek.length
          ? parsed.focusNextWeek
          : fallback.focusNextWeek,
    };
  } catch (err) {
    logger.warn({ err, tenantId }, 'weeklyDigest: provider failed, using heuristic');
    return heuristicNarrative(metrics);
  }
}

function safeJson<T>(text: string): T {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return {} as T;
  }
}

function heuristicNarrative(m: WeeklyMetrics): DigestNarrative {
  const wins: string[] = [];
  const risks: string[] = [];
  const focusNextWeek: string[] = [];

  wins.push(`${m.examsConducted} exam${m.examsConducted === 1 ? '' : 's'} ran this week.`);
  wins.push(
    `${m.attemptsSubmitted} attempt${m.attemptsSubmitted === 1 ? '' : 's'} submitted by ${m.activeStudents} active student${m.activeStudents === 1 ? '' : 's'}.`,
  );
  if (m.topExam) {
    wins.push(`Best-performing exam: "${m.topExam.title}" — avg ${m.topExam.averageScore}%.`);
  }

  if (m.averageScorePct > 0 && m.averageScorePct < 50) {
    risks.push(`Average score is ${m.averageScorePct}% — below the healthy 50% bar.`);
  }
  if (m.weakTopics.length) {
    risks.push(
      `Weakest topics: ${m.weakTopics
        .slice(0, 3)
        .map((t) => `${t.topic} (${t.averageAccuracy}%)`)
        .join(', ')}.`,
    );
    focusNextWeek.push(
      `Assign remedial practice on: ${m.weakTopics
        .slice(0, 3)
        .map((t) => t.topic)
        .join(', ')}.`,
    );
  } else {
    focusNextWeek.push('No weak-topic hotspots this week — keep the momentum going.');
  }
  if (m.examsConducted === 0) {
    risks.push('No exams ran this week — check upcoming schedule for gaps.');
    focusNextWeek.push('Schedule at least one exam next week to keep the assessment cadence.');
  }
  focusNextWeek.push('Review teacher dashboards for follow-up on flagged students.');

  const opening =
    m.attemptsSubmitted > 0
      ? `${m.tenantName}: ${m.attemptsSubmitted} attempts across ${m.examsConducted} exam${m.examsConducted === 1 ? '' : 's'} — avg ${m.averageScorePct}%.`
      : `${m.tenantName}: quiet week — no attempts submitted.`;

  return {
    subject: `${m.tenantName} — weekly insights (${m.attemptsSubmitted} attempts, avg ${m.averageScorePct}%)`,
    opening,
    wins,
    risks,
    focusNextWeek,
  };
}

function toPlainText(name: string, n: DigestNarrative, m: WeeklyMetrics): string {
  const lines: string[] = [];
  lines.push(`Hi ${name},`);
  lines.push('');
  lines.push(n.opening);
  lines.push('');
  lines.push('Wins:');
  n.wins.forEach((w) => lines.push(`  - ${w}`));
  lines.push('');
  lines.push('Risks:');
  n.risks.forEach((r) => lines.push(`  - ${r}`));
  lines.push('');
  lines.push('Focus for next week:');
  n.focusNextWeek.forEach((f) => lines.push(`  - ${f}`));
  lines.push('');
  lines.push(
    `Metrics: ${m.examsConducted} exams · ${m.attemptsSubmitted} attempts · ${m.activeStudents} active students · avg ${m.averageScorePct}%.`,
  );
  lines.push('');
  lines.push('— UTL-AcademyOS');
  return lines.join('\n');
}

function toHtml(name: string, n: DigestNarrative, m: WeeklyMetrics): string {
  const bullets = (arr: string[]) =>
    `<ul>${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  return [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>${escapeHtml(n.opening)}</p>`,
    `<h3>Wins</h3>${bullets(n.wins)}`,
    `<h3>Risks</h3>${bullets(n.risks)}`,
    `<h3>Focus for next week</h3>${bullets(n.focusNextWeek)}`,
    `<p style="color:#666;font-size:12px">Metrics: ${m.examsConducted} exams · ${m.attemptsSubmitted} attempts · ${m.activeStudents} active students · avg ${m.averageScorePct}%.</p>`,
    `<p style="color:#999;font-size:12px">— UTL-AcademyOS</p>`,
  ].join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
