/**
 * Terminology — configurable labels per business type.
 *
 * Different types of businesses use different words for the same concepts.
 * A restaurant has "mesas" and "platillos", a barbershop has "sillas" and "cortes".
 *
 * This module provides:
 *   - Default terminology dictionaries per business type
 *   - A resolver that merges defaults with tenant-specific overrides
 *   - A helper to translate a term key into the tenant's language
 *
 * The frontend uses these terms to display context-appropriate labels.
 * The API includes them in the GET /api/tenant/config response.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * All translatable term keys used throughout the system.
 * Frontend components reference these keys instead of hardcoded Spanish strings.
 */
export interface TerminologyDictionary {
  // Physical space
  table: string;           // mesa / silla / estación
  tables: string;          // mesas / sillas / estaciones
  section: string;         // sección / área / zona
  floorPlan: string;       // plano de mesas / distribución

  // Orders & items
  order: string;           // orden / servicio / ticket
  orders: string;          // órdenes / servicios / tickets
  orderItem: string;       // platillo / servicio / producto
  orderItems: string;      // platillos / servicios / productos

  // Products
  product: string;         // platillo / corte / producto / bebida
  products: string;        // platillos / cortes / productos / bebidas
  category: string;        // categoría
  categories: string;      // categorías
  menu: string;            // menú / catálogo / servicios / lista de precios

  // Kitchen / preparation
  kitchen: string;         // cocina / preparación / estación
  kitchenDisplay: string;  // pantalla de cocina / pantalla de preparación
  preparing: string;       // preparando / en servicio / procesando
  ready: string;           // listo / terminado

  // People
  waiter: string;          // mesero / barbero / empleado / vendedor
  waiters: string;         // meseros / barberos / empleados / vendedores
  chef: string;            // cocinero / barbero principal / preparador
  customer: string;        // cliente / cliente
  customers: string;       // clientes / clientes

  // Actions
  dineIn: string;          // comer aquí / en local / en tienda
  takeaway: string;        // para llevar
  delivery: string;        // a domicilio / entrega

  // Business
  businessName: string;    // restaurante / barbería / cafetería / tienda / negocio
  tip: string;             // propina
  reservation: string;     // reservación / cita
  reservations: string;    // reservaciones / citas
}

type BusinessType = 'RESTAURANT' | 'BARBERSHOP' | 'CAFE' | 'STORE' | 'GENERAL';

// ─── Default Dictionaries ────────────────────────────────────────────────────

const RESTAURANT_TERMS: TerminologyDictionary = {
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
  businessName: 'restaurante',
  tip: 'propina',
  reservation: 'reservación',
  reservations: 'reservaciones',
};

const BARBERSHOP_TERMS: TerminologyDictionary = {
  table: 'silla',
  tables: 'sillas',
  section: 'área',
  floorPlan: 'distribución',
  order: 'servicio',
  orders: 'servicios',
  orderItem: 'servicio',
  orderItems: 'servicios',
  product: 'corte',
  products: 'cortes y servicios',
  category: 'categoría',
  categories: 'categorías',
  menu: 'lista de servicios',
  kitchen: 'preparación',
  kitchenDisplay: 'pantalla de turnos',
  preparing: 'en servicio',
  ready: 'terminado',
  waiter: 'barbero',
  waiters: 'barberos',
  chef: 'barbero principal',
  customer: 'cliente',
  customers: 'clientes',
  dineIn: 'en local',
  takeaway: 'a domicilio',
  delivery: 'a domicilio',
  businessName: 'barbería',
  tip: 'propina',
  reservation: 'cita',
  reservations: 'citas',
};

const CAFE_TERMS: TerminologyDictionary = {
  table: 'mesa',
  tables: 'mesas',
  section: 'zona',
  floorPlan: 'distribución',
  order: 'orden',
  orders: 'órdenes',
  orderItem: 'producto',
  orderItems: 'productos',
  product: 'bebida',
  products: 'bebidas y alimentos',
  category: 'categoría',
  categories: 'categorías',
  menu: 'menú',
  kitchen: 'barra',
  kitchenDisplay: 'pantalla de preparación',
  preparing: 'preparando',
  ready: 'listo',
  waiter: 'barista',
  waiters: 'baristas',
  chef: 'barista principal',
  customer: 'cliente',
  customers: 'clientes',
  dineIn: 'para aquí',
  takeaway: 'para llevar',
  delivery: 'a domicilio',
  businessName: 'cafetería',
  tip: 'propina',
  reservation: 'reservación',
  reservations: 'reservaciones',
};

