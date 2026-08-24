import { Router } from 'express';
import { reservationService } from '../services/reservationService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN', 'MANAGER', 'WAITER'));

// ==================== SCHEMAS ====================

const createReservationSchema = z.object({
  customerName: z.string().min(1, 'El nombre del cliente es obligatorio'),
  phone: z.string().optional(),
  date: z.string().min(1, 'La fecha es obligatoria'), // ISO date string
  time: z.string().regex(/^\d{2}:\d{2}$/, 'El formato de hora debe ser HH:MM'),
  guests: z.number().int().positive('Debe haber al menos 1 comensal'),
  tableId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
});

const updateReservationSchema = z.object({
  customerName: z.string().min(1).optional(),
  phone: z.string().optional(),
  date: z.string().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  guests: z.number().int().positive().optional(),
  tableId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  status: z.enum(['CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
});

// ==================== ROUTES ====================

// GET /api/reservations — list reservations (with optional date filter)
router.get('/', async (req, res, next) => {
  try {
    const { date, status } = req.query;
    const reservations = await reservationService.getAll({
      date: date as string | undefined,
      status: status as string | undefined,
    });
    res.json(reservations);
  } catch (error) {
    next(error);
  }
});

// GET /api/reservations/today — active reservations for today
router.get('/today', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const reservations = await reservationService.getByDate(today);
    res.json(reservations);
  } catch (error) {
    next(error);
  }
});

// GET /api/reservations/reserved-tables — reserved table IDs for floor plan
router.get('/reserved-tables', async (req, res, next) => {
  try {
    const { date } = req.query;
    const tables = await reservationService.getReservedTableIds(date as string | undefined);
    res.json(tables);
  } catch (error) {
    next(error);
  }
});

// GET /api/reservations/:id — single reservation
router.get('/:id', async (req, res, next) => {
  try {
    const reservation = await reservationService.getById(req.params.id);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
});

// POST /api/reservations — create reservation
router.post('/', validate(createReservationSchema), async (req: AuthRequest, res, next) => {
  try {
    const reservation = await reservationService.create(req.body);
    res.status(201).json(reservation);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reservations/:id — update reservation
router.patch('/:id', validate(updateReservationSchema), async (req: AuthRequest, res, next) => {
  try {
    const reservation = await reservationService.update(req.params.id, req.body);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reservations/:id/cancel — cancel reservation
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const reservation = await reservationService.cancel(req.params.id);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reservations/:id/seat — mark as seated
router.patch('/:id/seat', async (req, res, next) => {
  try {
    const reservation = await reservationService.markSeated(req.params.id);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reservations/:id/complete — mark as completed
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const reservation = await reservationService.markCompleted(req.params.id);
    res.json(reservation);
  } catch (error) {
    next(error);
  }
});

export default router;
