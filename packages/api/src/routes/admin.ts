import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { auth, AuthRequest } from '../middleware/auth';
import { getDefaultModules } from '../lib/modules';
import bcrypt from 'bcrypt';

/**
 * Admin Routes — Logan Admin Panel API
 *
 * These endpoints are used by Logan administrators (YOU) to manage tenants,
 * create new businesses, toggle modules, view metrics, etc.
 *
 * Protected by auth + ADMIN role check.
 * In the future, these could be further protected by a "super admin" flag
 * or a separate admin authentication system.
 *
 * Base path: /api/admin/...
 */

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(auth);
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Se requiere rol ADMIN para acceder al panel de administración.',
    });
  }
  next();
});

// ==================== TENANT CRUD ====================

/**
 * GET /api/admin/tenants — List all tenants
 */
router.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        businessType: true,
        plan: true,
        active: true,
        enabledModules: true,
        setupPaid: true,
        monthlyRate: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            orders: true,
            products: true,
          },
        },
      },
    });

    res.json({
      tenants,
      total: tenants.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/tenants/:id — Get tenant details
 */
router.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        users: {
          select: { id: true, username: true, name: true, role: true, active: true },
        },
        _count: {
          select: {
            orders: true,
            products: true,
            customers: true,
            categories: true,
          },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/tenants — Create a new tenant (ONBOARDING)
 *
 * This is the core onboarding endpoint. Creates:
 *   1. The Tenant record
 *   2. A RestaurantConfig record
 *   3. An admin user for the new tenant
 *
 * Body: {
 *   slug: string,
 *   name: string,
 *   businessType: "RESTAURANT" | "BARBERSHOP" | "CAFE" | "STORE" | "GENERAL",
 *   plan: "STARTER" | "GROWTH" | "PRO",
 *   adminUsername: string,
 *   adminPassword: string,
 *   adminName: string,
 *   phone?: string,
 *   address?: string,
 * }
 */
router.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      slug,
      name,
      businessType = 'RESTAURANT',
      plan = 'STARTER',
      adminUsername,
      adminPassword,
      adminName,
      phone,
      address,
    } = req.body;

    // Validate required fields
    if (!slug || !name || !adminUsername || !adminPassword || !adminName) {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        required: ['slug', 'name', 'adminUsername', 'adminPassword', 'adminName'],
      });
    }

    // Validate slug format
    if (!/^[a-z0-9_-]{2,50}$/.test(slug)) {
      return res.status(400).json({
        error: 'Slug inválido',
        hint: 'Solo letras minúsculas, números, guiones y guiones bajos (2-50 chars)',
      });
    }

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({
        error: 'Este slug ya está en uso',
        slug,
      });
    }

    // Get default modules for the business type
    const enabledModules = getDefaultModules(businessType);

    // Hash the admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create tenant + config + admin user in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          businessType,
          plan,
          active: true,
          enabledModules,
          config: {},
          setupFee: plan === 'PRO' ? 5000 : plan === 'GROWTH' ? 4000 : 3000,
          monthlyRate: plan === 'PRO' ? 1500 : plan === 'GROWTH' ? 1000 : 500,
        },
      });

      // 2. Create business config
      await tx.restaurantConfig.create({
        data: {
          tenantId: tenant.id,
          name,
          phone: phone || null,
          address: address || null,
        },
      });

      // 3. Create admin user for the new tenant
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          username: adminUsername,
          password: hashedPassword,
          name: adminName,
          role: 'ADMIN',
          active: true,
        },
      });

      return { tenant, adminUser };
    });

    res.status(201).json({
      message: 'Tenant creado exitosamente',
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        businessType: result.tenant.businessType,
        plan: result.tenant.plan,
        enabledModules: result.tenant.enabledModules,
      },
      adminUser: {
        id: result.adminUser.id,
        username: result.adminUser.username,
        name: result.adminUser.name,
      },
      accessUrl: `https://${slug}.logancorp.mx`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/tenants/:id — Update tenant (toggle active, change plan, modules)
 */
router.patch('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { active, plan, enabledModules, name, monthlyRate, setupPaid } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    const updateData: Record<string, any> = {};
    if (active !== undefined) updateData.active = active;
    if (plan !== undefined) updateData.plan = plan;
    if (enabledModules !== undefined) updateData.enabledModules = enabledModules;
    if (name !== undefined) updateData.name = name;
    if (monthlyRate !== undefined) updateData.monthlyRate = monthlyRate;
    if (setupPaid !== undefined) updateData.setupPaid = setupPaid;

    const updated = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: 'Tenant actualizado',
      tenant: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/tenants/:id/toggle-module — Enable/disable a module
 */
router.post('/tenants/:id/toggle-module', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { moduleId, enabled } = req.body;

    if (!moduleId || typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Se requiere moduleId (string) y enabled (boolean)',
      });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    let modules = [...tenant.enabledModules];
    if (enabled && !modules.includes(moduleId)) {
      modules.push(moduleId);
    } else if (!enabled) {
      modules = modules.filter((m: string) => m !== moduleId);
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: { enabledModules: modules },
    });

    res.json({
      message: `Módulo "${moduleId}" ${enabled ? 'activado' : 'desactivado'}`,
      enabledModules: updated.enabledModules,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/tenants/:id — Deactivate a tenant (soft delete)
 * Does NOT delete data — just sets active = false.
 * For hard delete, use a separate script (never via API for safety).
 */
router.delete('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }

    await prisma.tenant.update({
      where: { id },
      data: { active: false },
    });

    res.json({
      message: `Tenant "${tenant.name}" desactivado`,
      hint: 'Los datos no se eliminaron. Para reactivar, usa PATCH con active: true.',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== GLOBAL STATS ====================

/**
 * GET /api/admin/stats — Global stats across all tenants
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [tenantCount, activeCount, totalOrders, totalUsers, totalProducts] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.user.count(),
      prisma.product.count(),
    ]);

    // Revenue calculation (simple: sum of monthlyRate for active tenants)
    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: { monthlyRate: true, setupPaid: true, setupFee: true },
    });
    const monthlyRevenue = tenants.reduce((sum: number, t: any) => sum + (t.monthlyRate || 0), 0);
    const pendingSetups = tenants.filter((t: any) => !t.setupPaid).length;
    const totalSetupRevenue = tenants.filter((t: any) => t.setupPaid).reduce((sum: number, t: any) => sum + (t.setupFee || 0), 0);

    res.json({
      tenants: {
        total: tenantCount,
        active: activeCount,
        inactive: tenantCount - activeCount,
      },
      data: {
        orders: totalOrders,
        users: totalUsers,
        products: totalProducts,
      },
      revenue: {
        monthlyRecurring: monthlyRevenue,
        pendingSetups,
        totalSetupCollected: totalSetupRevenue,
        currency: 'MXN',
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==================== ONBOARDING WIZARD HELPER ====================

/**
 * GET /api/admin/onboarding/check-slug/:slug — Check if a slug is available
 */
router.get('/onboarding/check-slug/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    if (!/^[a-z0-9_-]{2,50}$/.test(slug)) {
      return res.json({ available: false, reason: 'Formato inválido' });
    }

    const existing = await prisma.tenant.findUnique({ where: { slug } });

    res.json({
      available: !existing,
      slug,
      suggestedUrl: `https://${slug}.logancorp.mx`,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
