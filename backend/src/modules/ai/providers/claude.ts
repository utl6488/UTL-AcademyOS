import { heuristicProvider } from './heuristic.js';
import { openaiProvider } from './openai.js';
import type { AiProvider, ChatOptions, ChatResult, EmbedResult } from './types.js';

import { env } from '@/config/env.js';

/**
 * Anthropic Messages API using bare `fetch`. `system` messages are folded into
 * a single top-level `system` param per Anthropic's API shape.
 */
export const claudeProvider: AiProvider = {
  name: 'anthropic',
  async chat(opts: ChatOptions): Promise<ChatResult> {
    const started = Date.now();
    const model = 'claude-haiku-4-5-20251001';

    const system = opts.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const rest = opts.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: system || undefined,
        messages: rest,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = json.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return {
      provider: 'anthropic',
      model,
      text,
      promptTokens: json.usage?.input_tokens ?? 0,
      completionTokens: json.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  },
  // Anthropic has no embeddings endpoint — delegate to OpenAI when configured,
  // otherwise the deterministic heuristic (keeps dev + CI unblocked).
  async embed(text: string): Promise<EmbedResult> {
    if (env.OPENAI_API_KEY) return openaiProvider.embed(text);
    return heuristicProvider.embed(text);
  },
};
