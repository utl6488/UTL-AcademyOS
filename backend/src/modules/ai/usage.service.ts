import { randomUUID } from 'node:crypto';

import type { ChatResult } from './providers/index.js';

import { getPrisma } from '@/db/prisma.js';

// Rough per-1k-token costs in USD cents. Update as pricing changes; a single
// source of truth beats scattering literals through the codebase.
const PRICING_CENTS_PER_1K: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.015, out: 0.06 },
  'claude-haiku-4-5-20251001': { in: 0.08, out: 0.4 },
  'heuristic-v0': { in: 0, out: 0 },
};

/** Compute + record an AiUsage row. Returns `outputId` for later feedback linking. */
export async function recordUsage(
  tenantId: string,
  feature: string,
  result: ChatResult,
): Promise<string> {
  const rate = PRICING_CENTS_PER_1K[result.model] ?? { in: 0, out: 0 };
  const costCents =
    (result.promptTokens / 1000) * rate.in + (result.completionTokens / 1000) * rate.out;
  const outputId = randomUUID();

  await getPrisma().aiUsage.create({
    data: {
      tenantId,
      feature,
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costCents,
      latencyMs: result.latencyMs,
      outputId,
    },
  });
  return outputId;
}
