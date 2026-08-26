import { prisma } from '../lib/prisma';

/**
 * AI Assistant Actions — safe, structured operations the assistant can execute.
 *
 * The LLM detects intent and returns an action JSON. The backend validates and
 * executes it. Read actions run immediately; write actions require explicit
 * confirmation (confirmed:true) before executing.
 */

// ─── Action Definitions (shown to the LLM) ─────────────────────────────────────

export const ACTION_CATALOG = `
ACCIONES DISPONIBLES:
Si el usuario pide EJECUTAR algo (no solo preguntar), responde SOLO con un bloque JSON
envuelto en <action>...</action>. Formato:

<action>{"type": "NOMBRE_ACCION", "params": { ... }}</action>

Acciones de CONSULTA (se ejecutan de inmediato):
- sales_by_date: ventas de una fecha específica. params: { date: "YYYY-MM-DD" }
- top_products: productos más vendidos en un rango. params: { days: number }
- low_stock: ingredientes con stock bajo. params: { threshold?: number }
- search_product: buscar un producto por nombre. params: { query: string }
- customer_lookup: buscar cliente por nombre/teléfono. params: { query: string }

Acciones de ESCRITURA (requieren confirmación del usuario):
- create_product: crear un producto. params: { name: string, price: number, category: string }
- adjust_stock: ajustar stock de un ingrediente. params: { ingredient: string, quantity: number }

REGLAS DE ACCIONES:
- Solo usa <action> cuando el usuario CLARAMENTE pide ejecutar algo (ej: "crea el producto...",
  "cuánto vendí el 5 de enero", "busca al cliente Juan").
- Para preguntas generales o recomendaciones, responde con texto normal (NO uses <action>).
- Nunca inventes params. Si falta info para una acción de escritura, pídela en texto normal.
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ActionRequest {
  type: string;
  params: Record<string, any>;
}

interface ActionResult {
  ok: boolean;
  // For write actions that need confirmation before executing
  needsConfirmation?: boolean;
  actionType?: string;
  params?: Record<string, any>;
  summary?: string; // human-readable summary of what will happen
  // Result data (for queries or executed writes)
  data?: any;
  message?: string;
}

const READ_ACTIONS = new Set(['sales_by_date', 'top_products', 'low_stock', 'search_product', 'customer_lookup']);
const WRITE_ACTIONS = new Set(['create_product', 'adjust_stock']);

/**
 * Which roles may execute each action.
 * Sales/financial queries are restricted to ADMIN/MANAGER (like the reports module).
 * Operational lookups (products, customers, stock) are open to more roles.
 * Write actions are ADMIN/MANAGER only.
 */
const ACTION_ROLES: Record<string, string[]> = {
  // Read — financial (restricted)
  sales_by_date: ['ADMIN', 'MANAGER'],
  top_products: ['ADMIN', 'MANAGER'],
  // Read — operational (broader)
  low_stock: ['ADMIN', 'MANAGER'],
  search_product: ['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'CHEF', 'BARTENDER'],
  customer_lookup: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'],
  // Write — admin/manager only
  create_product: ['ADMIN', 'MANAGER'],
  adjust_stock: ['ADMIN', 'MANAGER'],
};

/**
 * Check if a role can execute an action. Unknown actions default to ADMIN-only.
 */
export function canRoleExecute(actionType: string, role: string): boolean {
  const allowed = ACTION_ROLES[actionType];
  if (!allowed) return role === 'ADMIN';
  return allowed.includes(role);
}

/**
 * Parse an <action>...</action> block from the LLM response.
 * Returns null if no valid action is present.
 */
export function parseAction(text: string): ActionRequest | null {
  const match = text.match(/<action>\s*([\s\S]*?)\s*<\/action>/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed && typeof parsed.type === 'string') {
      return { type: parsed.type, params: parsed.params || {} };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Execute an action. Write actions only execute when `confirmed` is true;
 * otherwise they return needsConfirmation with a summary.
 */
export async function executeAction(action: ActionRequest, confirmed: boolean): Promise<ActionResult> {
  const { type, params } = action;

  // ─── READ ACTIONS (immediate) ───
  if (type === 'sales_by_date') {
    const date = params.date;
    if (!date) return { ok: false, message: 'Falta la fecha' };
    const start = new Date(date + 'T00:00:00');
    const end = new Date(date + 'T23:59:59.999');
    const orders = await prisma.order.findMany({
      where: { status: 'CLOSED', closedAt: { gte: start, lte: end } },
      select: { total: true },
    });
    const total = orders.reduce((s: number, o: any) => s + o.total, 0);
    return {
      ok: true,
      data: { date, sales: Math.round(total * 100) / 100, orders: orders.length },
      message: `El ${date} vendiste $${total.toLocaleString('es-MX')} en ${orders.length} órdenes.`,
    };
  }

  if (type === 'top_products') {
    const days = Math.min(params.days || 7, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const items = await prisma.orderItem.findMany({
      where: { order: { status: 'CLOSED', closedAt: { gte: since } } },
      select: { productId: true, quantity: true, product: { select: { name: true, price: true } } },
    });
    const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const it of items) {
      if (!agg[it.productId]) agg[it.productId] = { name: it.product.name, qty: 0, revenue: 0 };
      agg[it.productId].qty += it.quantity;
      agg[it.productId].revenue += it.quantity * it.product.price;
    }
    const top = Object.values(agg).sort((a, b) => b.qty - a.qty).slice(0, 10);
    return {
      ok: true,
      data: { days, products: top },
      message: `Top productos de los últimos ${days} días:\n` +
        top.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} vendidos ($${p.revenue.toLocaleString('es-MX')})`).join('\n'),
    };
  }

  if (type === 'low_stock') {
    const threshold = params.threshold || 10;
    const ingredients = await prisma.ingredient.findMany({
      where: { stock: { lte: threshold } },
      orderBy: { stock: 'asc' },
      select: { name: true, stock: true, unit: true },
    });
    return {
      ok: true,
      data: { threshold, ingredients },
      message: ingredients.length === 0
        ? `Todo bien: ningún ingrediente por debajo de ${threshold}.`
        : `Ingredientes con stock bajo (≤${threshold}):\n` +
          ingredients.map((i) => `- ${i.name}: ${i.stock} ${i.unit}`).join('\n'),
    };
  }

  if (type === 'search_product') {
    const query = (params.query || '').trim();
    if (!query) return { ok: false, message: 'Falta el término de búsqueda' };
    const products = await prisma.product.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      select: { name: true, price: true, active: true, category: { select: { name: true } } },
      take: 10,
    });
    return {
      ok: true,
      data: { products },
      message: products.length === 0
        ? `No encontré productos con "${query}".`
        : `Productos que coinciden con "${query}":\n` +
          products.map((p) => `- ${p.name} — $${p.price} (${p.category.name})${p.active ? '' : ' [inactivo]'}`).join('\n'),
    };
  }

  if (type === 'customer_lookup') {
    const query = (params.query || '').trim();
    if (!query) return { ok: false, message: 'Falta el nombre o teléfono' };
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      select: { firstName: true, lastName: true, phone: true, totalVisits: true, totalSpent: true, loyaltyPoints: true },
      take: 5,
    });
    return {
      ok: true,
      data: { customers },
      message: customers.length === 0
        ? `No encontré clientes con "${query}".`
        : `Clientes que coinciden con "${query}":\n` +
          customers.map((c) => `- ${c.firstName} ${c.lastName}${c.phone ? ` (${c.phone})` : ''}: ${c.totalVisits} visitas, $${c.totalSpent.toLocaleString('es-MX')} gastado, ${c.loyaltyPoints} pts`).join('\n'),
    };
  }

  // ─── WRITE ACTIONS (need confirmation) ───
  if (type === 'create_product') {
    const { name, price, category } = params;
    if (!name || price == null || !category) {
      return { ok: false, message: 'Para crear un producto necesito: nombre, precio y categoría.' };
    }
    const summary = `Crear producto "${name}" a $${price} en categoría "${category}"`;
    if (!confirmed) {
      return { ok: true, needsConfirmation: true, actionType: type, params, summary };
    }
    // Find or create category
    let cat = await prisma.category.findFirst({ where: { name: { equals: category, mode: 'insensitive' } } });
    if (!cat) {
      cat = await prisma.category.create({ data: { name: category } });
    }
    const product = await prisma.product.create({
      data: { name, price: Number(price), categoryId: cat.id, active: true },
    });
    return { ok: true, data: { product }, message: `✅ Producto "${name}" creado a $${price} en "${cat.name}".` };
  }

  if (type === 'adjust_stock') {
    const { ingredient, quantity } = params;
    if (!ingredient || quantity == null) {
      return { ok: false, message: 'Para ajustar stock necesito: nombre del ingrediente y cantidad.' };
    }
    const ing = await prisma.ingredient.findFirst({ where: { name: { equals: ingredient, mode: 'insensitive' } } });
    if (!ing) return { ok: false, message: `No encontré el ingrediente "${ingredient}".` };

    const newStock = Number(quantity);
    const summary = `Ajustar stock de "${ing.name}" de ${ing.stock} a ${newStock} ${ing.unit}`;
    if (!confirmed) {
      return { ok: true, needsConfirmation: true, actionType: type, params, summary };
    }
    await prisma.ingredient.update({ where: { id: ing.id }, data: { stock: newStock } });
    return { ok: true, data: { ingredient: ing.name, newStock }, message: `✅ Stock de "${ing.name}" ajustado a ${newStock} ${ing.unit}.` };
  }

  return { ok: false, message: `Acción no reconocida: ${type}` };
}

export function isKnownAction(type: string): boolean {
  return READ_ACTIONS.has(type) || WRITE_ACTIONS.has(type);
}

export function isWriteAction(type: string): boolean {
  return WRITE_ACTIONS.has(type);
}
