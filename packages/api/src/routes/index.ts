import { Router } from 'express';
import authRoutes from './auth';
import menuRoutes from './menu';
import floorPlanRoutes from './floorPlan';
import orderRoutes from './orders';
import reportRoutes from './reports';
import inventoryRoutes from './inventory';

const router = Router();

router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/floorplan', floorPlanRoutes);
router.use('/orders', orderRoutes);
router.use('/reports', reportRoutes);
router.use('/inventory', inventoryRoutes);

export default router;
