import { describe, expect, it } from 'vitest';

import { AppError } from './AppError.js';

describe('AppError', () => {
  it('badRequest is 400', () => {
    const e = AppError.badRequest('nope');
    expect(e.status).toBe(400);
    expect(e.code).toBe('BAD_REQUEST');
  });

  it('unauthorized is 401', () => {
    expect(AppError.unauthorized().status).toBe(401);
  });

  it('internal hides message from clients', () => {
    const e = AppError.internal('secret cause');
    expect(e.status).toBe(500);
    expect(e.expose).toBe(false);
  });

  it('conflict carries details', () => {
    const e = AppError.conflict('dup', { field: 'email' });
    expect(e.details).toEqual({ field: 'email' });
  });
});
