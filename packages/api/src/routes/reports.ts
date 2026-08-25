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

// GET /api/reports/export?period=month&from=&to= — export ventas a CSV
router.get('/export', async (req: AuthRequest, res, next) => {
  try {
    const { period, from, to } = req.query;
    const { prisma } = require('../lib/prisma');

    // Reuse getDateRange logic
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (period || 'month') {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset, 0, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'custom':
        start = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = to ? new Date((to as string) + 'T23:59:59.999Z') : end;
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    const orders = await prisma.order.findMany({
      where: { status: 'CLOSED', closedAt: { gte: start, lte: end } },
      include: {
        items: { include: { product: { select: { name: true } } } },
        table: { select: { name: true } },
        user: { select: { name: true } },
        closedBy: { select: { name: true } },
        payments: true,
      },
      orderBy: { closedAt: 'asc' },
    });

    // Build CSV
    const header = 'Ticket,Fecha,Hora,Mesa,Mesero,Cajero,Productos,Subtotal,Descuento,Total,Método,Propina\n';
    const rows = orders.map((o: any) => {
      const fecha = o.closedAt ? new Date(o.closedAt).toLocaleDateString('es-MX') : '';
      const hora = o.closedAt ? new Date(o.closedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
      const mesa = o.table?.name || 'Para llevar';
      const mesero = o.user?.name || '';
      const cajero = o.closedBy?.name || mesero;
      const productos = o.items.map((i: any) => `${i.quantity}x ${i.product.name}`).join(' | ');
      const subtotal = (o.subtotal || o.total + (o.discount || 0)).toFixed(2);
      const descuento = (o.discount || 0).toFixed(2);
      const total = o.total.toFixed(2);
      const metodo = o.payments.length > 0 ? o.payments[0].method : '';
      const propina = o.payments.reduce((s: number, p: any) => s + (p.tip || 0), 0).toFixed(2);
      return `${o.ticketNumber},"${fecha}","${hora}","${mesa}","${mesero}","${cajero}","${productos}",${subtotal},${descuento},${total},${metodo},${propina}`;
    }).join('\n');

    const csv = header + rows;
    const filename = `ventas_${(period || 'month')}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/drilldown?date=2026-08-25&productId=xx&employeeId=xx&paymentMethod=CASH&period=today&role=creator
router.get('/drilldown', async (req: AuthRequest, res, next) => {
  try {
    const { date, productId, employeeId, paymentMethod, period, from, to, role } = req.query;
    const result = await reportService.getDrilldown({
      date: date as string | undefined,
      productId: productId as string | undefined,
      employeeId: employeeId as string | undefined,
      paymentMethod: paymentMethod as string | undefined,
      period: period as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      role: role as 'creator' | 'cashier' | undefined,
    });
    res.json(result);
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
