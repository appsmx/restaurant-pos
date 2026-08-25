/**
 * Module Registry — defines all available modules in Logan POS.
 *
 * Each module represents a feature set that can be enabled/disabled per tenant.
 * The tenant's `enabledModules` array (from the DB) determines which modules
 * are active. The `moduleGuard` middleware uses this registry to enforce access.
 *
 * Module IDs match the keys stored in Tenant.enabledModules[].
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModuleDefinition {
  /** Unique identifier stored in Tenant.enabledModules[] */
  id: string;
  /** Human-readable label (Spanish) */
  label: string;
  /** Short description of what this module does */
  description: string;
  /** Which business types this module is relevant for */
  availableFor: BusinessType[];
  /** API route prefixes that this module controls (used by moduleGuard) */
  routePrefixes: string[];
  /** Whether this module is part of the core (always enabled, can't be disabled) */
  core: boolean;
  /** Icon name (for frontend use — Lucide icon names) */
  icon: string;
  /** Plan required to access this module (null = available in all plans) */
  minimumPlan: Plan | null;
}

type BusinessType = 'RESTAURANT' | 'BARBERSHOP' | 'CAFE' | 'STORE' | 'GENERAL';
type Plan = 'STARTER' | 'GROWTH' | 'PRO';

// ─── Module Registry ─────────────────────────────────────────────────────────

export const MODULE_REGISTRY: ModuleDefinition[] = [
  // ===== CORE MODULES (always enabled) =====
  {
    id: 'pos',
    label: 'Punto de Venta',
    description: 'Cobros, órdenes, pagos — el core del sistema',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/orders', '/menu'],
    core: true,
    icon: 'ShoppingCart',
    minimumPlan: null,
  },
  {
    id: 'users',
    label: 'Empleados',
    description: 'Gestión de usuarios y roles',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/users'],
    core: true,
    icon: 'Users',
    minimumPlan: null,
  },
  {
    id: 'config',
    label: 'Configuración',
    description: 'Ajustes del negocio',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/config'],
    core: true,
    icon: 'Settings',
    minimumPlan: null,
  },
  {
    id: 'reports',
    label: 'Reportes',
    description: 'Ventas, resúmenes y estadísticas',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/reports'],
    core: true,
    icon: 'BarChart3',
    minimumPlan: null,
  },
  {
    id: 'cash',
    label: 'Caja Registradora',
    description: 'Apertura/cierre de caja, movimientos de efectivo',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/cash'],
    core: true,
    icon: 'Wallet',
    minimumPlan: null,
  },

  // ===== OPTIONAL MODULES =====
  {
    id: 'kitchen',
    label: 'Cocina',
    description: 'Pantalla de cocina para preparación de platillos',
    availableFor: ['RESTAURANT', 'CAFE'],
    routePrefixes: ['/kitchen'],
    core: false,
    icon: 'ChefHat',
    minimumPlan: null,
  },
  {
    id: 'bar',
    label: 'Barra',
    description: 'Pantalla de barra para preparación de bebidas',
    availableFor: ['RESTAURANT', 'CAFE'],
    routePrefixes: ['/bar'],
    core: false,
    icon: 'Wine',
    minimumPlan: null,
  },
  {
    id: 'floorPlan',
    label: 'Mapa de Mesas',
    description: 'Distribución visual de mesas y secciones',
    availableFor: ['RESTAURANT', 'CAFE'],
    routePrefixes: ['/floorplan'],
    core: false,
    icon: 'LayoutGrid',
    minimumPlan: null,
  },
  {
    id: 'inventory',
    label: 'Inventario',
    description: 'Control de stock de ingredientes y materiales',
    availableFor: ['RESTAURANT', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/inventory'],
    core: false,
    icon: 'Package',
    minimumPlan: null,
  },
  {
    id: 'recipes',
    label: 'Recetas',
    description: 'Composición de platillos e ingredientes requeridos',
    availableFor: ['RESTAURANT', 'CAFE'],
    routePrefixes: ['/recipes'],
    core: false,
    icon: 'BookOpen',
    minimumPlan: null,
  },
  {
    id: 'customers',
    label: 'Clientes',
    description: 'Base de datos de clientes y perfil de lealtad',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/customers'],
    core: false,
    icon: 'UserCircle',
    minimumPlan: null,
  },
  {
    id: 'loyalty',
    label: 'Lealtad',
    description: 'Puntos, recompensas y programa de fidelización',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE'],
    routePrefixes: ['/loyalty'],
    core: false,
    icon: 'Heart',
    minimumPlan: 'GROWTH',
  },
  {
    id: 'digitalMenu',
    label: 'Menú Digital QR',
    description: 'Menú público accesible por código QR',
    availableFor: ['RESTAURANT', 'CAFE', 'BARBERSHOP'],
    routePrefixes: ['/public'],
    core: false,
    icon: 'QrCode',
    minimumPlan: null,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    description: 'Gestión de pedidos para entrega a domicilio',
    availableFor: ['RESTAURANT', 'CAFE', 'STORE'],
    routePrefixes: ['/delivery'],
    core: false,
    icon: 'Truck',
    minimumPlan: 'GROWTH',
  },
  {
    id: 'appointments',
    label: 'Citas',
    description: 'Agenda y reservaciones de servicios',
    availableFor: ['BARBERSHOP', 'GENERAL'],
    routePrefixes: ['/appointments', '/reservations'],
    core: false,
    icon: 'CalendarClock',
    minimumPlan: null,
  },
  {
    id: 'modifiers',
    label: 'Modificadores',
    description: 'Opciones y extras configurables por producto',
    availableFor: ['RESTAURANT', 'CAFE', 'BARBERSHOP', 'STORE', 'GENERAL'],
    routePrefixes: ['/modifiers'],
    core: false,
    icon: 'SlidersHorizontal',
    minimumPlan: null,
  },
  {
    id: 'ai',
    label: 'Asistente IA',
    description: 'Asistente inteligente para análisis y atención',
    availableFor: ['RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL'],
    routePrefixes: ['/ai'],
    core: false,
    icon: 'Bot',
    minimumPlan: 'PRO',
  },
];

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Get a module definition by ID */
export function getModule(moduleId: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find(m => m.id === moduleId);
}

/** Get all modules available for a specific business type */
export function getModulesForBusinessType(businessType: BusinessType): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(m => m.availableFor.includes(businessType));
}

