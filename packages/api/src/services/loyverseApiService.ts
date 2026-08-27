import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

/**
 * Loyverse API Import Service
 *
 * Migra datos directamente desde la API de Loyverse (sin necesidad de exportar CSV).
 * El usuario provee su Access Token de Loyverse (Back Office → Integraciones → Access tokens).
 *
 * API docs: https://developer.loyverse.com/docs/
 * Base URL: https://api.loyverse.com/v1.0
 * Auth: Authorization: Bearer <token>
 * Paginación: cursor + limit (máx 250). Rate limit: 300 req / 300s.
 */

const LOYVERSE_BASE = 'https://api.loyverse.com/v1.0';
const PAGE_LIMIT = 250;

interface ImportResult {
  type: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ==================== Tipos de la API de Loyverse ====================

interface LoyverseCategory {
  id: string;
  name: string;
}

interface LoyverseVariant {
  variant_id: string;
  default_price: number | null;
  stores?: { store_id: string; price: number | null; available_for_sale: boolean }[];
}

interface LoyverseItem {
  id: string;
  item_name: string;
  category_id: string | null;
  description?: string | null;
  variants: LoyverseVariant[];
}

interface LoyverseCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  note?: string | null;
  total_visits?: number;
  total_spent?: number;
  total_points?: number;
}

interface LoyverseReceiptLineItem {
  item_name: string;
  quantity: number;
  price: number;
  total_money: number;
}

interface LoyverseReceiptPayment {
  name?: string;
  type?: string;
  money_amount: number;
}

interface LoyverseReceipt {
  receipt_number: string;
  receipt_date: string;
  receipt_type?: string;
  total_money: number;
  line_items: LoyverseReceiptLineItem[];
  payments: LoyverseReceiptPayment[];
}

// ==================== Helper HTTP ====================

async function loyverseFetch<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${LOYVERSE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 401) {
    throw new AppError('Token de Loyverse inválido o expirado. Verifica tu Access Token.', 401);
  }
  if (res.status === 429) {
    throw new AppError('Límite de peticiones de Loyverse alcanzado. Espera unos minutos e intenta de nuevo.', 429);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AppError(`Error de Loyverse (${res.status}): ${body || res.statusText}`, 502);
  }

  return res.json() as Promise<T>;
}

/**
 * Recorre todas las páginas de un endpoint de listado de Loyverse.
 * La API devuelve `{ <key>: [...], cursor?: string }`.
 */
async function fetchAllPages<T>(token: string, path: string, dataKey: string): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  let guard = 0; // evita bucles infinitos (máx 200 páginas = 50k registros)

  do {
    const params: Record<string, string> = { limit: String(PAGE_LIMIT) };
    if (cursor) params.cursor = cursor;

    const page = await loyverseFetch<Record<string, any>>(token, path, params);
    const items = (page[dataKey] as T[]) || [];
    all.push(...items);
    cursor = page.cursor;
    guard++;
  } while (cursor && guard < 200);

  return all;
}

// ==================== Servicio ====================

