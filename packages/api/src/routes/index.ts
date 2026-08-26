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
import modifierRoutes from './modifiers';
import reservationRoutes from './reservations';
import tenantRoutes from './tenant';
import adminRoutes from './admin';
import importRoutes from './import';
import aiRoutes from './ai';
import { menuService } from '../services/menuService';
import { prisma } from '../lib/prisma';
import { moduleGuard } from '../middleware/moduleGuard';

const router = Router();

// ==================== PUBLIC ROUTES (no auth) ====================

// GET /api/public/menu?slug=quiroa — menú digital para clientes (QR)
router.get('/public/menu', async (req, res, next) => {
  try {
    const { slug } = req.query;
    if (slug) {
      const { runWithTenant } = require('../lib/tenantContext');
      const tenant = await prisma.tenant.findUnique({ where: { slug: slug as string } });
      if (!tenant || !tenant.active) {
        return res.status(404).json({ message: 'Negocio no encontrado' });
      }
      const categories = await new Promise((resolve, reject) => {
        runWithTenant(tenant.id, async () => {
          try { resolve(await menuService.getCategories()); }
          catch (e: any) { reject(e); }
        });
      });
      return res.json(categories);
    }
    // No slug — unscoped (backward compat for single-tenant)
    const categories = await menuService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/config?slug=quiroa — nombre del restaurante para el menú público
router.get('/public/config', async (req, res, next) => {
  try {
    const { slug } = req.query;
    if (slug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: slug as string } });
      if (!tenant || !tenant.active) {
        return res.status(404).json({ message: 'Negocio no encontrado' });
      }
      const config = await prisma.restaurantConfig.findFirst({ where: { tenantId: tenant.id } });
      return res.json({ name: config?.name || tenant.name, phone: config?.phone || null, slug: tenant.slug });
    }
    // No slug — unscoped (backward compat)
    const config = await prisma.restaurantConfig.findUnique({ where: { id: 'main' } });
    res.json({ name: config?.name || 'Restaurante', phone: config?.phone || null });
  } catch (error) {
    next(error);
  }
});

// ==================== TENANT CONFIG (public — only needs tenant context) ====================

router.use('/tenant', tenantRoutes);

// ==================== PROTECTED ROUTES ====================
// moduleGuard runs on all protected routes — checks if the tenant has
// the required module enabled for the requested route prefix.
// Core modules (pos, users, config, reports, cash) always pass.

router.use('/auth', authRoutes);

// Apply moduleGuard to all feature routes below.
// It checks req.tenant.enabledModules against the route prefix.
router.use(moduleGuard);

router.use('/menu', menuRoutes);
router.use('/floorplan', floorPlanRoutes);
router.use('/orders', orderRoutes);
router.use('/reports', reportRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/users', userRoutes);
router.use('/kitchen', kitchenRoutes);
router.use('/cash', cashRoutes);
router.use('/customers', customerRoutes);
router.use('/config', configRoutes);
router.use('/modifiers', modifierRoutes);
router.use('/reservations', reservationRoutes);
router.use('/ai', aiRoutes);

// ==================== ADMIN PANEL (auth + ADMIN role enforced internally) ====================
router.use('/admin', adminRoutes);

// ==================== IMPORT (auth + ADMIN) ====================
router.use('/import', importRoutes);

export default router;
