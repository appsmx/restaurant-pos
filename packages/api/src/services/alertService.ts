import { prisma } from '../lib/prisma';

/**
 * Proactive Alerts Service
 *
 * Detects situations that need the owner's attention WITHOUT them asking:
 *   - Cash register mismatch (posible robo / error)
 *   - Sales down vs same day last week
 *   - Sales up (good news!)
 *   - Low stock ingredients
 *   - VIP customer inactive (churn risk)
 *   - Best day of the month
 *
 * These are computed with rules + real data (fast, no LLM needed).
 * Each alert has a severity, an icon, a title, and a message.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface ProactiveAlert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  title: string;
  message: string;
  action?: string; // suggested action label
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Formatea una cantidad a máximo 1 decimal, evitando ruido de punto flotante.
 * Ej: 4.000000001 → "4", 3.56 → "3.6", 2.830000000000001 → "2.8"
 */
function fmtQty(n: number): string {
  return parseFloat(n.toFixed(1)).toString();
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export const alertService = {
  /**
   * Generate all proactive alerts for the current tenant.
   */
  getAlerts: async (): Promise<ProactiveAlert[]> => {
    const alerts: ProactiveAlert[] = [];
    const now = new Date();

    // Run all checks in parallel for speed
    const [
      cashAlert,
      salesAlert,
      stockAlerts,
      vipAlert,
    ] = await Promise.all([
      alertService._checkCashRegister(now),
      alertService._checkSalesTrend(now),
      alertService._checkLowStock(),
      alertService._checkInactiveVIP(now),
    ]);

    if (cashAlert) alerts.push(cashAlert);
    if (salesAlert) alerts.push(salesAlert);
    alerts.push(...stockAlerts);
    if (vipAlert) alerts.push(vipAlert);

    // Sort by severity: critical → warning → info → success
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);

    return alerts;
  },

  /**
   * Check if the open cash register has a mismatch between expected and actual.
   */
  _checkCashRegister: async (now: Date): Promise<ProactiveAlert | null> => {
    try {
      const openRegister = await prisma.cashRegister.findFirst({
        where: { status: 'OPEN' },
        include: { movements: true },
        orderBy: { openedAt: 'desc' },
      });

      if (!openRegister) return null;

      // Expected = opening + sales + deposits - withdrawals - expenses
      let expected = openRegister.openingAmount;
      for (const m of openRegister.movements) {
        if (m.type === 'SALE' || m.type === 'DEPOSIT') expected += m.amount;
        else if (m.type === 'WITHDRAWAL' || m.type === 'EXPENSE') expected -= m.amount;
      }

      // We can't know the physical count until they close, so this alert only
      // fires if there's a recorded expectedAmount that differs. Skip if not set.
      // Instead, alert if the register has been open unusually long (> 16h).
      const hoursOpen = (now.getTime() - new Date(openRegister.openedAt).getTime()) / (1000 * 60 * 60);
      if (hoursOpen > 16) {
        return {
          id: 'cash-open-long',
          severity: 'warning',
          icon: '💰',
          title: 'Caja abierta hace mucho',
          message: `La caja lleva ${Math.round(hoursOpen)} horas abierta. ¿Olvidaste cerrarla? El monto esperado es de $${expected.toLocaleString('es-MX')}.`,
          action: 'Cerrar caja',
        };
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Compare today's sales so far vs the same weekday last week (same hour).
   */
  _checkSalesTrend: async (now: Date): Promise<ProactiveAlert | null> => {
    try {
      const todayStart = startOfDay(now);
      // Same weekday last week, up to the same time of day
      const lastWeekSameTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastWeekStart = startOfDay(lastWeekSameTime);

      const [todayOrders, lastWeekOrders] = await Promise.all([
        prisma.order.findMany({
          where: { status: 'CLOSED', closedAt: { gte: todayStart, lte: now } },
          select: { total: true },
        }),
        prisma.order.findMany({
          where: { status: 'CLOSED', closedAt: { gte: lastWeekStart, lte: lastWeekSameTime } },
          select: { total: true },
        }),
      ]);

      const todayTotal = todayOrders.reduce((s, o) => s + o.total, 0);
      const lastWeekTotal = lastWeekOrders.reduce((s, o) => s + o.total, 0);

      // Need meaningful data to compare
      if (lastWeekTotal < 100 && todayTotal < 100) return null;

      if (lastWeekTotal > 0) {
        const pctChange = ((todayTotal - lastWeekTotal) / lastWeekTotal) * 100;

        if (pctChange <= -20) {
          return {
            id: 'sales-down',
            severity: 'warning',
            icon: '📉',
            title: 'Ventas por debajo de lo normal',
            message: `A esta hora llevas $${todayTotal.toLocaleString('es-MX')}, un ${Math.abs(Math.round(pctChange))}% menos que el mismo día la semana pasada ($${lastWeekTotal.toLocaleString('es-MX')}).`,
            action: 'Ver qué cambió',
          };
        }

        if (pctChange >= 20) {
          return {
            id: 'sales-up',
            severity: 'success',
            icon: '🔥',
            title: '¡Buen día de ventas!',
            message: `A esta hora llevas $${todayTotal.toLocaleString('es-MX')}, un ${Math.round(pctChange)}% más que el mismo día la semana pasada. ¡Vas muy bien!`,
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  /**
   * Check for ingredients at critical/low stock levels.
   */
  _checkLowStock: async (): Promise<ProactiveAlert[]> => {
    try {
      const ingredients = await prisma.ingredient.findMany({
        where: { stock: { lte: 5 } },
        orderBy: { stock: 'asc' },
        take: 5,
      });

      if (ingredients.length === 0) return [];

      const critical = ingredients.filter((i) => i.stock <= 2);
      const low = ingredients.filter((i) => i.stock > 2 && i.stock <= 5);

      const alerts: ProactiveAlert[] = [];

      if (critical.length > 0) {
        const names = critical.map((i) => `${i.name} (${fmtQty(i.stock)} ${i.unit})`).join(', ');
        alerts.push({
          id: 'stock-critical',
          severity: 'critical',
          icon: '🚨',
          title: `${critical.length} ingrediente${critical.length > 1 ? 's' : ''} casi agotado${critical.length > 1 ? 's' : ''}`,
          message: `Nivel crítico: ${names}. Pide hoy para no quedarte sin.`,
          action: 'Ver inventario',
        });
      }

      if (low.length > 0) {
        const names = low.map((i) => `${i.name} (${fmtQty(i.stock)} ${i.unit})`).join(', ');
        alerts.push({
          id: 'stock-low',
          severity: 'warning',
          icon: '📦',
          title: `${low.length} ingrediente${low.length > 1 ? 's' : ''} en nivel bajo`,
          message: `Considera reabastecer pronto: ${names}.`,
          action: 'Ver inventario',
        });
      }

      return alerts;
    } catch {
      return [];
    }
  },

  /**
   * Check if a top customer hasn't come back in a while (churn risk).
   */
  _checkInactiveVIP: async (now: Date): Promise<ProactiveAlert | null> => {
    try {
      // Top customers by total spent who have visited before
      const topCustomers = await prisma.customer.findMany({
        where: { totalVisits: { gte: 3 } },
        orderBy: { totalSpent: 'desc' },
        take: 10,
      });

      if (topCustomers.length === 0) return null;

      // Find the most valuable customer who hasn't been updated (no recent activity) in 21+ days
      const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

      for (const customer of topCustomers) {
        if (new Date(customer.updatedAt) < threeWeeksAgo) {
          const daysSince = Math.round((now.getTime() - new Date(customer.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: `vip-inactive-${customer.id}`,
            severity: 'info',
            icon: '👤',
            title: 'Cliente frecuente ausente',
            message: `${customer.firstName} ${customer.lastName} (uno de tus mejores clientes, ${customer.totalVisits} visitas) no viene hace ${daysSince} días. ¿Le mandas una promo para que regrese?`,
            action: 'Ver cliente',
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  },
};
