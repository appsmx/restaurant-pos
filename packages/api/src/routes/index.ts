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
import { menuService } from '../services/menuService';

const router = Router();

// ==================== PUBLIC ROUTES (no auth) ====================

// GET /api/public/menu — menú digital para clientes (QR)
router.get('/public/menu', async (req, res, next) => {
  try {
    const categories = await menuService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/config — nombre del restaurante para el menú público
router.get('/public/config', async (req, res, next) => {
  try {
    const { prisma } = require('../lib/prisma');
    const config = await prisma.restaurantConfig.findUnique({ where: { id: 'main' } });
    res.json({ name: config?.name || 'Restaurante', phone: config?.phone || null });
  } catch (error) {
    next(error);
  }
});

// ==================== PROTECTED ROUTES ====================

router.use('/auth', authRoutes);
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

export default router;
