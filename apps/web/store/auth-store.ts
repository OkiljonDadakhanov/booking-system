import { create } from 'zustand';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
  loading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  initialized: false,
  loading: false,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  clearAuth: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      set({
        user: res.data.user,
        accessToken: res.data.accessToken,
        isAuthenticated: true,
        initialized: true,
      });
    } finally {
      set({ loading: false });
    }
  },

  register: async (name, email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/register', { name, email, password });
      set({
        user: res.data.user,
        accessToken: res.data.accessToken,
        isAuthenticated: true,
        initialized: true,
      });
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false });
    }
  },

  refresh: async () => {
    try {
      const res = await api.post('/auth/refresh');
      set({
        user: res.data.user,
        accessToken: res.data.accessToken,
        isAuthenticated: true,
        initialized: true,
      });
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false, initialized: true });
    }
  },
}));

// Export getState for use in api interceptors
export const getState = () => useAuthStore.getState();
