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
  tip: z.number().min(0).optional().nullable(),
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
    const { productId, quantity, notes, modifiers } = req.body;
    const item = await orderService.addOrderItem(id, productId, quantity, notes, req.userId, modifiers);
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
    const { method, customerId, discount, tip } = req.body;
    const order = await orderService.closeOrder(id, req.userId!, method, customerId || undefined, discount || undefined, tip || undefined);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/split-pay — pago parcial (división de cuenta)
const splitPaySchema = z.object({
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']).default('CASH'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  tip: z.number().min(0).optional().nullable(),
  label: z.string().optional(), // "Persona 1", "Juan", etc.
});

router.post('/:id/split-pay', validate(splitPaySchema), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { method, amount, tip, label } = req.body;
    const result = await orderService.splitPay(id, req.userId!, method, amount, tip || 0, label);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id — order detail with timeline
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Validate UUID format to avoid catching non-order routes
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, message: 'ID de orden inválido. Debe ser un UUID.' });
    }
    const order = await orderService.getOrderDetail(id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/orders/:id/items/:itemId — cancelar/quitar un item de la orden
router.delete('/:id/items/:itemId', async (req: AuthRequest, res, next) => {
  try {
    const { id, itemId } = req.params;
    const result = await orderService.cancelItem(id, itemId, req.userId!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/reopen — reabrir orden cerrada (revertir cobro)
router.patch('/:id/reopen', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const result = await orderService.reopenOrder(id, req.userId!);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
