import { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from './tenantContext';

/**
 * Prisma Client with automatic multi-tenant tenantId injection.
 *
 * The extension auto-injects tenantId into:
 *   - WHERE clauses (findMany, findFirst, updateMany, deleteMany, aggregate, count)
 *   - DATA on creates (create, createMany)
 *   - WHERE on updates/deletes (update, delete)
 *
 * If no tenant context is set (e.g., during seeds/admin scripts), queries run unfiltered.
 * The Tenant model itself is excluded from filtering.
 */

const basePrisma = new PrismaClient();

const EXCLUDED_MODELS = new Set(['Tenant']);
const TENANT_MODELS = new Set([
  'User', 'Session', 'Category', 'Product', 'ModifierGroup', 'ModifierItem',
  'Section', 'Table', 'Order', 'OrderItem', 'OrderItemModifier', 'Payment',
  'Ingredient', 'RecipeIngredient', 'StockMovement', 'SyncQueue',
  'CashRegister', 'CashMovement', 'Customer', 'OrderEvent', 'RestaurantConfig',
  'Reservation',
]);

function shouldFilter(model: string | undefined): boolean {
  if (!model) return false;
  if (EXCLUDED_MODELS.has(model)) return false;
  return TENANT_MODELS.has(model);
}

const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async findUnique({ model, args, query }) {
        return query(args);
      },
      async findUniqueOrThrow({ model, args, query }) {
        return query(args);
      },
      async create({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) (args.data as any).tenantId = tenantId;
        }
        return query(args);
      },
      async createMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({ ...item, tenantId }));
            } else {
              (args.data as any).tenantId = tenantId;
            }
          }
        }
        return query(args);
      },
      async update({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) (args.where as any).tenantId = tenantId;
        }
        return query(args);
      },
      async updateMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async delete({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) (args.where as any).tenantId = tenantId;
        }
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async aggregate({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
      async count({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) args.where = { ...args.where, tenantId };
        }
        return query(args);
      },
    },
  },
});

export const prisma: any = extendedPrisma;
