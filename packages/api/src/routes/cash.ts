import { Router } from 'express';
import { cashService } from '../services/cashService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN', 'MANAGER', 'CASHIER'));

// Schemas
const openRegisterSchema = z.object({
  openingAmount: z.number().min(0, 'El monto debe ser 0 o mayor'),
});

const closeRegisterSchema = z.object({
  closingAmount: z.number().min(0, 'El monto debe ser 0 o mayor'),
  notes: z.string().optional(),
});

const addMovementSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'EXPENSE', 'SALE']),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  description: z.string().min(1, 'La descripción es obligatoria'),
});

// GET /api/cash — estado actual de la caja + resumen
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const summary = await cashService.getSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// POST /api/cash/open — abrir caja
router.post('/open', validate(openRegisterSchema), async (req: AuthRequest, res, next) => {
  try {
    const register = await cashService.openRegister(req.body.openingAmount, req.userId!);
    res.status(201).json(register);
  } catch (error) {
    next(error);
  }
});

// POST /api/cash/close — cerrar caja
router.post('/close', validate(closeRegisterSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await cashService.closeRegister(req.body.closingAmount, req.userId!, req.body.notes);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/cash/movement — registrar movimiento (depósito, retiro, gasto)
router.post('/movement', validate(addMovementSchema), async (req: AuthRequest, res, next) => {
  try {
    const { type, amount, description } = req.body;
    const movement = await cashService.addMovement(type, amount, description, req.userId!);
    res.status(201).json(movement);
  } catch (error) {
    next(error);
  }
});

// GET /api/cash/history — historial de cajas cerradas
router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const { limit } = req.query;
    const history = await cashService.getHistory(limit ? parseInt(limit as string) : 10);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;
