import { Router } from 'express';
import { reportService } from '../services/reportService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN', 'MANAGER'));

// GET /api/reports/summary?period=today|week|month|custom&from=2026-08-01&to=2026-08-20
router.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const { period, from, to } = req.query;
    const summary = await reportService.getSummary(
      (period as string) || 'today',
      from as string | undefined,
      to as string | undefined
    );
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/by-employee?period=today&from=&to=
router.get('/by-employee', async (req: AuthRequest, res, next) => {
  try {
    const { period, from, to } = req.query;
    const data = await reportService.getByEmployee(
      (period as string) || 'today',
      from as string | undefined,
      to as string | undefined
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/by-product?period=today&from=&to=
router.get('/by-product', async (req: AuthRequest, res, next) => {
  try {
    const { period, from, to } = req.query;
    const data = await reportService.getByProduct(
      (period as string) || 'today',
      from as string | undefined,
      to as string | undefined
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/history?page=1&limit=20&from=2026-08-01&to=2026-08-20
router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const { page, limit, from, to } = req.query;
    const data = await reportService.getOrderHistory(
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20,
      from as string | undefined,
      to as string | undefined
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/daily — ventas por día (últimos 7 días, para gráficas)
router.get('/daily', async (req: AuthRequest, res, next) => {
  try {
    const data = await reportService.getDailyBreakdown();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/order/:id — detalle completo de una orden (para timeline)
router.get('/order/:id', async (req: AuthRequest, res, next) => {
  try {
    const { prisma } = require('../lib/prisma');

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: { select: { name: true, price: true } } } },
        table: { select: { name: true } },
        user: { select: { id: true, name: true, role: true } },
        closedBy: { select: { id: true, name: true, role: true } },
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Try to fetch events (table may not exist)
    let events: any[] = [];
    try {
      events = await (prisma as any).orderEvent.findMany({
        where: { orderId: req.params.id },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      // OrderEvent table may not exist yet
    }

    res.json({ ...order, events });
  } catch (error) {
    next(error);
  }
});

export default router;
