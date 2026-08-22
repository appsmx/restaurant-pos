import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const floorPlanService = {
  getSections: async () => {
    return prisma.section.findMany({
      orderBy: { sort: 'asc' },
      include: { tables: true }
    });
  },
  getTables: async (sectionId?: string) => {
    return prisma.table.findMany({
      where: sectionId ? { sectionId } : {},
      orderBy: { name: 'asc' }
    });
  },
  updateTableStatus: async (tableId: string, status: string) => {
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_SERVICE'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Estado de mesa inválido', 400);
    }
    return prisma.table.update({
      where: { id: tableId },
      data: { status: status as any }
    });
  },
  /**
   * Verificar si una mesa tiene órdenes activas (no cerradas/canceladas)
   */
  getActiveOrderForTable: async (tableId: string) => {
    const order = await prisma.order.findFirst({
      where: {
        tableId,
        status: { in: ['OPEN', 'SENT', 'PREPARING', 'READY', 'DELIVERED'] }
      },
      include: {
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' }
    });
    return order;
  }
};
