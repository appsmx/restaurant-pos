import { Router } from 'express';
import authRoutes from './auth';
import menuRoutes from './menu';
import floorPlanRoutes from './floorPlan';
import orderRoutes from './orders';
import reportRoutes from './reports';
import inventoryRoutes from './inventory';
import userRoutes from './users';
import kitchenRoutes from './kitchen';
import cashRoutes from './cash';
import customerRoutes from './customers';
import configRoutes from './config';
import { menuService } from '../services/menuService';
import { publicTenantContext } from '../middleware/tenantContext';

const router = Router();

// ==================== PUBLIC ROUTES (no auth) ====================

// Public routes with tenant context resolved from slug parameter.
// Phase 3 will add subdomain resolution; for now, slug-based:
//   GET /api/public/:slug/menu
//   GET /api/public/:slug/config
// Legacy routes (without slug) still work for backward compat (Quiroa hardcoded).

// GET /api/public/:slug/menu — menú digital para clientes (QR) with tenant scope
router.get('/public/:slug/menu', publicTenantContext, async (req, res, next) => {
  try {
    const categories = await menuService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/:slug/config — nombre del negocio para el menú público
router.get('/public/:slug/config', publicTenantContext, async (req, res, next) => {
  try {
    const { prisma } = require('../lib/prisma');
    const config = await prisma.restaurantConfig.findFirst();
    res.json({ name: config?.name || 'Mi Negocio', phone: config?.phone || null });
  } catch (error) {
    next(error);
  }
});

// Legacy public routes (no slug — backward compatible for existing Quiroa QR codes)
// These run WITHOUT tenant context, so they return whatever findFirst finds.
// TODO: Remove these once all QR codes are updated to include the slug.
router.get('/public/menu', async (req, res, next) => {
  try {
    const categories = await menuService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

router.get('/public/config', async (req, res, next) => {
  try {
    const { prisma } = require('../lib/prisma');
    const config = await prisma.restaurantConfig.findFirst();
    res.json({ name: config?.name || 'Mi Negocio', phone: config?.phone || null });
  } catch (error) {
    next(error);
  }
});

// ==================== PROTECTED ROUTES ====================
// The resolveTenant middleware runs globally in index.ts (before this router),
// so tenant context is already active when we reach here.
// Auth routes are now tenant-scoped (login is scoped to the tenant's users).

import { auth } from '../middleware/auth';
import { tenantContext } from '../middleware/tenantContext';

// Auth routes: tenant context is already set by resolveTenant (global).
// Login/pin will only find users within the resolved tenant.
router.use('/auth', authRoutes);

// All other protected routes get auth + tenantContext validation.
// tenantContext validates that the authenticated user belongs to the resolved tenant.
const protectedRouter = Router();
protectedRouter.use(auth);
protectedRouter.use(tenantContext);

protectedRouter.use('/menu', menuRoutes);
protectedRouter.use('/floorplan', floorPlanRoutes);
protectedRouter.use('/orders', orderRoutes);
protectedRouter.use('/reports', reportRoutes);
protectedRouter.use('/inventory', inventoryRoutes);
protectedRouter.use('/users', userRoutes);
protectedRouter.use('/kitchen', kitchenRoutes);
protectedRouter.use('/cash', cashRoutes);
protectedRouter.use('/customers', customerRoutes);
protectedRouter.use('/config', configRoutes);

router.use(protectedRouter);

export default router;
