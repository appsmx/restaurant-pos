import { Router } from 'express';
import { orderService } from '../services/orderService';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, addOrderItemSchema, payOrderSchema } from '../lib/validators';

const router = Router();
router.use(auth);

router.post('/', validate(createOrderSchema), async (req: AuthRequest, res, next) => {
  try {
    const { tableId, type } = req.body;
    const order = await orderService.createOrder(req.userId!, tableId, type);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items', validate(addOrderItemSchema), async (req, res, next) => {
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

router.patch('/:id/pay', validate(payOrderSchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { method, customerId } = req.body;
    const order = await orderService.closeOrder(id, req.userId!, method, customerId);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
