// src/core/services/socket.js
// Simple Socket.IO client wrapper for notifications
import { io } from 'socket.io-client';

let socket = null;

export function connectNotificationSocket(userId) {
  if (socket) return socket;
  const socketUrl = process.env.VUE_APP_API_URL;
  socket = io(`${socketUrl}/notifications`, {
    path: "/socket.io", // adjust if backend uses a different path
    query: { userId },
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
  });

  return socket;
}

export function getNotificationSocket() {
  return socket;
}

export function disconnectNotificationSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
