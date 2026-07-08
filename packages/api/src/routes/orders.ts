import { Router } from 'express';
import { orderService } from '../services/orderService';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { tableId, type } = req.body;
    const order = await orderService.createOrder(req.userId!, tableId, type);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { productId, quantity, notes } = req.body;
    const item = await orderService.addOrderItem(id, productId, quantity, notes);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/send', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderService.sendToKitchen(id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.get('/active', async (req, res, next) => {
  try {
    const orders = await orderService.getActiveOrders();
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// --- ESTA ES LA RUTA NUEVA ---
router.patch('/:id/pay', async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderService.closeOrder(id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

export default router;