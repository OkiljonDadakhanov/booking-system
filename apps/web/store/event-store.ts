import { create } from 'zustand';
import api from '@/lib/api';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  totalTickets: number;
  remainingTickets: number;
  price: number;
  createdAt: string;
  updatedAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EventState {
  events: Event[];
  meta: Meta | null;
  loading: boolean;
  fetchEvents: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => Promise<void>;
  updateTicketCount: (eventId: string, remainingTickets: number) => void;
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  meta: null,
  loading: false,

  fetchEvents: async (params) => {
    set({ loading: true });
    try {
      const res = await api.get('/events', { params });
      set({ events: res.data.data, meta: res.data.meta });
    } finally {
      set({ loading: false });
    }
  },

  updateTicketCount: (eventId, remainingTickets) => {
    set((state) => ({
      events: state.events.map((event) =>
        event.id === eventId ? { ...event, remainingTickets } : event,
      ),
    }));
  },
}));
