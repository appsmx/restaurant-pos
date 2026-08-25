import { Router } from 'express';
import { auth } from '../middleware/auth';
import { TenantAwareRequest } from '../middleware/moduleGuard';
import { MODULE_REGISTRY, getModulesForBusinessType, isModuleEnabled, isPlanSufficient } from '../lib/modules';
import { resolveTerminology } from '../lib/terminology';

/**
 * Tenant Config Routes
 *
 * Provides the frontend with everything it needs to adapt the UI
 * to the current tenant: modules, terminology, branding, plan info.
 *
 * GET /api/tenant/config — public (only needs tenant context, no auth)
 *   Returns: modules, terminology, branding for the resolved tenant.
 *   Used by the frontend on initial load to configure the UI.
 *
 * GET /api/tenant/modules — authenticated
 *   Returns: detailed module list with enabled/disabled/locked status.
 *   Used by admin/settings pages to show what's available.
 */

const router = Router();

/**
 * GET /api/tenant/config
 *
 * Returns the full tenant configuration needed by the frontend.
 * Does NOT require authentication — only requires tenant context
 * (resolved by resolveTenant middleware from URL/header).
 *
 * This endpoint is called on app load to know:
 *   - What modules to show in the sidebar
 *   - What terms to use (mesa vs silla vs mostrador)
 *   - Business name, logo, colors
 *   - Plan level (for upgrade prompts)
 */
router.get('/config', (req: TenantAwareRequest, res) => {
  const tenant = req.tenant;

  // No tenant context (dev mode) — return a generic config
  if (!tenant) {
    return res.json({
      tenant: null,
      modules: MODULE_REGISTRY.filter(m => m.core).map(m => ({
        id: m.id,
        label: m.label,
        icon: m.icon,
        enabled: true,
      })),
      terminology: resolveTerminology('RESTAURANT'),
      message: 'No tenant context — returning defaults (development mode)',
    });
  }

  // Resolve terminology (defaults + tenant overrides)
  const config = (tenant.config || {}) as Record<string, any>;
  const terminology = resolveTerminology(
    tenant.businessType as any,
    config.terminology,
  );

  // Build module list with status for this tenant
  const availableModules = getModulesForBusinessType(tenant.businessType as any);
  const modules = availableModules.map(m => ({
    id: m.id,
    label: m.label,
    description: m.description,
    icon: m.icon,
    core: m.core,
    enabled: m.core || isModuleEnabled(m.id, tenant.enabledModules),
    locked: !isPlanSufficient(tenant.plan, m.minimumPlan),
    minimumPlan: m.minimumPlan,
  }));

  res.json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      businessType: tenant.businessType,
      plan: tenant.plan,
      logoUrl: config.logoUrl || null,
      colors: config.colors || null,
    },
    modules,
    terminology,
  });
});

/**
 * GET /api/tenant/modules
 *
 * Authenticated endpoint — returns detailed module information including
 * which modules could be enabled (for admin/settings UI).
 */
router.get('/modules', auth, (req: TenantAwareRequest, res) => {
  const tenant = req.tenant;

  if (!tenant) {
    return res.status(400).json({
      error: 'Tenant context required',
    });
  }

  const allModules = getModulesForBusinessType(tenant.businessType as any);

  const modules = allModules.map(m => ({
    id: m.id,
    label: m.label,
    description: m.description,
    icon: m.icon,
    core: m.core,
    enabled: m.core || isModuleEnabled(m.id, tenant.enabledModules),
    locked: !isPlanSufficient(tenant.plan, m.minimumPlan),
    minimumPlan: m.minimumPlan,
    routePrefixes: m.routePrefixes,
  }));

  // Also show modules NOT available for this business type (for awareness)
  const unavailable = MODULE_REGISTRY
    .filter(m => !m.availableFor.includes(tenant.businessType as any))
    .map(m => ({
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      availableFor: m.availableFor,
      reason: `No disponible para tipo "${tenant.businessType}"`,
    }));

  res.json({
    enabled: modules.filter(m => m.enabled),
    disabled: modules.filter(m => !m.enabled && !m.locked),
    locked: modules.filter(m => m.locked),
    unavailable,
    currentPlan: tenant.plan,
  });
});

export default router;
