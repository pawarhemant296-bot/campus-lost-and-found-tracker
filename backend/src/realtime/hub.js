/**
 * Realtime hub (advanced feature): Socket.IO delivers notifications and chat
 * messages instantly. REST endpoints remain the single source of truth - the
 * hub only pushes what was already persisted, so polling clients stay correct.
 */
import { Server } from 'socket.io';
import config from '../config/env.js';
import { verifyToken } from '../middleware/auth.js';

let io = null;

const userRoom = (userId) => `user:${userId}`;
const itemRoom = (itemId) => `item:${itemId}`;

export function initRealtime(httpServer, logger = console) {
  io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication token required'));
    try {
      const payload = verifyToken(String(token));
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid session token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.userId));
    logger.log(`[realtime] user ${socket.data.userId} connected (${socket.id})`);

    // Join the chat thread for one item so typing indicators stay scoped.
    socket.on('thread:join', (itemId) => {
      if (Number.isFinite(Number(itemId))) socket.join(itemRoom(Number(itemId)));
    });
    socket.on('thread:leave', (itemId) => {
      socket.leave(itemRoom(Number(itemId)));
    });
    socket.on('thread:typing', ({ itemId, to }) => {
      if (to) io.to(userRoom(to)).emit('thread:typing', { itemId, from: socket.data.userId });
    });

    socket.on('disconnect', () => {
      logger.log(`[realtime] user ${socket.data.userId} disconnected`);
    });
  });

  return io;
}

export function emitToUser(userId, event, payload) {
  if (!io || userId == null) return;
  io.to(userRoom(userId)).emit(event, payload);
}

export function emitToItem(itemId, event, payload) {
  if (!io || itemId == null) return;
  io.to(itemRoom(itemId)).emit(event, payload);
}

export function connectedUserCount() {
  return io ? io.engine.clientsCount : 0;
}

export function isRealtimeReady() {
  return Boolean(io);
}
