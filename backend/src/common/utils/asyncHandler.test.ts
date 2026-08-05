import { describe, expect, it, vi } from 'vitest';

import { asyncHandler } from './asyncHandler.js';

describe('asyncHandler', () => {
  it('propagates thrown errors to next()', async () => {
    const next = vi.fn();
    const err = new Error('boom');
    const handler = asyncHandler(async () => {
      throw err;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler({} as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('does not call next() on success', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async () => undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler({} as any, {} as any, next);
    expect(next).not.toHaveBeenCalled();
  });
});
