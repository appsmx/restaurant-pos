import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';
import { runWithTenant } from '../lib/tenantContext';

/**
 * Tenant Context Middleware
 *
 * Resolves the tenant for the current request and wraps the entire
 * downstream handler chain inside a tenant-scoped AsyncLocalStorage context.
 *
 * How it resolves the tenant:
 *   1. Looks up the authenticated user's tenantId from the DB
 *      (req.userId is set by the auth middleware that runs before this)
 *   2. Sets req.tenantId for explicit access in route handlers
 *   3. Wraps `next()` inside `runWithTenant()` so all downstream code
 *      (including Prisma queries) automatically gets tenant filtering
 *
 * Prerequisites:
 *   - Must run AFTER the `auth` middleware (needs req.userId)
 *   - The User model must have a `tenantId` field (Phase 1 schema)
 *
 * For public routes (no auth), use `publicTenantContext` instead,
 * which resolves tenant from slug/subdomain.
 */

// Extend AuthRequest to include tenantId
export interface TenantRequest extends AuthRequest {
  tenantId?: string;
}

/**
 * Tenant context for authenticated routes.
 * Resolves tenant from the authenticated user's record.
 */
export const tenantContext = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      // If no userId, auth middleware didn't run or user isn't authenticated.
      // Let the request proceed without tenant context (will be caught by auth).
      return next();
    }

    // Look up the user's tenant. We use the base query here (no extension)
    // because we need to find the user WITHOUT tenant filtering (chicken-and-egg).
    // The Prisma extension gracefully handles this: when no tenant context is set
    // in AsyncLocalStorage, queries run unfiltered.
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { tenantId: true },
    });

    if (!user || !user.tenantId) {
      return res.status(403).json({
        error: 'Usuario no asociado a ningún negocio.',
        hint: 'Contacta al administrador para asignarte a un tenant.',
      });
    }

    // Set tenantId on request for explicit access in route handlers
    req.tenantId = user.tenantId;

    // Wrap the rest of the request lifecycle in the tenant context.
    // This makes getCurrentTenantId() available everywhere downstream.
    runWithTenant(user.tenantId, () => {
      next();
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Tenant context for public routes (no auth required).
 * Resolves tenant from URL slug parameter.
 *
 * Usage in routes:
 *   router.get('/public/:slug/menu', publicTenantContext, handler)
 *
 * This will be fully implemented in Phase 3 (tenant resolution by URL/subdomain).
 * For now, it provides the interface.
 */
export const publicTenantContext = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const slug = req.params.slug;

    if (!slug) {
      return res.status(400).json({
        error: 'Slug de negocio no proporcionado.',
      });
    }

    // Look up tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, active: true },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Negocio no encontrado.',
      });
    }

    if (!tenant.active) {
      return res.status(403).json({
        error: 'Este negocio no está activo actualmente.',
      });
    }

    req.tenantId = tenant.id;

    runWithTenant(tenant.id, () => {
      next();
    });
  } catch (error) {
    next(error);
  }
};
