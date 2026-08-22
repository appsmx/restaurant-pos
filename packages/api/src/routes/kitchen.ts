import { Router } from 'express';
import { kitchenService } from '../services/kitchenService';
import { auth } from '../middleware/auth';

const router = Router();
router.use(auth);

// GET /api/kitchen — obtener la cola de cocina (items pendientes/preparando)
router.get('/', async (req, res, next) => {
  try {
    const queue = await kitchenService.getKitchenQueue();
    res.json(queue);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/kitchen/:itemId/preparing — cocinero empieza a preparar
router.patch('/:itemId/preparing', async (req, res, next) => {
  try {
    const item = await kitchenService.startPreparing(req.params.itemId);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/kitchen/:itemId/ready — item listo para servir
router.patch('/:itemId/ready', async (req, res, next) => {
  try {
    const item = await kitchenService.markReady(req.params.itemId);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/kitchen/order/:orderId/ready — toda la orden lista
router.patch('/order/:orderId/ready', async (req, res, next) => {
  try {
    const result = await kitchenService.markOrderReady(req.params.orderId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
