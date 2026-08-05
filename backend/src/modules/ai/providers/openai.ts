import {
  EMBEDDING_DIM,
  type AiProvider,
  type ChatOptions,
  type ChatResult,
  type EmbedResult,
} from './types.js';

import { env } from '@/config/env.js';

/**
 * OpenAI chat provider using bare `fetch` — no SDK bloat. Only invoked when
 * `OPENAI_API_KEY` is present; otherwise `pickProvider()` falls back to the
 * heuristic provider so dev + CI work without keys.
 */
export const openaiProvider: AiProvider = {
  name: 'openai',
  async chat(opts: ChatOptions): Promise<ChatResult> {
    const started = Date.now();
    const model = 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      provider: 'openai',
      model,
      text: json.choices[0]?.message.content ?? '',
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  },
  async embed(text: string): Promise<EmbedResult> {
    const started = Date.now();
    const model = 'text-embedding-3-small';
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    const vector = json.data[0]?.embedding ?? [];
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(`Unexpected embedding dim ${vector.length}, want ${EMBEDDING_DIM}`);
    }
    return { provider: 'openai', model, vector, latencyMs: Date.now() - started };
  },
};
