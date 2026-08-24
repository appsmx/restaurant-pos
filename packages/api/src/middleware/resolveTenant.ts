import { Request, Response, NextFunction } from 'express';
import {
  extractSlugFromRequest,
  resolveTenantBySlug,
  ResolvedTenant,
} from '../lib/tenantResolver';
import { runWithTenant } from '../lib/tenantContext';

/**
 * Resolve Tenant Middleware
 *
 * Runs BEFORE auth. Detects the tenant from the incoming request using:
 *   1. X-Tenant-Slug header
 *   2. Subdomain (quiroa.logancorp.mx)
 *   3. Path prefix (/t/quiroa/...)
 *
 * If a tenant is resolved, it:
 *   - Sets req.tenant (full tenant object)
 *   - Sets req.tenantId (shortcut)
 *   - Wraps the rest of the request in runWithTenant() so Prisma auto-filters
 *   - Strips the /t/:slug prefix from req.url so downstream routes work normally
 *
 * If NO tenant slug is found in the request:
 *   - In production: returns 400 (every request must be tenant-scoped)
 *   - In development (ALLOW_NO_TENANT=true): passes through without tenant
 *     context (backward compat for local dev without subdomains)
 *
 * If slug is found but doesn't match a tenant or tenant is inactive:
 *   - Returns 404 or 403 respectively
 */

// Extend Express Request to carry tenant info
export interface TenantAwareRequest extends Request {
  tenant?: ResolvedTenant;
  tenantId?: string;
  tenantSlug?: string;
}

/**
 * Main tenant resolution middleware.
 * Apply this globally (before auth) on the Express app or router.
 */
export const resolveTenant = async (
  req: TenantAwareRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const hostname = req.hostname || req.headers.host || '';
    const path = req.originalUrl || req.url;
    const tenantHeader = req.headers['x-tenant-slug'] as string | undefined;

    const slug = extractSlugFromRequest(hostname, path, tenantHeader);

    // No slug found in the request
    if (!slug) {
      // In development or when explicitly allowed, pass through without tenant.
      // This enables backward compat: existing Quiroa deploy on the old URL
      // continues working until subdomain/path routing is fully set up.
      const allowNoTenant = process.env.ALLOW_NO_TENANT === 'true' ||
                            process.env.NODE_ENV === 'development' ||
                            !process.env.NODE_ENV;

      if (allowNoTenant) {
        // No tenant context — Prisma extension will run queries unfiltered.
        // This is fine for single-tenant backward compat (Quiroa only).
        return next();
      }

      return res.status(400).json({
        error: 'No se pudo determinar el negocio.',
        hint: 'Accede via subdominio (quiroa.logancorp.mx), path (/t/quiroa/), o header (X-Tenant-Slug).',
      });
    }

    // Slug found — resolve from DB (with cache)
    const tenant = await resolveTenantBySlug(slug);

    if (!tenant) {
      return res.status(404).json({
        error: 'Negocio no encontrado.',
        slug,
      });
    }

    if (!tenant.active) {
      return res.status(403).json({
        error: 'Este negocio no está activo actualmente.',
        slug,
      });
    }

    // Attach tenant info to the request
    req.tenant = tenant;
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;

    // If the slug came from a path prefix (/t/quiroa/api/...), strip it
    // so downstream routes see /api/... as expected.
    if (path.match(/^\/t\/[a-z0-9_-]+\//i)) {
      const stripped = path.replace(/^\/t\/[a-z0-9_-]+/i, '');
      req.url = stripped || '/';
    }

    // Wrap the rest of the request lifecycle in tenant context
    // so Prisma auto-filtering kicks in for all downstream queries.
    runWithTenant(tenant.id, () => {
      next();
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Optional: strict tenant requirement middleware.
 * Use this on routes that MUST have a tenant (rejects if missing).
 * Useful for routes where ALLOW_NO_TENANT=true but you still want enforcement.
 */
export const requireTenant = (
  req: TenantAwareRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'Se requiere contexto de negocio para esta operación.',
      hint: 'Accede via subdominio, path prefix, o header X-Tenant-Slug.',
    });
  }
  next();
};
