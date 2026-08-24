import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Tenant Context — AsyncLocalStorage-based propagation.
 *
 * This module provides ambient tenant context that flows through the entire
 * request lifecycle without explicitly passing tenantId to every function.
 *
 * Usage:
 *   - Middleware sets context via `runWithTenant(tenantId, callback)`
 *   - Prisma extension reads it via `getCurrentTenantId()`
 *   - Services never need to know about tenants — it's automatic
 *
 * Why AsyncLocalStorage?
 *   - Node.js native (no deps)
 *   - Works across async/await boundaries
 *   - Each request gets its own isolated context (no race conditions)
 *   - Works inside Prisma $transaction() calls
 */

interface TenantStore {
  tenantId: string;
}

const tenantStorage = new AsyncLocalStorage<TenantStore>();

/**
 * Run a callback within a tenant context.
 * All async operations within the callback will have access to the tenantId.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run({ tenantId }, fn);
}

/**
 * Get the current tenant ID from the async context.
 * Returns undefined if called outside of a tenant context (e.g., during migrations, seeds, or admin operations).
 */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}

/**
 * Get the current tenant ID or throw an error.
 * Use this in contexts where a tenant MUST exist (protected routes).
 */
export function requireTenantId(): string {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error(
      'Tenant context not available. This operation requires a tenant context. ' +
      'Ensure the tenantContext middleware is applied before this code runs.'
    );
  }
  return tenantId;
}
