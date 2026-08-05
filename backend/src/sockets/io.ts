import type { Server as SocketServer } from 'socket.io';

let ioInstance: SocketServer | null = null;

/** Registered by `createSocketServer` at boot. Optional to keep tests happy. */
export function setIo(io: SocketServer): void {
  ioInstance = io;
}

/** Returns the io singleton, or null if no socket server is running (tests, workers). */
export function getIo(): SocketServer | null {
  return ioInstance;
}

/** Room name helpers — keep these centralised so producers/consumers stay in sync. */
export const rooms = {
  attempt: (attemptId: string) => `attempt:${attemptId}`,
  examConsole: (examId: string) => `exam:${examId}:console`,
  tenant: (tenantId: string) => `t:${tenantId}`,
  user: (userId: string) => `u:${userId}`,
} as const;
