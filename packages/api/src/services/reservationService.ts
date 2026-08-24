import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const reservationService = {
  /**
   * Get reservations for a specific date (or all upcoming if no date)
   */
  getByDate: async (date?: string) => {
    const where: any = {};

    if (date) {
      // Filter by specific date (start of day to end of day)
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    } else {
      // Default: today and future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.date = { gte: today };
    }

    // Exclude cancelled/no-show by default for active view
    where.status = { in: ['CONFIRMED', 'SEATED'] };

    return prisma.reservation.findMany({
      where,
      include: { table: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  },

  /**
   * Get all reservations (including completed/cancelled) with optional filters
   */
  getAll: async (filters?: { date?: string; status?: string }) => {
    const where: any = {};

    if (filters?.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    return prisma.reservation.findMany({
      where,
      include: { table: { select: { id: true, name: true } } },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  },

  /**
   * Get a single reservation by ID
   */
  getById: async (id: string) => {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { table: { select: { id: true, name: true } } },
    });
    if (!reservation) throw new AppError('Reservación no encontrada', 404);
    return reservation;
  },

  /**
   * Create a new reservation
   */
  create: async (data: {
    customerName: string;
    phone?: string;
    date: string;
    time: string;
    guests: number;
    tableId?: string;
    notes?: string;
  }) => {
    // Validate table exists if provided
    if (data.tableId) {
      const table = await prisma.table.findUnique({ where: { id: data.tableId } });
      if (!table) throw new AppError('Mesa no encontrada', 404);
    }

    const reservation = await prisma.reservation.create({
      data: {
        customerName: data.customerName,
        phone: data.phone || null,
        date: new Date(data.date),
        time: data.time,
        guests: data.guests,
        tableId: data.tableId || null,
        notes: data.notes || null,
        status: 'CONFIRMED',
      },
      include: { table: { select: { id: true, name: true } } },
    });

    return reservation;
  },

  /**
   * Update a reservation
   */
  update: async (id: string, data: {
    customerName?: string;
    phone?: string;
    date?: string;
    time?: string;
    guests?: number;
    tableId?: string | null;
    notes?: string;
    status?: string;
  }) => {
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new AppError('Reservación no encontrada', 404);

    // Validate table if changing
    if (data.tableId) {
      const table = await prisma.table.findUnique({ where: { id: data.tableId } });
      if (!table) throw new AppError('Mesa no encontrada', 404);
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.time !== undefined && { time: data.time }),
        ...(data.guests !== undefined && { guests: data.guests }),
        ...(data.tableId !== undefined && { tableId: data.tableId || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.status !== undefined && { status: data.status as any }),
      },
      include: { table: { select: { id: true, name: true } } },
    });

    return updated;
  },

  /**
   * Cancel a reservation
   */
  cancel: async (id: string) => {
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new AppError('Reservación no encontrada', 404);
    if (existing.status === 'CANCELLED') throw new AppError('La reservación ya está cancelada', 400);

    return prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { table: { select: { id: true, name: true } } },
    });
  },

  /**
   * Mark reservation as seated (customer arrived)
   */
  markSeated: async (id: string) => {
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new AppError('Reservación no encontrada', 404);
    if (existing.status !== 'CONFIRMED') throw new AppError('Solo se pueden sentar reservaciones confirmadas', 400);

    // If reservation has a table, mark it as OCCUPIED
    if (existing.tableId) {
      await prisma.table.update({
        where: { id: existing.tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    return prisma.reservation.update({
      where: { id },
      data: { status: 'SEATED' },
      include: { table: { select: { id: true, name: true } } },
    });
  },

  /**
   * Mark reservation as completed
   */
  markCompleted: async (id: string) => {
    const existing = await prisma.reservation.findUnique({ where: { id } });
    if (!existing) throw new AppError('Reservación no encontrada', 404);

    return prisma.reservation.update({
      where: { id },
      data: { status: 'COMPLETED' },
      include: { table: { select: { id: true, name: true } } },
    });
  },

  /**
   * Get reserved table IDs for today (for floor plan highlighting)
   */
  getReservedTableIds: async (date?: string) => {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const reservations = await prisma.reservation.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'SEATED'] },
        tableId: { not: null },
      },
      select: { tableId: true, time: true, customerName: true, guests: true },
    });

    return reservations.map((r) => ({
      tableId: r.tableId!,
      time: r.time,
      customerName: r.customerName,
      guests: r.guests,
    }));
  },
};
