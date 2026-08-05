import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueEmail } from '@/jobs/email.queue.js';

/**
 * Fan out "exam published" notifications to every assigned student.
 * Resolves assignments at send-time so newly-added students still get pinged
 * on a subsequent publish. Class/batch fanout expanded server-side.
 */
export async function notifyExamPublished(examId: string): Promise<void> {
  const prisma = getPrisma();
  const exam = await prisma.exam.findFirst({
    where: { id: examId },
    include: { assignments: true },
  });
  if (!exam) return;

  const studentIds = new Set<string>();
  for (const a of exam.assignments) {
    if (a.studentId) studentIds.add(a.studentId);
  }

  const classIds = exam.assignments.map((a) => a.classId).filter((v): v is string => !!v);
  if (classIds.length) {
    const users = await prisma.user.findMany({
      where: { role: 'STUDENT', classId: { in: classIds } },
      select: { id: true },
    });
    for (const u of users) studentIds.add(u.id);
  }

  const batchIds = exam.assignments.map((a) => a.batchId).filter((v): v is string => !!v);
  if (batchIds.length) {
    const members = await prisma.batchMember.findMany({
      where: { batchId: { in: batchIds } },
      select: { userId: true },
    });
    for (const m of members) studentIds.add(m.userId);
  }

  if (!studentIds.size) {
    logger.info({ examId }, 'exam-notify: no students to notify');
    return;
  }

  const recipients = await prisma.user.findMany({
    where: { id: { in: Array.from(studentIds) } },
    select: { email: true, name: true },
  });

  const startLine = exam.startAt
    ? `\nScheduled: ${exam.startAt.toISOString()}`
    : '\nAvailable within the scheduled window.';

  for (const r of recipients) {
    await enqueueEmail({
      to: r.email,
      subject: `New exam: ${exam.title}`,
      text:
        `Hi ${r.name},\n\nA new exam has been assigned to you: ${exam.title}.` +
        startLine +
        `\nDuration: ${exam.durationMinutes} minutes.\n\n— Your institute`,
    });
  }
  logger.info({ examId, count: recipients.length }, 'exam-notify: emails enqueued');
}
