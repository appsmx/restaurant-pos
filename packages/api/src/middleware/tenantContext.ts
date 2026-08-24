import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';
import { runWithTenant, getCurrentTenantId } from '../lib/tenantContext';
import { ResolvedTenant } from '../lib/tenantResolver';

/**
 * Tenant Context Middleware (Phase 2 — updated for Phase 3 compatibility)
 *
 * This middleware ensures a tenant context is active for authenticated routes.
 *
 * With Phase 3 (resolveTenant middleware), the tenant is already resolved
 * from the URL BEFORE auth runs. In that case, this middleware simply validates
 * that the authenticated user belongs to the already-resolved tenant.
 *
 * Fallback behavior (Phase 2 compat): If no tenant was resolved from the URL
 * (e.g., development mode with ALLOW_NO_TENANT=true), this middleware resolves
 * the tenant from the authenticated user's DB record (original Phase 2 behavior).
 *
 * Flow:
 *   Phase 3 active:  resolveTenant → auth → tenantContext (validates user ∈ tenant)
 *   Phase 2 compat:  auth → tenantContext (resolves tenant from user record)
 */

// Extend AuthRequest to include tenant fields
export interface TenantRequest extends AuthRequest {
  tenantId?: string;
  tenant?: ResolvedTenant;
  tenantSlug?: string;
}

/**
 * Tenant context for authenticated routes.
 *
 * If resolveTenant already set the tenant context (Phase 3):
 *   - Validates that the user belongs to the resolved tenant
 *   - Rejects with 403 if user is from a different tenant
 *
 * If no tenant context exists yet (Phase 2 fallback / dev mode):
 *   - Resolves tenant from the user's tenantId in the DB
 *   - Wraps downstream in runWithTenant()
 */
export const tenantContext = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.userId) {
      // No authenticated user — let auth middleware handle the rejection.
      return next();
    }

    // Check if tenant was already resolved by resolveTenant middleware (Phase 3)
    const alreadyResolved = getCurrentTenantId();

    if (alreadyResolved) {
      // Tenant already set from URL resolution. Validate that the user belongs
      // to this tenant (prevents using a token from tenant A on tenant B's URL).
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { tenantId: true },
      });

      if (!user) {
        return res.status(401).json({
          error: 'Usuario no encontrado.',
        });
      }

      if (user.tenantId !== alreadyResolved) {
        return res.status(403).json({
          error: 'No tienes acceso a este negocio.',
          hint: 'Tu cuenta pertenece a un negocio diferente.',
        });
      }

      // User belongs to the resolved tenant — all good, context is already active.
      req.tenantId = alreadyResolved;
      return next();
    }

    // Phase 2 fallback: no tenant resolved from URL (dev mode / backward compat).
    // Resolve tenant from the user's record in the DB.
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

    req.tenantId = user.tenantId;

    // Wrap the rest of the request lifecycle in the tenant context.
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
 * NOTE: With Phase 3's resolveTenant middleware running globally,
 * this is now mostly a fallback for explicitly slug-parameterized routes.
 * Most public routes will already have tenant context from resolveTenant.
 */
export const publicTenantContext = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // If tenant was already resolved by resolveTenant middleware, use it
    const alreadyResolved = getCurrentTenantId();
    if (alreadyResolved) {
      req.tenantId = alreadyResolved;
      return next();
    }

    // Fallback: resolve from :slug route parameter
    const slug = req.params.slug;

    if (!slug) {
      return res.status(400).json({
        error: 'Slug de negocio no proporcionado.',
      });
    }

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
