import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

interface AuthState {
  user: any | null;
  token: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
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
      localStorage.setItem('pos_user', JSON.stringify(response.user));
      set({ user: response.user, token: response.token });
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },
  loginWithPin: async (pin) => {
    try {
      const response = await apiClient('/auth/pin', 'POST', { pin });
      localStorage.setItem('pos_token', response.token);
      localStorage.setItem('pos_user', JSON.stringify(response.user));
      set({ user: response.user, token: response.token });
      return true;
    } catch (error) {
      console.error('PIN login failed:', error);
      return false;
    }
  },
  logout: () => {
    const token = get().token;
    if (token) {
      // Fire and forget — don't block the logout
      apiClient('/auth/logout', 'POST').catch(() => {});
    }
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    set({ user: null, token: null });
  },
  isAuthenticated: () => !!get().token,
}));

// Restore user from localStorage on init
const savedUser = localStorage.getItem('pos_user');
if (savedUser) {
  try {
    useAuthStore.setState({ user: JSON.parse(savedUser) });
  } catch {}
}
