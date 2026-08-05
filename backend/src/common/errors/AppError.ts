export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TENANT_MISMATCH';

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  status: number;
  details?: unknown;
  cause?: unknown;
  expose?: boolean;
}

/**
 * Domain error thrown by the application. Global error handler turns these into
 * the standard `{ error: { code, message, details } }` envelope.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(opts: AppErrorOptions) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
    this.expose = opts.expose ?? true;
    if (opts.cause) (this as { cause?: unknown }).cause = opts.cause;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError({ code: 'BAD_REQUEST', status: 400, message, details });
  }
  static validation(message: string, details?: unknown): AppError {
    return new AppError({ code: 'VALIDATION_ERROR', status: 422, message, details });
  }
  static unauthorized(message = 'Not authenticated'): AppError {
    return new AppError({ code: 'UNAUTHORIZED', status: 401, message });
  }
  static forbidden(message = 'Forbidden'): AppError {
    return new AppError({ code: 'FORBIDDEN', status: 403, message });
  }
  static notFound(message = 'Not found'): AppError {
    return new AppError({ code: 'NOT_FOUND', status: 404, message });
  }
  static conflict(message: string, details?: unknown): AppError {
    return new AppError({ code: 'CONFLICT', status: 409, message, details });
  }
  static rateLimited(message = 'Too many requests', details?: unknown): AppError {
    return new AppError({ code: 'RATE_LIMITED', status: 429, message, details });
  }
  static tenantMismatch(message = 'Tenant scope mismatch'): AppError {
    return new AppError({ code: 'TENANT_MISMATCH', status: 403, message });
  }
  static internal(message = 'Internal server error', cause?: unknown): AppError {
    return new AppError({
      code: 'INTERNAL_ERROR',
      status: 500,
      message,
      cause,
      expose: false,
    });
  }
}
