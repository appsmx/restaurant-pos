import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const cashService = {
  /**
   * Obtener la caja abierta actual (si existe)
   */
  getCurrentRegister: async () => {
    const register = await prisma.cashRegister.findFirst({
      where: { status: 'OPEN' },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
    return register;
  },

  /**
   * Abrir caja con un monto inicial
   */
  openRegister: async (openingAmount: number, userId: string) => {
    // Verificar que no haya una caja abierta
    const existing = await prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (existing) throw new AppError('Ya hay una caja abierta. Ciérrala antes de abrir otra.', 400);

    const register = await prisma.cashRegister.create({
      data: {
        openingAmount,
        openedBy: userId,
        status: 'OPEN',
        movements: {
          create: {
            type: 'OPENING',
            amount: openingAmount,
            description: 'Apertura de caja',
            userId,
          },
        },
      },
      include: { movements: true },
    });

    return register;
  },

  /**
   * Cerrar caja con el monto real contado
   */
  closeRegister: async (closingAmount: number, userId: string, notes?: string) => {
    const register = await prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (!register) throw new AppError('No hay caja abierta para cerrar', 400);

    // Calcular el monto esperado (apertura + depósitos + ventas en efectivo - retiros - gastos)
    const movements = await prisma.cashMovement.findMany({
      where: { registerId: register.id },
    });

    let expectedAmount = 0;
    for (const mov of movements) {
      switch (mov.type) {
        case 'OPENING':
        case 'DEPOSIT':
        case 'SALE':
          expectedAmount += mov.amount;
          break;
        case 'WITHDRAWAL':
        case 'EXPENSE':
          expectedAmount -= mov.amount;
          break;
      }
    }

    const difference = closingAmount - expectedAmount;

    // Registrar el movimiento de cierre
    await prisma.cashMovement.create({
      data: {
        registerId: register.id,
        type: 'CLOSING',
        amount: closingAmount,
        description: `Cierre de caja${notes ? ': ' + notes : ''}`,
        userId,
      },
    });

    // Cerrar la caja
    const closed = await prisma.cashRegister.update({
      where: { id: register.id },
      data: {
        status: 'CLOSED',
        closingAmount,
        expectedAmount,
        difference,
        closedBy: userId,
        closedAt: new Date(),
        notes,
      },
    });

    return { register: closed, expectedAmount, difference };
  },

  /**
   * Registrar un movimiento en la caja abierta (depósito, retiro, gasto)
   */
  addMovement: async (type: 'DEPOSIT' | 'WITHDRAWAL' | 'EXPENSE' | 'SALE', amount: number, description: string, userId: string) => {
    const register = await prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (!register) throw new AppError('No hay caja abierta. Abre una caja primero.', 400);

    const movement = await prisma.cashMovement.create({
      data: {
        registerId: register.id,
        type: type as any,
        amount,
        description,
        userId,
      },
      include: { user: { select: { name: true } } },
    });

    return movement;
  },

  /**
   * Obtener resumen de la caja actual (totales por tipo)
   */
  getSummary: async () => {
    const register = await prisma.cashRegister.findFirst({ where: { status: 'OPEN' } });
    if (!register) return null;

    const movements = await prisma.cashMovement.findMany({
      where: { registerId: register.id },
    });

    const summary = {
      opening: 0,
      sales: 0,
      deposits: 0,
      withdrawals: 0,
      expenses: 0,
      currentTotal: 0,
    };

    for (const mov of movements) {
      switch (mov.type) {
        case 'OPENING': summary.opening += mov.amount; break;
        case 'SALE': summary.sales += mov.amount; break;
        case 'DEPOSIT': summary.deposits += mov.amount; break;
        case 'WITHDRAWAL': summary.withdrawals += mov.amount; break;
        case 'EXPENSE': summary.expenses += mov.amount; break;
      }
    }

    summary.currentTotal = summary.opening + summary.sales + summary.deposits - summary.withdrawals - summary.expenses;

    return { register, summary };
  },

  /**
   * Historial de cajas cerradas con desglose
   */
  getHistory: async (limit: number = 10) => {
    const registers = await prisma.cashRegister.findMany({
      where: { status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      take: limit,
      include: {
        movements: { orderBy: { createdAt: 'asc' } },
      },
    });

    return registers.map((reg) => {
      const summary = { opening: 0, sales: 0, deposits: 0, withdrawals: 0, expenses: 0 };
      for (const mov of reg.movements) {
        switch (mov.type) {
          case 'OPENING': summary.opening += mov.amount; break;
          case 'SALE': summary.sales += mov.amount; break;
          case 'DEPOSIT': summary.deposits += mov.amount; break;
          case 'WITHDRAWAL': summary.withdrawals += mov.amount; break;
          case 'EXPENSE': summary.expenses += mov.amount; break;
        }
      }
      return { ...reg, movementSummary: summary, movementCount: reg.movements.length - 2 }; // exclude OPENING and CLOSING
    });
  },

  /**
   * Resumen detallado del turno actual (con desglose por método de pago)
   * Usa la tabla Payment para calcular ventas por método durante el período de la caja abierta
   */
  getShiftDetail: async () => {
    const register = await prisma.cashRegister.findFirst({
      where: { status: 'OPEN' },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        },
      },
    });
    if (!register) return null;

    // Get payments made during this shift (since register opened)
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: register.openedAt },
        status: 'COMPLETED',
      },
      include: {
        order: { select: { ticketNumber: true } },
      },
    });

    // Breakdown by method
    const byMethod: Record<string, { count: number; total: number; tips: number }> = {};
    for (const p of payments) {
      if (!byMethod[p.method]) byMethod[p.method] = { count: 0, total: 0, tips: 0 };
      byMethod[p.method].count++;
      byMethod[p.method].total += p.amount;
      byMethod[p.method].tips += p.tip;
    }

    // Movement summary
    const summary = { opening: 0, sales: 0, deposits: 0, withdrawals: 0, expenses: 0, currentTotal: 0 };
    for (const mov of register.movements) {
      switch (mov.type) {
        case 'OPENING': summary.opening += mov.amount; break;
        case 'SALE': summary.sales += mov.amount; break;
        case 'DEPOSIT': summary.deposits += mov.amount; break;
        case 'WITHDRAWAL': summary.withdrawals += mov.amount; break;
        case 'EXPENSE': summary.expenses += mov.amount; break;
      }
    }
    summary.currentTotal = summary.opening + summary.sales + summary.deposits - summary.withdrawals - summary.expenses;

    const totalSales = payments.reduce((s, p) => s + p.amount, 0);
    const totalTips = payments.reduce((s, p) => s + p.tip, 0);
    const orderCount = payments.length;

    return {
      register,
      summary,
      movements: register.movements,
      salesDetail: {
        totalSales,
        totalTips,
        orderCount,
        byMethod,
      },
    };
  },
};
