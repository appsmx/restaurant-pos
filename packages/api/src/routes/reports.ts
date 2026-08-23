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

export default router;
