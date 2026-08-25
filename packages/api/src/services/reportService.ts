import { prisma } from '../lib/prisma';

interface DateRange {
  from: Date;
  to: Date;
}

function getDateRange(period: 'today' | 'week' | 'month' | 'custom', from?: string, to?: string): DateRange {
  const now = new Date();
  let start: Date;
  let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (period) {
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
      start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = to ? new Date(to + 'T23:59:59.999Z') : end;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  return { from: start, to: end };
}

export const reportService = {
  /**
   * Resumen general: total ventas, # órdenes, ticket promedio, mejor producto
   */
  getSummary: async (period: string = 'today', from?: string, to?: string) => {
    const range = getDateRange(period as any, from, to);

    const closedOrders = await prisma.order.findMany({
      where: {
        status: 'CLOSED',
        closedAt: { gte: range.from, lte: range.to },
      },
      include: {
        items: { include: { product: true } },
        payments: true,
      },
    });

    const totalSales = closedOrders.reduce((sum, o) => sum + o.total, 0);
    const totalTips = closedOrders.reduce((sum, o) => sum + o.payments.reduce((ps, p) => ps + (p.tip || 0), 0), 0);
    const totalOrders = closedOrders.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Producto más vendido
    const productCounts: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const order of closedOrders) {
      for (const item of order.items) {
        const key = item.productId;
        if (!productCounts[key]) {
          productCounts[key] = { name: item.product.name, quantity: 0, revenue: 0 };
        }
        productCounts[key].quantity += item.quantity;
        productCounts[key].revenue += item.unitPrice * item.quantity;
      }
    }
    const topProduct = Object.values(productCounts).sort((a, b) => b.quantity - a.quantity)[0] || null;

    // Métodos de pago
    const methodCounts: Record<string, { count: number; total: number }> = {};
    for (const order of closedOrders) {
      for (const payment of order.payments) {
        if (!methodCounts[payment.method]) {
          methodCounts[payment.method] = { count: 0, total: 0 };
        }
        methodCounts[payment.method].count += 1;
        methodCounts[payment.method].total += payment.amount;
      }
    }

    return {
      period,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totalSales,
      totalTips,
      totalOrders,
      avgTicket: Math.round(avgTicket * 100) / 100,
      topProduct,
      paymentMethods: methodCounts,
    };
  },

  /**
   * Ventas por empleado — separando quien creó la orden vs quien cobró
   */
  getByEmployee: async (period: string = 'today', from?: string, to?: string) => {
    const range = getDateRange(period as any, from, to);

    const closedOrders = await prisma.order.findMany({
      where: {
        status: 'CLOSED',
        closedAt: { gte: range.from, lte: range.to },
      },
      include: {
        user: { select: { id: true, name: true, username: true, role: true } },
        closedBy: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    // Stats por creador (mesero que tomó la orden)
    const byCreator: Record<string, { name: string; role: string; orders: number; total: number }> = {};
    // Stats por cajero (quien cobró)
    const byCashier: Record<string, { name: string; role: string; orders: number; total: number }> = {};

    for (const order of closedOrders) {
      // Creador
      const creatorKey = order.userId;
      if (!byCreator[creatorKey]) {
        byCreator[creatorKey] = {
          name: order.user.name,
          role: order.user.role,
          orders: 0,
          total: 0,
        };
      }
      byCreator[creatorKey].orders += 1;
      byCreator[creatorKey].total += order.total;

      // Cajero (quien cobró)
      const cashier = order.closedBy || order.user; // fallback: si no hay closedBy, usar el creador
      const cashierKey = cashier.id;
      if (!byCashier[cashierKey]) {
        byCashier[cashierKey] = {
          name: cashier.name,
          role: cashier.role,
          orders: 0,
          total: 0,
        };
      }
      byCashier[cashierKey].orders += 1;
      byCashier[cashierKey].total += order.total;
    }

    const creators = Object.entries(byCreator)
      .map(([id, data]) => ({ id, ...data, avgTicket: Math.round((data.total / data.orders) * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    const cashiers = Object.entries(byCashier)
      .map(([id, data]) => ({ id, ...data, avgTicket: Math.round((data.total / data.orders) * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    return { creators, cashiers };
  },

  /**
   * Productos más vendidos
   */
  getByProduct: async (period: string = 'today', from?: string, to?: string) => {
    const range = getDateRange(period as any, from, to);

    const closedOrders = await prisma.order.findMany({
      where: {
        status: 'CLOSED',
        closedAt: { gte: range.from, lte: range.to },
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    });

    const productStats: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
    for (const order of closedOrders) {
      for (const item of order.items) {
        const key = item.productId;
        if (!productStats[key]) {
          productStats[key] = {
            name: item.product.name,
            category: item.product.category?.name || 'Sin categoría',
            quantity: 0,
            revenue: 0,
          };
        }
        productStats[key].quantity += item.quantity;
        productStats[key].revenue += item.unitPrice * item.quantity;
      }
    }

    return Object.entries(productStats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity);
  },

  /**
   * Historial de órdenes cerradas con paginación
   */
  getOrderHistory: async (page: number = 1, limit: number = 20, from?: string, to?: string) => {
    const where: any = { status: 'CLOSED' };

    if (from || to) {
      where.closedAt = {};
      if (from) where.closedAt.gte = new Date(from);
      if (to) where.closedAt.lte = new Date(to + 'T23:59:59.999Z');
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { product: { select: { name: true } } } },
          table: { select: { name: true } },
          user: { select: { name: true } },
          closedBy: { select: { name: true } },
          payments: { select: { method: true, amount: true } },
        },
        orderBy: { closedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Ventas por día (para gráfica de barras) — últimos 7 días
   */
  getDailyBreakdown: async () => {
    const days: { date: string; rawDate: string; sales: number; orders: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);

      const closedOrders = await prisma.order.findMany({
        where: {
          status: 'CLOSED',
          closedAt: { gte: dayStart, lte: dayEnd },
        },
      });

      const totalSales = closedOrders.reduce((sum, o) => sum + o.total, 0);

      days.push({
        date: dayStart.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        rawDate: dayStart.toISOString().split('T')[0],
        sales: Math.round(totalSales * 100) / 100,
        orders: closedOrders.length,
      });
    }

    return days;
  },

  /**
   * Drill-down: obtener las órdenes que forman una estadística específica
   * Filtros: date (fecha exacta), productId, employeeId, paymentMethod, period
   */
  getDrilldown: async (filters: {
    date?: string;
    productId?: string;
    employeeId?: string;
    paymentMethod?: string;
    period?: string;
    from?: string;
    to?: string;
    role?: 'creator' | 'cashier';
  }) => {
    const where: any = { status: 'CLOSED' };

    // Period-based date filter
    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      where.closedAt = { gte: start, lte: end };
    } else if (filters.from || filters.to) {
      where.closedAt = {};
      if (filters.from) where.closedAt.gte = new Date(filters.from);
      if (filters.to) where.closedAt.lte = new Date(filters.to + 'T23:59:59.999Z');
    } else if (filters.period) {
      const now = new Date();
      if (filters.period === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        where.closedAt = { gte: start };
      } else if (filters.period === 'week') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        where.closedAt = { gte: start };
      } else if (filters.period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        where.closedAt = { gte: start };
      }
    }

    // Employee filter
    if (filters.employeeId) {
      if (filters.role === 'cashier') {
        where.closedById = filters.employeeId;
      } else {
        where.userId = filters.employeeId;
      }
    }

    // Payment method filter — needs to join with payments
    if (filters.paymentMethod) {
      where.payments = { some: { method: filters.paymentMethod } };
    }

    // Product filter — needs to join with items
    if (filters.productId) {
      where.items = { some: { productId: filters.productId } };
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        table: { select: { name: true } },
        user: { select: { name: true } },
        closedBy: { select: { name: true } },
        payments: { select: { method: true, amount: true, tip: true } },
      },
      orderBy: { closedAt: 'desc' },
      take: 50, // Max 50 orders for drill-down
    });

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);

    return {
      orders,
      summary: {
        count: orders.length,
        totalSales: Math.round(totalSales * 100) / 100,
      },
    };
  },
};
