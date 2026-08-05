import type { Response } from 'express';

export interface ApiMeta {
  requestId?: string;
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
}

export function ok<T>(res: Response, data: T, meta?: ApiMeta, status = 200): Response {
  const body: ApiSuccess<T> = { data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T, meta?: ApiMeta): Response {
  return ok(res, data, meta, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).end();
}

export function paginated<T>(
  res: Response,
  data: T[],
  page: number,
  pageSize: number,
  total: number,
): Response {
  return ok(res, data, { page, pageSize, total });
}
