import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Get or create the singleton Socket.IO connection
 */
export function getSocket(): Socket {
  if (!socket) {
    const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
    // Socket.IO connects to the server root, not /api
    const baseUrl = apiUrl.replace('/api', '');

    socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });
  }

  return socket;
}

/**
 * Disconnect and cleanup the socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
