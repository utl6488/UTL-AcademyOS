import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async controller so unhandled rejections propagate to Express'
 * error middleware instead of hanging the request.
 */
export const asyncHandler =
  <Req extends Request = Request, Res extends Response = Response>(
    fn: (req: Req, res: Res, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as Req, res as Res, next)).catch(next);
  };
