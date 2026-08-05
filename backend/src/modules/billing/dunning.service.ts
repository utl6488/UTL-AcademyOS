import { logger } from '@/common/logger.js';
import { getPrisma } from '@/db/prisma.js';
import { enqueueEmail } from '@/jobs/email.queue.js';

const MAX_ATTEMPTS = 3;
const GRACE_DAYS = 7;

/**
 * Attempt to charge a PAST_DUE subscription against the configured provider.
 * Real Stripe/Razorpay integration lands with API keys — until then this stub
 * always fails, which is the "safe" default (better to escalate a stuck
 * subscription than silently mark it paid).
 */
async function tryChargeStub(_subscriptionId: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'provider not configured' };
}

/**
 * Scan every PAST_DUE subscription and advance its dunning state:
 *   - attempts < 3           → retry payment
 *   - attempts >= 3, in grace → email owner, wait
 *   - past grace             → CANCEL + downgrade to Free
 *
 * Idempotent per day: `lastDunningRunAt` guards against double-processing.
 */
export async function runDunningPass(): Promise<{ processed: number; downgraded: number }> {
  const prisma = getPrisma();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  const subs = await prisma.subscription.findMany({
    where: {
      status: 'PAST_DUE',
      OR: [{ lastDunningRunAt: null }, { lastDunningRunAt: { lt: oneDayAgo } }],
    },
    include: {
      plan: true,
      tenant: { include: { users: { where: { role: 'INSTITUTE_OWNER' }, take: 1 } } },
    },
  });

  let downgraded = 0;

  for (const sub of subs) {
    const attempts = sub.dunningAttempts;
    const startedAt = sub.dunningStartedAt ?? now;

    if (attempts < MAX_ATTEMPTS) {
      const charge = await tryChargeStub(sub.id);
      if (charge.ok) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'ACTIVE',
            dunningAttempts: 0,
            dunningStartedAt: null,
            lastDunningRunAt: now,
          },
        });
        continue;
      }
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          dunningAttempts: attempts + 1,
          dunningStartedAt: sub.dunningStartedAt ?? now,
          lastDunningRunAt: now,
        },
      });
      logger.info(
        { tenantId: sub.tenantId, attempts: attempts + 1, err: charge.error },
        'dunning: charge retry failed',
      );
      continue;
    }

    // At or past MAX_ATTEMPTS. Check grace window.
    const graceEnd = new Date(startedAt.getTime() + GRACE_DAYS * 24 * 3600 * 1000);
    const owner = sub.tenant.users[0];

    if (now < graceEnd) {
      // Still in grace — nudge the owner once per day.
      if (owner?.email) {
        await enqueueEmail({
          to: owner.email,
          subject: 'Action required: update your billing details',
          text: `Hi ${owner.name || ''},\n\nYour ${sub.plan.name} subscription for ${sub.tenant.name} could not be renewed after ${attempts} attempts.\nYou have until ${graceEnd.toISOString().slice(0, 10)} to update your payment method before we downgrade you to the Free plan.\n\n— UTL ExamPro`,
        }).catch((err: unknown) => logger.warn({ err }, 'dunning: email enqueue failed'));
      }
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { lastDunningRunAt: now },
      });
      continue;
    }

    // Past grace — downgrade to Free.
    const freePlan = await prisma.plan.findFirst({
      where: { tier: 'FREE', interval: 'MONTHLY' },
    });
    if (!freePlan) {
      logger.error({ tenantId: sub.tenantId }, 'dunning: cannot downgrade — no Free plan seeded');
      continue;
    }
    const nextEnd = new Date(now);
    nextEnd.setMonth(nextEnd.getMonth() + 1);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELED',
        planId: freePlan.id,
        currentPeriodStart: now,
        currentPeriodEnd: nextEnd,
        cancelAtPeriodEnd: false,
        dunningAttempts: 0,
        dunningStartedAt: null,
        lastDunningRunAt: now,
      },
    });
    if (owner?.email) {
      await enqueueEmail({
        to: owner.email,
        subject: 'Your subscription has been downgraded to Free',
        text: `Hi ${owner.name || ''},\n\nAfter ${attempts} failed payment attempts we've moved ${sub.tenant.name} to the Free plan. Upgrade any time from the billing dashboard.\n\n— UTL ExamPro`,
      }).catch((err: unknown) => logger.warn({ err }, 'dunning: downgrade email enqueue failed'));
    }
    downgraded++;
    logger.info({ tenantId: sub.tenantId }, 'dunning: downgraded to Free');
  }

  return { processed: subs.length, downgraded };
}
