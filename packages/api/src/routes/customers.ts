import { Router } from 'express';
import { customerService } from '../services/customerService';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);

const createCustomerSchema = z.object({
  firstName: z.string().min(1, 'El nombre es obligatorio'),
  lastName: z.string().min(1, 'El apellido es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  birthday: z.string().optional(),
  notes: z.string().optional(),
});

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  birthday: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/customers?search=
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const customers = await customerService.getAll(search as string | undefined);
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.id);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// POST /api/customers
router.post('/', validate(createCustomerSchema), async (req, res, next) => {
  try {
    const customer = await customerService.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/customers/:id
router.patch('/:id', validate(updateCustomerSchema), async (req, res, next) => {
  try {
    const customer = await customerService.update(req.params.id, req.body);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// POST /api/customers/:id/visit — registrar visita + gasto
router.post('/:id/visit', async (req, res, next) => {
  try {
    const { amount } = req.body;
    const customer = await customerService.addVisit(req.params.id, amount || 0);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// POST /api/customers/:id/redeem — canjear puntos
router.post('/:id/redeem', async (req, res, next) => {
  try {
    const { points } = req.body;
    const customer = await customerService.redeemPoints(req.params.id, points);
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id/history — historial de compras del cliente
router.get('/:id/history', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const data = await customerService.getPurchaseHistory(
      req.params.id,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 15
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
