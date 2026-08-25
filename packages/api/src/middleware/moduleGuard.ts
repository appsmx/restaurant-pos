import { Request, Response, NextFunction } from 'express';
import { getModuleForRoute, isModuleEnabled, isPlanSufficient } from '../lib/modules';

/**
 * Extended Request interface that includes tenant info.
 * Compatible with the resolveTenant middleware (Phase 3) when available.
 */
export interface TenantAwareRequest extends Request {
  tenant?: {
    id: string;
    slug: string;
    name: string;
    active: boolean;
    businessType: string;
    plan: string;
    enabledModules: string[];
    config: any;
  };
  tenantId?: string;
  tenantSlug?: string;
}

/**
 * Module Guard Middleware
 *
 * Checks whether the tenant has the required module enabled for the
 * requested route. If not, returns 403 with a clear error message.
 *
 * How it works:
 *   1. Looks up which module controls the current route (via routePrefixes)
 *   2. Checks if that module is in the tenant's enabledModules[]
 *   3. Checks if the tenant's plan meets the module's minimumPlan requirement
 *   4. If both pass → next(). Otherwise → 403.
 *
 * Core modules (pos, users, config, reports, cash) always pass — they
 * cannot be disabled.
 *
 * If no module is found for the route, it passes through (unguarded routes).
 * If no tenant context exists (dev mode), it passes through.
 *
 * Usage:
 *   // Apply to all protected routes (after auth + tenantContext)
 *   protectedRouter.use(moduleGuard);
 *
 *   // Or per-route for explicit control:
 *   router.get('/kitchen/orders', moduleGuard, handler);
 */
export const moduleGuard = (
  req: TenantAwareRequest,
  res: Response,
  next: NextFunction
) => {
  // No tenant context (dev mode / backward compat) → pass through
  if (!req.tenant) {
    return next();
  }

  // Determine which route prefix we're on
  // req.path gives us the path relative to where the router is mounted
  // e.g., for /api/kitchen/orders mounted at /api, req.path = /kitchen/orders
  const routePath = req.path || req.url;

  // Find which module this route belongs to
  const module = getModuleForRoute(routePath);

  // No module controls this route → pass through (unguarded)
  if (!module) {
    return next();
  }

  // Core modules always pass
  if (module.core) {
    return next();
  }

  // Check if the module is enabled for this tenant
  const enabled = isModuleEnabled(module.id, req.tenant.enabledModules);
  if (!enabled) {
    return res.status(403).json({
      error: 'Módulo no disponible',
      module: module.id,
      label: module.label,
      message: `El módulo "${module.label}" no está habilitado para tu negocio.`,
      hint: 'Contacta al administrador para activar este módulo.',
    });
  }

  // Check if the tenant's plan is sufficient
  if (!isPlanSufficient(req.tenant.plan, module.minimumPlan)) {
    return res.status(403).json({
      error: 'Plan insuficiente',
      module: module.id,
      label: module.label,
      currentPlan: req.tenant.plan,
      requiredPlan: module.minimumPlan,
      message: `El módulo "${module.label}" requiere el plan ${module.minimumPlan} o superior.`,
      hint: 'Actualiza tu plan para acceder a esta funcionalidad.',
    });
  }

  // All checks passed
  next();
};

/**
 * Creates a module guard for a specific module ID.
 * Use this when you want to explicitly guard a route for a known module,
 * regardless of the route prefix mapping.
 *
 * Usage:
 *   router.use(requireModule('kitchen'));
 */
export function requireModule(moduleId: string) {
  return (req: TenantAwareRequest, res: Response, next: NextFunction) => {
    // No tenant context → pass through
    if (!req.tenant) {
      return next();
    }

    const enabled = isModuleEnabled(moduleId, req.tenant.enabledModules);
    if (!enabled) {
      return res.status(403).json({
        error: 'Módulo no disponible',
        module: moduleId,
        message: `Este módulo no está habilitado para tu negocio.`,
        hint: 'Contacta al administrador para activar este módulo.',
      });
    }

    next();
  };
}
