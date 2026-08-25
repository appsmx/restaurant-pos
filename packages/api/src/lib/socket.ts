import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketServer | null = null;

/**
 * Initialize Socket.IO server attached to the HTTP server
 */
export function initSocket(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
          return callback(null, true);
        }
        if (origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        callback(null, true); // Allow all for now (POS internal)
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join rooms based on role (optional — client can join specific rooms)
    socket.on('join', (room: string) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {
      // Silent disconnect
    });
  });

  return io;
}

/**
 * Get the Socket.IO server instance (for emitting events from services)
 */
export function getIO(): SocketServer | null {
  return io;
}

// ==================== EVENT EMITTERS ====================

/**
 * Emit when a new order is sent to kitchen
 */
export function emitOrderSentToKitchen(orderData: { orderId: string; ticketNumber: number; tableName?: string }) {
  if (!io) return;
  io.emit('order:sent', orderData);
}

/**
 * Emit when a kitchen/bar item status changes (preparing, ready)
 */
export function emitItemStatusChanged(data: { orderId: string; itemId: string; status: string; productName: string }) {
  if (!io) return;
  io.emit('item:statusChanged', data);
}

/**
 * Emit when all items of an order are ready
 */
export function emitOrderReady(data: { orderId: string; ticketNumber: number; tableName?: string }) {
  if (!io) return;
  io.emit('order:ready', data);
}

/**
 * Emit when an order is paid/closed
 */
export function emitOrderClosed(data: { orderId: string; ticketNumber: number; tableId?: string }) {
  if (!io) return;
  io.emit('order:closed', data);
}

/**
 * Emit when a table status changes
 */
export function emitTableStatusChanged(data: { tableId: string; status: string; tableName: string }) {
  if (!io) return;
  io.emit('table:statusChanged', data);
}
