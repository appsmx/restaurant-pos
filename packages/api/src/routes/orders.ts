import { Router } from 'express';
import { orderService } from '../services/orderService';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, addOrderItemSchema } from '../lib/validators';
import { z } from 'zod';

const router = Router();
router.use(auth);

const payOrderSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']).optional().default('CASH'),
  customerId: z.string().uuid().optional().nullable(),
  discount: z.object({
    amount: z.number().min(0),
    type: z.enum(['PERCENT', 'FIXED']),
    reason: z.string().optional(),
  }).optional().nullable(),
});

router.post('/', validate(createOrderSchema), async (req: AuthRequest, res, next) => {
  try {
    const { tableId, type } = req.body;
    const order = await orderService.createOrder(req.userId!, tableId, type);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items', validate(addOrderItemSchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { productId, quantity, notes } = req.body;
    const item = await orderService.addOrderItem(id, productId, quantity, notes, req.userId);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/send', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderService.sendToKitchen(id, req.userId);
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
    const { method, customerId, discount } = req.body;
    const order = await orderService.closeOrder(id, req.userId!, method, customerId || undefined, discount || undefined);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id — order detail with timeline
router.get('/:id', async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetail(req.params.id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
