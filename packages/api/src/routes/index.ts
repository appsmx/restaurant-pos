import { Router } from 'express';
import authRoutes from './auth';
import menuRoutes from './menu';
import floorPlanRoutes from './floorPlan';
import orderRoutes from './orders';

const router = Router();

router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/floorplan', floorPlanRoutes);
router.use('/orders', orderRoutes);

export default router;