import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const customerService = {
  getAll: async (search?: string) => {
    return prisma.customer.findMany({
      where: search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      } : {},
      orderBy: { totalSpent: 'desc' },
    });
  },

  getById: async (id: string) => {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError('Cliente no encontrado', 404);
    return customer;
  },

  create: async (data: { firstName: string; lastName: string; phone?: string; email?: string; birthday?: string; notes?: string }) => {
    return prisma.customer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        email: data.email || null,
        birthday: data.birthday ? new Date(data.birthday) : null,
        notes: data.notes || null,
      },
    });
  },

  update: async (id: string, data: { firstName?: string; lastName?: string; phone?: string; email?: string; birthday?: string; notes?: string }) => {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError('Cliente no encontrado', 404);

    return prisma.customer.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.birthday !== undefined && { birthday: data.birthday ? new Date(data.birthday) : null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      },
    });
  },

  addVisit: async (id: string, amountSpent: number) => {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError('Cliente no encontrado', 404);

    // 1 punto por cada $10 gastados
    const pointsEarned = Math.floor(amountSpent / 10);

    return prisma.customer.update({
      where: { id },
      data: {
        totalVisits: { increment: 1 },
        totalSpent: { increment: amountSpent },
        loyaltyPoints: { increment: pointsEarned },
      },
    });
  },

  addPoints: async (id: string, points: number) => {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError('Cliente no encontrado', 404);

    return prisma.customer.update({
      where: { id },
      data: { loyaltyPoints: { increment: points } },
    });
  },

  redeemPoints: async (id: string, points: number) => {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError('Cliente no encontrado', 404);
    if (customer.loyaltyPoints < points) throw new AppError('Puntos insuficientes', 400);

    return prisma.customer.update({
      where: { id },
      data: { loyaltyPoints: { decrement: points } },
    });
  },
};
