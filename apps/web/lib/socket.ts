import { io, Socket } from 'socket.io-client';
import { useEventStore } from '@/store/event-store';

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return;

  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  socket = io(url, { withCredentials: true });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('ticketUpdate', (data: { eventId: string; remainingTickets: number }) => {
    useEventStore.getState().updateTicketCount(data.eventId, data.remainingTickets);
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
