export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** Semantic feature name — used for usage-logging keying + model routing. */
  feature: string;
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  provider: 'openai' | 'anthropic' | 'heuristic';
  model: string;
  text: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

export interface EmbedResult {
  provider: 'openai' | 'anthropic' | 'heuristic';
  model: string;
  vector: number[];
  latencyMs: number;
}

/** Fixed embedding dimensionality matching the pgvector column (`vector(1536)`). */
export const EMBEDDING_DIM = 1536;

export interface AiProvider {
  name: 'openai' | 'anthropic' | 'heuristic';
  chat(opts: ChatOptions): Promise<ChatResult>;
  /** Return a 1536-dim embedding vector. */
  embed(text: string): Promise<EmbedResult>;
}
