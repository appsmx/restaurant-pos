import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Tenant Context — AsyncLocalStorage-based propagation.
 * Provides ambient tenant context that flows through the entire request lifecycle.
 */

interface TenantStore {
  tenantId: string;
}

const tenantStorage = new AsyncLocalStorage<TenantStore>();

/** Run a callback within a tenant context. */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run({ tenantId }, fn);
}

/** Get the current tenant ID from async context. Returns undefined if not set. */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}
