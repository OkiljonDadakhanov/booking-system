import { create } from 'zustand';
import api from '@/lib/api';
import { Event } from './event-store';

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  event: Event;
}

interface BookingState {
  bookings: Booking[];
  loading: boolean;
  fetchBookings: () => Promise<void>;
  createBooking: (eventId: string) => Promise<Booking>;
  cancelBooking: (bookingId: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set) => ({
  bookings: [],
  loading: false,

  fetchBookings: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/bookings');
      set({ bookings: res.data });
    } finally {
      set({ loading: false });
    }
  },

  createBooking: async (eventId) => {
    const res = await api.post('/book', { eventId });
    const booking = res.data;
    set((state) => ({ bookings: [booking, ...state.bookings] }));
    return booking;
  },

  cancelBooking: async (bookingId) => {
    await api.delete(`/bookings/${bookingId}`);
    set((state) => ({
      bookings: state.bookings.filter((b) => b.id !== bookingId),
    }));
  },
}));
