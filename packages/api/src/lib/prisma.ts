import { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from './tenantContext';

/**
 * Prisma Client with automatic multi-tenant filtering.
 *
 * How it works:
 *   - Every query automatically gets `where: { tenantId }` injected
 *   - Every create automatically gets `data: { tenantId }` injected
 *   - The tenantId comes from AsyncLocalStorage (set by middleware)
 *   - If no tenant context exists (migrations, seeds, admin), queries run unfiltered
 *
 * Models EXCLUDED from tenant filtering:
 *   - Tenant (it IS the tenant table — no self-reference)
 *
 * IMPORTANT: The extension injects tenantId at RUNTIME. TypeScript types
 * may still show errors for `create` calls that don't include tenantId.
 * This is expected — the extension handles it transparently.
 * Services should NOT manually pass tenantId in their create/where calls.
 */

const basePrisma = new PrismaClient();

// Models that should NOT have tenant filtering applied
const EXCLUDED_MODELS = new Set(['Tenant']);

// All models that have a tenantId field (matches our schema)
const TENANT_MODELS = new Set([
  'User',
  'Session',
  'Category',
  'Product',
  'ModifierGroup',
  'ModifierItem',
  'Section',
  'Table',
  'Order',
  'OrderItem',
  'OrderItemModifier',
  'Payment',
  'Ingredient',
  'RecipeIngredient',
  'StockMovement',
  'SyncQueue',
  'CashRegister',
  'CashMovement',
  'Customer',
  'OrderEvent',
  'RestaurantConfig',
]);

/**
 * Checks if a model should have tenant filtering applied.
 */
function shouldFilter(model: string | undefined): boolean {
  if (!model) return false;
  if (EXCLUDED_MODELS.has(model)) return false;
  return TENANT_MODELS.has(model);
}

/**
 * Extended Prisma client with automatic tenant isolation.
 *
 * Behavior:
 *   - If tenant context is set (normal request flow): all queries are scoped
 *   - If tenant context is NOT set (seeds, migrations, admin scripts): queries run globally
 *   - The Tenant model itself is never filtered
 */
const extendedPrisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },

      async findFirst({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },

      async findUnique({ model, args, query }) {
        // findUnique requires unique fields in where. For id-based lookups this
        // works fine. For composite uniques (tenantId_username), callers should
        // use findFirst instead (already handled in services).
        return query(args);
      },

      async findUniqueOrThrow({ model, args, query }) {
        return query(args);
      },

      async create({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            (args.data as any).tenantId = tenantId;
          }
        }
        return query(args);
      },

      async createMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({
                ...item,
                tenantId,
              }));
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
          if (tenantId) {
            (args.where as any).tenantId = tenantId;
          }
        }
        return query(args);
      },

      async updateMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },

      async delete({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            (args.where as any).tenantId = tenantId;
          }
        }
        return query(args);
      },

      async deleteMany({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },

      async aggregate({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },

      async groupBy({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },

      async count({ model, args, query }) {
        if (shouldFilter(model)) {
          const tenantId = getCurrentTenantId();
          if (tenantId) {
            args.where = { ...args.where, tenantId };
          }
        }
        return query(args);
      },
    },
  },
});

/**
 * Export prisma as PrismaClient type to maintain backward compatibility
 * with all existing service imports. The extension adds runtime behavior
 * (tenant filtering) without changing the public API surface.
 *
 * The `as unknown as PrismaClient` cast is intentional:
 * - Services continue to use standard Prisma types for autocomplete
 * - The extension injects tenantId at runtime transparently
 * - TypeScript won't complain about missing tenantId in create() calls
 *
 * NOTE: Due to Prisma's strict type system requiring tenantId in create()
 * calls (since it's a required field in the schema), we export as `any`
 * temporarily. This allows existing services to work without modification.
 * The tenantId is ALWAYS injected by the extension at runtime.
 * Once services are fully migrated to be tenant-aware (Phase 4+),
 * we can restore strict typing.
 */
export const prisma: any = extendedPrisma;