const STORE_TERMS: TerminologyDictionary = {
  table: 'mostrador',
  tables: 'mostradores',
  section: 'pasillo',
  floorPlan: 'distribución',
  order: 'venta',
  orders: 'ventas',
  orderItem: 'producto',
  orderItems: 'productos',
  product: 'producto',
  products: 'productos',
  category: 'categoría',
  categories: 'categorías',
  menu: 'catálogo',
  kitchen: 'almacén',
  kitchenDisplay: 'pantalla de pedidos',
  preparing: 'empacando',
  ready: 'listo',
  waiter: 'vendedor',
  waiters: 'vendedores',
  chef: 'encargado',
  customer: 'cliente',
  customers: 'clientes',
  dineIn: 'en tienda',
  takeaway: 'para llevar',
  delivery: 'a domicilio',
  businessName: 'tienda',
  tip: 'propina',
  reservation: 'apartado',
  reservations: 'apartados',
};

const GENERAL_TERMS: TerminologyDictionary = {
  table: 'estación',
  tables: 'estaciones',
  section: 'área',
  floorPlan: 'distribución',
  order: 'ticket',
  orders: 'tickets',
  orderItem: 'servicio',
  orderItems: 'servicios',
  product: 'servicio',
  products: 'servicios',
  category: 'categoría',
  categories: 'categorías',
  menu: 'catálogo',
  kitchen: 'preparación',
  kitchenDisplay: 'pantalla de preparación',
  preparing: 'en proceso',
  ready: 'listo',
  waiter: 'empleado',
  waiters: 'empleados',
  chef: 'encargado',
  customer: 'cliente',
  customers: 'clientes',
  dineIn: 'en local',
  takeaway: 'para llevar',
  delivery: 'a domicilio',
  businessName: 'negocio',
  tip: 'propina',
  reservation: 'cita',
  reservations: 'citas',
};

// ─── Lookup ──────────────────────────────────────────────────────────────────

const TERMINOLOGY_MAP: Record<BusinessType, TerminologyDictionary> = {
  RESTAURANT: RESTAURANT_TERMS,
  BARBERSHOP: BARBERSHOP_TERMS,
  CAFE: CAFE_TERMS,
  STORE: STORE_TERMS,
  GENERAL: GENERAL_TERMS,
};

/**
 * Get the default terminology dictionary for a business type.
 */
export function getDefaultTerminology(businessType: BusinessType): TerminologyDictionary {
  return TERMINOLOGY_MAP[businessType] || GENERAL_TERMS;
}

/**
 * Resolve terminology for a tenant: merges the default dictionary for the
 * business type with any tenant-specific overrides stored in tenant.config.
 *
 * Tenant overrides are stored in tenant.config.terminology as a partial dictionary:
 *   { "terminology": { "product": "artículo", "waiter": "asistente" } }
 *
 * Only the keys present in the override replace the defaults.
 */
export function resolveTerminology(
  businessType: BusinessType,
  tenantConfigOverrides?: Partial<TerminologyDictionary>,
): TerminologyDictionary {
  const defaults = getDefaultTerminology(businessType);

  if (!tenantConfigOverrides || Object.keys(tenantConfigOverrides).length === 0) {
    return defaults;
  }

  // Merge: tenant overrides win, but only for keys that exist in the dictionary
  return { ...defaults, ...tenantConfigOverrides };
}

/**
 * Get a single term for a tenant context.
 * Useful in API responses that need to include translated labels.
 */
export function getTerm(
  key: keyof TerminologyDictionary,
  businessType: BusinessType,
  overrides?: Partial<TerminologyDictionary>,
): string {
  const dict = resolveTerminology(businessType, overrides);
  return dict[key];
}

/**
 * Get all available term keys (useful for frontend to know what's translatable).
 */
export function getTermKeys(): (keyof TerminologyDictionary)[] {
  return Object.keys(RESTAURANT_TERMS) as (keyof TerminologyDictionary)[];
}
