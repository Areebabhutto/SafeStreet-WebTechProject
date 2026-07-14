// =============================================================================
// Socket.io client — connects to the `/realtime` namespace with the current
// JWT access token in the handshake, matching NotificationsGateway's
// handleConnection auth check on the backend.
// =============================================================================
import { io, Socket } from 'socket.io-client';
import { tokenStorage } from './api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

/** Lazily creates (or reuses) a single authenticated socket connection. */
export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  socket = io(`${SOCKET_URL}/realtime`, {
    auth: { token: tokenStorage.getAccessToken() },
    transports: ['websocket'],
    autoConnect: true,
  });

  return socket;
}

/** Call on logout to cleanly tear down the socket before clearing tokens. */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
