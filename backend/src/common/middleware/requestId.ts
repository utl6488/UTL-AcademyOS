import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';

const HEADER = 'x-request-id';

/** Attaches (or reuses) an x-request-id and echoes it on the response. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.length <= 128 ? incoming : nanoid(12);
  req.id = id;
  res.setHeader(HEADER, id);
  next();
}
