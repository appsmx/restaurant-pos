import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

interface TenantInfo {
  slug: string;
  name: string;
}

interface AuthState {
  user: any | null;
  token: string | null;
  tenant: TenantInfo | null;
  tenantSlug: string | null;
  login: (username: string, password: string, slug?: string) => Promise<boolean>;
  loginWithPin: (pin: string, slug?: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: () => boolean;
  setTenantSlug: (slug: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('pos_token'),
  tenant: (() => { try { return JSON.parse(localStorage.getItem('pos_tenant') || 'null'); } catch { return null; } })(),
  tenantSlug: localStorage.getItem('pos_tenant_slug'),
  login: async (username, password, slug?) => {
    try {
      const effectiveSlug = slug || get().tenantSlug || undefined;
      const response = await apiClient('/auth/login', 'POST', { username, password, slug: effectiveSlug });
      localStorage.setItem('pos_token', response.token);
      localStorage.setItem('pos_user', JSON.stringify(response.user));
      if (response.tenant) {
        localStorage.setItem('pos_tenant', JSON.stringify(response.tenant));
        localStorage.setItem('pos_tenant_slug', response.tenant.slug);
      }
      set({ user: response.user, token: response.token, tenant: response.tenant || null });
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  },
  loginWithPin: async (pin, slug?) => {
    try {
      const effectiveSlug = slug || get().tenantSlug || undefined;
      const response = await apiClient('/auth/pin', 'POST', { pin, slug: effectiveSlug });
      localStorage.setItem('pos_token', response.token);
      localStorage.setItem('pos_user', JSON.stringify(response.user));
      if (response.tenant) {
        localStorage.setItem('pos_tenant', JSON.stringify(response.tenant));
        localStorage.setItem('pos_tenant_slug', response.tenant.slug);
      }
      set({ user: response.user, token: response.token, tenant: response.tenant || null });
      return true;
    } catch (error) {
      console.error('PIN login failed:', error);
      return false;
    }
  },
  logout: () => {
    const token = get().token;
    if (token) {
      apiClient('/auth/logout', 'POST').catch(() => {});
    }
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_tenant');
    // Keep pos_tenant_slug so user returns to same tenant login
    set({ user: null, token: null, tenant: null });
  },
  isAuthenticated: () => !!get().token,
  setTenantSlug: (slug) => {
    if (slug) {
      localStorage.setItem('pos_tenant_slug', slug);
    } else {
      localStorage.removeItem('pos_tenant_slug');
    }
    set({ tenantSlug: slug });
  },
}));

// Restore user from localStorage on init
const savedUser = localStorage.getItem('pos_user');
if (savedUser) {
  try {
    useAuthStore.setState({ user: JSON.parse(savedUser) });
  } catch {}
}
