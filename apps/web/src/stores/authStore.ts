import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

interface AuthState {
  user: any | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('pos_token'),
  login: async (username, password) => {
    try {
      const response = await apiClient('/auth/login', 'POST', { username, password });
      localStorage.setItem('pos_token', response.token);
      set({ user: response.user, token: response.token });
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem('pos_token');
    set({ user: null, token: null });
  },
  isAuthenticated: () => !!get().token
}));