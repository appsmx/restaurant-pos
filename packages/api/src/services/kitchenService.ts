import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const kitchenService = {
  /**
   * Obtener todos los items que están en cocina (SENT o PREPARING)
   * Agrupados por orden, con info de mesa y tiempo transcurrido
   */
  getKitchenQueue: async () => {
    const items = await prisma.orderItem.findMany({
      where: {
        status: { in: ['SENT', 'PREPARING'] },
        order: { status: { in: ['SENT', 'PREPARING'] } },
      },
      include: {
        product: { select: { name: true, categoryId: true, category: true } },
        order: {
          select: {
            id: true,
            createdAt: true,
            table: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });

    // Agrupar por orden
    const orderMap: Record<string, {
      orderId: string;
      tableName: string | null;
      waiterName: string;
      createdAt: string;
      items: typeof items;
    }> = {};

    for (const item of items) {
      const key = item.orderId;
      if (!orderMap[key]) {
        orderMap[key] = {
          orderId: item.order.id,
          tableName: item.order.table?.name || null,
          waiterName: item.order.user.name,
          createdAt: item.order.createdAt.toISOString(),
          items: [],
        };
      }
      orderMap[key].items.push(item);
    }

    return Object.values(orderMap);
  },

  /**
   * Marcar un item como PREPARING (el cocinero empezó a prepararlo)
   */
  startPreparing: async (itemId: string) => {
    const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Item no encontrado', 404);
    if (item.status !== 'SENT') throw new AppError('Solo se pueden preparar items enviados', 400);

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status: 'PREPARING' },
      include: { product: { select: { name: true } } },
    });

    // Si todos los items de la orden están en PREPARING o más, actualizar la orden
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
    const allPreparing = orderItems.every((oi) => ['PREPARING', 'READY', 'DELIVERED'].includes(oi.status));
    if (allPreparing) {
      await prisma.order.update({ where: { id: item.orderId }, data: { status: 'PREPARING' } });
    }

    return updated;
  },

  /**
   * Marcar un item como READY (listo para servir)
   */
  markReady: async (itemId: string) => {
    const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Item no encontrado', 404);
    if (!['SENT', 'PREPARING'].includes(item.status)) {
      throw new AppError('Solo se pueden marcar como listos items en preparación', 400);
    }

    const updated = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status: 'READY' },
      include: { product: { select: { name: true } } },
    });

    // Si todos los items de la orden están READY o más, actualizar la orden
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
    const allReady = orderItems.every((oi) => ['READY', 'DELIVERED'].includes(oi.status));
    if (allReady) {
      await prisma.order.update({ where: { id: item.orderId }, data: { status: 'READY' } });
    }

    return updated;
  },

  /**
   * Marcar todos los items de una orden como READY de un golpe
   */
  markOrderReady: async (orderId: string) => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Orden no encontrada', 404);

    await prisma.orderItem.updateMany({
      where: { orderId, status: { in: ['SENT', 'PREPARING'] } },
      data: { status: 'READY' },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'READY' },
    });

    return { success: true };
  },
};
