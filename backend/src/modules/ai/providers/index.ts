import { claudeProvider } from './claude.js';
import { heuristicProvider } from './heuristic.js';
import { openaiProvider } from './openai.js';
import type { AiProvider } from './types.js';

import { env } from '@/config/env.js';

// Prefer Claude when both keys are present (matches the platform default —
// Anthropic is our primary provider; OpenAI is the fallback).
export function pickProvider(): AiProvider {
  if (env.ANTHROPIC_API_KEY) return claudeProvider;
  if (env.OPENAI_API_KEY) return openaiProvider;
  return heuristicProvider;
}

export { claudeProvider, heuristicProvider, openaiProvider };
export type { AiProvider, ChatMessage, ChatOptions, ChatResult } from './types.js';