/** Get default enabled modules for a business type (core + type-specific defaults) */
export function getDefaultModules(businessType: BusinessType): string[] {
  const coreModules = MODULE_REGISTRY.filter(m => m.core).map(m => m.id);

  const typeDefaults: Record<BusinessType, string[]> = {
    RESTAURANT: ['kitchen', 'bar', 'floorPlan', 'inventory', 'recipes', 'customers', 'digitalMenu', 'modifiers'],
    BARBERSHOP: ['appointments', 'customers'],
    CAFE: ['kitchen', 'inventory', 'customers', 'digitalMenu'],
    STORE: ['inventory', 'customers'],
    GENERAL: ['customers'],
  };

  return [...coreModules, ...(typeDefaults[businessType] || [])];
}

/** Check if a module is enabled for a given tenant config */
export function isModuleEnabled(
  moduleId: string,
  enabledModules: string[],
): boolean {
  const module = getModule(moduleId);
  if (!module) return false;
  if (module.core) return true; // Core modules are always enabled
  return enabledModules.includes(moduleId);
}

/**
 * Find which module controls a given route prefix.
 * Used by the moduleGuard middleware to determine if a request should be allowed.
 */
export function getModuleForRoute(routePrefix: string): ModuleDefinition | undefined {
  // Normalize: ensure it starts with /
  const normalized = routePrefix.startsWith('/') ? routePrefix : `/${routePrefix}`;

  return MODULE_REGISTRY.find(m =>
    m.routePrefixes.some(prefix => normalized.startsWith(prefix))
  );
}

/**
 * Check if a tenant's plan meets the minimum requirement for a module.
 */
export function isPlanSufficient(tenantPlan: string, requiredPlan: Plan | null): boolean {
  if (!requiredPlan) return true; // No plan restriction

  const planHierarchy: Record<Plan, number> = {
    STARTER: 1,
    GROWTH: 2,
    PRO: 3,
  };

  const tenantLevel = planHierarchy[tenantPlan as Plan] || 0;
  const requiredLevel = planHierarchy[requiredPlan];

  return tenantLevel >= requiredLevel;
}