export const loyverseApiService = {
  /**
   * Valida el token consultando el merchant. Devuelve info básica del comercio.
   */
  testConnection: async (token: string): Promise<{ businessName: string; email: string; country: string }> => {
    if (!token || !token.trim()) {
      throw new AppError('Falta el token de Loyverse.', 400);
    }
    const merchant = await loyverseFetch<any>(token.trim(), '/merchant/');
    return {
      businessName: merchant.business_name || merchant.name || 'Comercio Loyverse',
      email: merchant.email || '',
      country: merchant.country || '',
    };
  },

  /**
   * Importa productos (items) + categorías desde la API de Loyverse.
   */
  importItems: async (token: string): Promise<ImportResult> => {
    const result: ImportResult = { type: 'items', created: 0, updated: 0, skipped: 0, errors: [] };
    const t = token.trim();

    // 1. Categorías → mapa loyverseCategoryId → nombre
    const loyCategories = await fetchAllPages<LoyverseCategory>(t, '/categories', 'categories');
    const catNameById: Record<string, string> = {};
    for (const c of loyCategories) catNameById[c.id] = c.name;

    // 2. Items
    const items = await fetchAllPages<LoyverseItem>(t, '/items', 'items');
    if (items.length === 0) {
      throw new AppError('No se encontraron productos en tu cuenta de Loyverse.', 404);
    }

    // Cache de categorías locales (nombre → id)
    const localCategoryMap: Record<string, string> = {};

    const getLocalCategoryId = async (loyCatId: string | null): Promise<string> => {
      const catName = (loyCatId && catNameById[loyCatId]) || 'Sin categoría';
      if (localCategoryMap[catName]) return localCategoryMap[catName];
      let category = await prisma.category.findFirst({ where: { name: catName } });
      if (!category) {
        category = await prisma.category.create({ data: { name: catName } });
      }
      localCategoryMap[catName] = category.id;
      return category.id;
    };

    for (const item of items) {
      try {
        const name = (item.item_name || '').trim();
        if (!name) {
          result.skipped++;
          continue;
        }

        // Precio: default_price de la primera variante, o precio de tienda
        const variant = item.variants?.[0];
        let price = variant?.default_price ?? 0;
        if ((price === null || price === 0) && variant?.stores?.length) {
          price = variant.stores.find((s) => s.price != null)?.price ?? 0;
        }
        price = price || 0;

        const categoryId = await getLocalCategoryId(item.category_id);
        const description = (item.description || '').trim() || null;

        const existing = await prisma.product.findFirst({ where: { name, categoryId } });
        if (existing) {
          if (existing.price !== price || (description && existing.description !== description)) {
            await prisma.product.update({
              where: { id: existing.id },
              data: { price, description: description || existing.description },
            });
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          await prisma.product.create({
            data: { name, price, categoryId, description, active: true },
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Producto "${item.item_name}": ${err.message || 'Error desconocido'}`);
      }
    }

    return result;
  },

  /**
   * Importa clientes desde la API de Loyverse.
   */
  importCustomers: async (token: string): Promise<ImportResult> => {
    const result: ImportResult = { type: 'customers', created: 0, updated: 0, skipped: 0, errors: [] };
    const t = token.trim();

    const customers = await fetchAllPages<LoyverseCustomer>(t, '/customers', 'customers');
    if (customers.length === 0) {
      throw new AppError('No se encontraron clientes en tu cuenta de Loyverse.', 404);
    }

    for (const c of customers) {
      try {
        const fullName = (c.name || '').trim();
        if (!fullName) {
          result.skipped++;
          continue;
        }

        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || fullName;
        const lastName = nameParts.slice(1).join(' ') || '';
        const phone = (c.phone_number || '').trim() || null;
        const email = (c.email || '').trim() || null;
        const notes = (c.note || '').trim() || null;
        const totalVisits = c.total_visits || 0;
        const totalSpent = c.total_spent || 0;
        const loyaltyPoints = Math.round(c.total_points || 0);

        let existing = null;
        if (phone) existing = await prisma.customer.findFirst({ where: { phone } });
        if (!existing && email) existing = await prisma.customer.findFirst({ where: { email } });

        if (existing) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              ...(totalVisits > existing.totalVisits && { totalVisits }),
              ...(totalSpent > existing.totalSpent && { totalSpent }),
              ...(loyaltyPoints > existing.loyaltyPoints && { loyaltyPoints }),
              ...(notes && !existing.notes && { notes }),
            },
          });
          result.updated++;
        } else {
          await prisma.customer.create({
            data: { firstName, lastName, phone, email, notes, totalVisits, totalSpent, loyaltyPoints },
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Cliente "${c.name}": ${err.message || 'Error desconocido'}`);
      }
    }

    return result;
  },

  /**
   * Importa el historial de ventas (recibos) desde la API de Loyverse como órdenes cerradas.
   */
  importReceipts: async (token: string, userId: string): Promise<ImportResult> => {
    const result: ImportResult = { type: 'receipts', created: 0, updated: 0, skipped: 0, errors: [] };
    const t = token.trim();

    const receipts = await fetchAllPages<LoyverseReceipt>(t, '/receipts', 'receipts');
    if (receipts.length === 0) {
      throw new AppError('No se encontraron recibos en tu cuenta de Loyverse.', 404);
    }

    // Siguiente número de ticket
    const lastOrder = await prisma.order.findFirst({ orderBy: { ticketNumber: 'desc' } });
    let nextTicket = (lastOrder?.ticketNumber || 0) + 1;

    // Cache categoría "Importados"
    let importCatId: string | null = null;
    const getImportCatId = async (): Promise<string> => {
      if (importCatId) return importCatId;
      let cat = await prisma.category.findFirst({ where: { name: 'Importados (Loyverse)' } });
      if (!cat) cat = await prisma.category.create({ data: { name: 'Importados (Loyverse)' } });
      importCatId = cat.id;
      return cat.id;
    };

    for (const receipt of receipts) {
      try {
        // Omitir reembolsos
        if (receipt.receipt_type && receipt.receipt_type.toUpperCase() === 'REFUND') {
          result.skipped++;
          continue;
        }

        const orderDate = receipt.receipt_date ? new Date(receipt.receipt_date) : new Date();
        const validDate = isNaN(orderDate.getTime()) ? new Date() : orderDate;

        const lineItems = receipt.line_items || [];
        if (lineItems.length === 0) {
          result.skipped++;
          continue;
        }

        // Método de pago
        let method = 'CASH';
        const payName = (receipt.payments?.[0]?.name || receipt.payments?.[0]?.type || '').toLowerCase();
        if (payName.includes('card') || payName.includes('tarjeta')) method = 'CARD';
        else if (payName.includes('transfer') || payName.includes('transferencia')) method = 'TRANSFER';

        const orderTotal = Math.abs(receipt.total_money || 0);

        // Crear orden cerrada (histórica)
        const order = await prisma.order.create({
          data: {
            userId,
            type: 'DINE_IN',
            status: 'CLOSED',
            ticketNumber: nextTicket++,
            subtotal: orderTotal,
            total: orderTotal,
            closedAt: validDate,
            closedById: userId,
            createdAt: validDate,
          },
        });

        // Items de la orden
        for (const li of lineItems) {
          const itemName = (li.item_name || '').trim();
          if (!itemName) continue;
          const quantity = Math.abs(li.quantity || 1);
          const unitPrice = Math.abs(li.price || 0);

          let product = await prisma.product.findFirst({ where: { name: itemName } });
          if (!product) {
            const catId = await getImportCatId();
            product = await prisma.product.create({
              data: { name: itemName, price: unitPrice, categoryId: catId },
            });
          }

          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              quantity,
              unitPrice,
              status: 'DELIVERED',
            },
          });
        }

        // Pago
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: orderTotal,
            method: method as any,
            status: 'COMPLETED',
            userId,
            createdAt: validDate,
          },
        });

        result.created++;
      } catch (err: any) {
        result.errors.push(`Recibo ${receipt.receipt_number}: ${err.message || 'Error desconocido'}`);
      }
    }

    return result;
  },
};
