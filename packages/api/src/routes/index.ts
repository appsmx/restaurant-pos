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

const router = Router();

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

export default router;
