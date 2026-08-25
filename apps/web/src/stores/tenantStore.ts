import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

/**
 * Tenant Store — holds the current tenant's configuration.
 *
 * Fetched on app load via GET /api/tenant/config.
 * Provides:
 *   - Enabled modules (for sidebar filtering)
 *   - Terminology (for dynamic labels)
 *   - Branding (name, logo, colors)
 *   - Plan info (for upgrade prompts)
 */

export interface TenantModule {
  id: string;
  label: string;
  description: string;
  icon: string;
  core: boolean;
  enabled: boolean;
  locked: boolean;
  minimumPlan: string | null;
}

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  plan: string;
  logoUrl: string | null;
  colors: Record<string, string> | null;
}

export interface Terminology {
  table: string;
  tables: string;
  section: string;
  floorPlan: string;
  order: string;
  orders: string;
  orderItem: string;
  orderItems: string;
  product: string;
  products: string;
  category: string;
  categories: string;
  menu: string;
  kitchen: string;
  kitchenDisplay: string;
  preparing: string;
  ready: string;
  waiter: string;
  waiters: string;
  chef: string;
  customer: string;
  customers: string;
  dineIn: string;
  takeaway: string;
  delivery: string;
  businessName: string;
  tip: string;
  reservation: string;
  reservations: string;
  [key: string]: string;
}

interface TenantState {
  tenant: TenantInfo | null;
  modules: TenantModule[];
  terminology: Terminology | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  /** Fetch tenant config from the API */
  fetchConfig: () => Promise<void>;

  /** Check if a module is enabled */
  isModuleEnabled: (moduleId: string) => boolean;

  /** Get a terminology term (with fallback to key name) */
  t: (key: keyof Terminology) => string;

  /** Get tenant display name */
  getBusinessName: () => string;
}

// Default terminology (restaurant — fallback if no config loaded)
const DEFAULT_TERMINOLOGY: Terminology = {
  table: 'mesa',
  tables: 'mesas',
  section: 'sección',
  floorPlan: 'plano de mesas',
  order: 'orden',
  orders: 'órdenes',
  orderItem: 'platillo',
  orderItems: 'platillos',
  product: 'platillo',
  products: 'platillos',
  category: 'categoría',
  categories: 'categorías',
  menu: 'menú',
  kitchen: 'cocina',
  kitchenDisplay: 'pantalla de cocina',
  preparing: 'preparando',
  ready: 'listo',
  waiter: 'mesero',
  waiters: 'meseros',
  chef: 'cocinero',
  customer: 'cliente',
  customers: 'clientes',
  dineIn: 'comer aquí',
  takeaway: 'para llevar',
  delivery: 'a domicilio',
  businessName: 'negocio',
  tip: 'propina',
  reservation: 'reservación',
  reservations: 'reservaciones',
};

export const useTenantStore = create<TenantState>((set, get) => ({
  tenant: null,
  modules: [],
  terminology: null,
  loading: false,
  error: null,
  initialized: false,

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient('/tenant/config');
      set({
        tenant: data.tenant || null,
        modules: data.modules || [],
        terminology: data.terminology || DEFAULT_TERMINOLOGY,
        loading: false,
        initialized: true,
      });
    } catch (error: any) {
      console.warn('[tenantStore] Failed to fetch tenant config:', error.message);
      // Non-fatal: app works without tenant config (single-tenant backward compat)
      set({
        tenant: null,
        modules: [],
        terminology: DEFAULT_TERMINOLOGY,
        loading: false,
        initialized: true,
        error: error.message,
      });
    }
  },

  isModuleEnabled: (moduleId: string) => {
    const { modules } = get();
    // If no modules loaded (backward compat), allow everything
    if (modules.length === 0) return true;
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return true; // Unknown module — don't block
    return mod.enabled;
  },

  t: (key: keyof Terminology) => {
    const { terminology } = get();
    if (!terminology) return DEFAULT_TERMINOLOGY[key] || String(key);
    return terminology[key] || DEFAULT_TERMINOLOGY[key] || String(key);
  },

  getBusinessName: () => {
    const { tenant } = get();
    return tenant?.name || 'Mi Negocio';
  },
}));
