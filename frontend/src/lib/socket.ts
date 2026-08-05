import { io, Socket } from "socket.io-client";
import { env } from "./env";
import { getAccessToken } from "./api-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(env.VITE_SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => {
        cb({ token: getAccessToken() });
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      transports: ["websocket", "polling"],
    });

    // Debug logging in development
    if (import.meta.env.DEV) {
      socket.on("connect", () => console.log("[Socket] Connected:", socket?.id));
      socket.on("disconnect", (reason) => console.log("[Socket] Disconnected:", reason));
      socket.on("connect_error", (err) => console.warn("[Socket] Connection error:", err.message));
      socket.on("reconnect_attempt", (attempt) =>
        console.log("[Socket] Reconnect attempt:", attempt)
      );
      socket.on("reconnect", (attempt) =>
        console.log("[Socket] Reconnected after", attempt, "attempts")
      );
    }
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}

/**
 * Join a socket room (e.g., for live exam console, notifications)
 */
export function joinRoom(room: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("room:join", { room });
  }
}

/**
 * Leave a socket room
 */
export function leaveRoom(room: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("room:leave", { room });
  }
}

/**
 * Subscribe to a typed socket event with automatic cleanup
 */
export function onSocketEvent<T = unknown>(event: string, handler: (data: T) => void): () => void {
  const s = getSocket();
  s.on(event, handler);
  return () => {
    s.off(event, handler);
  };
}

/**
 * Emit a typed socket event
 */
export function emitSocketEvent<T = unknown>(event: string, data: T) {
  const s = getSocket();
  if (s.connected) {
    s.emit(event, data);
  }
}

// Common socket event types
export interface SocketNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface SocketTimeSync {
  serverTime: number;
}

export interface SocketProctoringWarning {
  attemptId: string;
  remaining: number;
  reason: string;
}
