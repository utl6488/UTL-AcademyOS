import { createHash } from 'node:crypto';

import {
  EMBEDDING_DIM,
  type AiProvider,
  type ChatOptions,
  type ChatResult,
  type EmbedResult,
} from './types.js';

/**
 * Deterministic no-LLM fallback. Returns a structured placeholder so the app
 * boots + smoke-tests pass without any API keys. Real production traffic
 * should route to openai/claude — this provider only fires when both keys are
 * unset (dev/CI/self-hosted-without-AI).
 */
export const heuristicProvider: AiProvider = {
  name: 'heuristic',
  async chat(opts: ChatOptions): Promise<ChatResult> {
    // We surface a minimally-useful JSON placeholder so the caller's JSON parse
    // succeeds. The individual features layer their own fallback content on top.
    const text = opts.jsonMode ? '{}' : `[heuristic:${opts.feature}] no LLM configured`;
    return {
      provider: 'heuristic',
      model: 'heuristic-v0',
      text,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
    };
  },
  // Deterministic pseudo-embedding: hash the text, spread bytes across the
  // 1536-dim vector, then L2-normalise. Not semantically meaningful — same
  // text always maps to the same vector so upserts + local dev round-trip.
  async embed(text: string): Promise<EmbedResult> {
    const vector = new Array<number>(EMBEDDING_DIM).fill(0);
    let cursor = 0;
    for (let seed = 0; cursor < EMBEDDING_DIM; seed++) {
      const digest = createHash('sha256').update(`${seed}:${text}`).digest();
      for (let i = 0; i < digest.length && cursor < EMBEDDING_DIM; i++) {
        // Map byte [0,255] to [-1, 1].
        vector[cursor++] = (digest[i]! - 127.5) / 127.5;
      }
    }
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
    for (let i = 0; i < vector.length; i++) vector[i] = vector[i]! / norm;
    return { provider: 'heuristic', model: 'heuristic-embed-v0', vector, latencyMs: 0 };
  },
};
