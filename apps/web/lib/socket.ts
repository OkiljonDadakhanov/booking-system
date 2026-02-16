import { io, Socket } from 'socket.io-client';
import { useEventStore } from '@/store/event-store';

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return;

  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  socket = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('WebSocket connected:', socket?.id);
  });

  socket.on('ticketUpdate', (data: { eventId: string; remainingTickets: number }) => {
    console.log('Ticket update received:', data);
    useEventStore.getState().updateTicketCount(data.eventId, data.remainingTickets);
  });

  socket.on('connect_error', (err) => {
    console.log('WebSocket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
