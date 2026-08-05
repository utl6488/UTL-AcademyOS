import type { Server as HttpServer } from 'node:http';

import { createAdapter } from '@socket.io/redis-adapter';
import { Server, type Socket } from 'socket.io';

import { logger } from '@/common/logger.js';
import { Permission, permissionsFor } from '@/config/constants.js';
import { env } from '@/config/env.js';
import { getPrisma } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import { verifyAccessToken } from '@/modules/auth/token.service.js';
import { rooms, setIo } from '@/sockets/io.js';

export function createSocketServer(http: HttpServer): Server {
  const io = new Server(http, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    serveClient: false,
    transports: ['websocket'],
  });

  // Redis adapter for horizontal scale (Phase 6 exam runtime relies on this).
  const pubClient = getRedis();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string } | undefined)?.token ??
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error('Missing token'));
      const claims = verifyAccessToken(token);
      socket.data.auth = {
        userId: claims.sub,
        tenantId: claims.tid,
        role: claims.role,
        sessionId: claims.sid,
      };
      // Bind the socket to its tenant + user rooms up-front.
      socket.join([rooms.tenant(claims.tid), rooms.user(claims.sub)]);
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('Socket auth failed'));
    }
  });

  io.on('connection', (socket) => {
    const auth = socket.data.auth as {
      userId: string;
      tenantId: string;
      role:
        'SUPER_ADMIN' | 'INSTITUTE_OWNER' | 'ADMIN' | 'TEACHER' | 'EXAM_COORDINATOR' | 'STUDENT';
    };
    logger.debug({ sid: socket.id, auth }, 'socket connected');

    // Student joins their own attempt room; teachers/admins can observe.
    socket.on(
      'attempt:join',
      async (payload: { attemptId?: string }, ack?: (r: unknown) => void) => {
        const attemptId = payload?.attemptId;
        if (!attemptId) return ack?.({ ok: false, error: 'attemptId required' });
        const attempt = await getPrisma()
          .examAttempt.findFirst({
            where: { id: attemptId },
            select: { id: true, studentId: true, tenantId: true },
          })
          .catch(() => null);
        if (!attempt || attempt.tenantId !== auth.tenantId) {
          return ack?.({ ok: false, error: 'not found' });
        }
        const perms = permissionsFor(auth.role);
        const isOwner = attempt.studentId === auth.userId;
        const isObserver = perms.has(Permission.EXAM_READ) || perms.has(Permission.RESULT_READ_ALL);
        if (!isOwner && !isObserver) return ack?.({ ok: false, error: 'forbidden' });
        await socket.join(rooms.attempt(attemptId));
        ack?.({ ok: true });
      },
    );

    // Teacher joins live-console for a given exam.
    socket.on(
      'exam:console:join',
      async (payload: { examId?: string }, ack?: (r: unknown) => void) => {
        const examId = payload?.examId;
        if (!examId) return ack?.({ ok: false, error: 'examId required' });
        const perms = permissionsFor(auth.role);
        if (!perms.has(Permission.EXAM_READ)) return ack?.({ ok: false, error: 'forbidden' });
        const exam = await getPrisma()
          .exam.findFirst({ where: { id: examId }, select: { id: true, tenantId: true } })
          .catch(() => null);
        if (!exam || exam.tenantId !== auth.tenantId) {
          return ack?.({ ok: false, error: 'not found' });
        }
        await socket.join(rooms.examConsole(examId));
        ack?.({ ok: true });
      },
    );

    // Best-effort presence — no persistence. Teachers rely on this to render
    // live "connected" dots without hitting the DB.
    socket.on('attempt:heartbeat', (payload: { attemptId?: string }) => {
      const attemptId = payload?.attemptId;
      if (!attemptId) return;
      socket.to(rooms.attempt(attemptId)).emit('attempt:heartbeat', {
        attemptId,
        userId: auth.userId,
        at: Date.now(),
      });
    });

    socket.on('disconnect', (reason) =>
      logger.debug({ sid: socket.id, reason }, 'socket disconnected'),
    );
  });

  setIo(io);
  return io;
}
