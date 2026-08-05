import type { ApiError, ApiMeta } from './schemas.js';

/**
 * Standard API response envelope. Exactly one of `data` or `error` is set.
 */
export type ApiResponse<T> =
  | { data: T; error?: undefined; meta?: ApiMeta }
  | { data?: undefined; error: ApiError; meta?: ApiMeta };
