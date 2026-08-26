import { io } from 'socket.io-client';
import { getToken } from './client.js';

let socket = null;

/** Connects (once) with the current JWT. Returns null when signed out. */
export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected || socket?.connecting) return socket;

  socket = io(import.meta.env.VITE_API_URL ?? '/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}

/** Subscribes to an event and returns an unsubscribe function. */
export function onSocketEvent(event, handler) {
  const active = connectSocket();
  if (!active) return () => {};
  active.on(event, handler);
  return () => active.off(event, handler);
}
