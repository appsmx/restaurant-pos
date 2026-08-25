import { Router } from 'express';
import { kitchenService } from '../services/kitchenService';
import { auth } from '../middleware/auth';

const router = Router();
router.use(auth);

// GET /api/kitchen?destination=KITCHEN|BAR — cola filtrada por destino
router.get('/', async (req, res, next) => {
  try {
    const destination = req.query.destination as string | undefined;
    const queue = await kitchenService.getKitchenQueue(destination);
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

// PATCH /api/kitchen/order/:orderId/ready?destination=BAR|KITCHEN
router.patch('/order/:orderId/ready', async (req, res, next) => {
  try {
    const destination = req.query.destination as string | undefined;
    const result = await kitchenService.markOrderReady(req.params.orderId, destination);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/kitchen/completed — órdenes completadas recientemente
router.get('/completed', async (req, res, next) => {
  try {
    const data = await kitchenService.getRecentlyCompleted();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
