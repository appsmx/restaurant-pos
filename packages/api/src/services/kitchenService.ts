import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

async function logKitchenEvent(orderId: string, action: string, details: string) {
  try {
    await (prisma as any).orderEvent.create({
      data: { orderId, action, userId: 'kitchen', userName: 'Cocina', details },
    });
  } catch { /* never block */ }
}

export const kitchenService = {
  /**
   * Obtener todos los items que están en cocina/barra (SENT o PREPARING)
   * Agrupados por orden, con info de mesa y tiempo transcurrido
   * @param destination - 'KITCHEN' (solo comida), 'BAR' (solo bebidas), undefined (todo)
   */
  getKitchenQueue: async (destination?: string) => {
    const items = await prisma.orderItem.findMany({
      where: {
        status: { in: ['SENT', 'PREPARING'] },
        order: { status: { in: ['SENT', 'PREPARING'] } },
      },
      include: {
        product: { select: { name: true, categoryId: true, category: true } },
        modifiers: true,
        order: {
          select: {
            id: true,
            ticketNumber: true,
            type: true,
            createdAt: true,
            table: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });

    // Fetch modifier names for display
    const allModifierIds = items.flatMap((item) => item.modifiers.map((m) => m.modifierId));
    const modifierItemsLookup: Record<string, { name: string; price: number }> = {};
    if (allModifierIds.length > 0) {
      const modifierRecords = await prisma.modifierItem.findMany({
        where: { id: { in: allModifierIds } },
        select: { id: true, name: true, price: true },
      });
      for (const m of modifierRecords) {
        modifierItemsLookup[m.id] = { name: m.name, price: m.price };
      }
    }

    // Filter by destination if specified
    const BAR_CATEGORIES = ['bebidas']; // category names that go to bar (lowercase)
    const filteredItems = destination
      ? items.filter((item) => {
          const catName = (item.product.category as any)?.name?.toLowerCase() || '';
          if (destination === 'BAR') return BAR_CATEGORIES.includes(catName);
          if (destination === 'KITCHEN') return !BAR_CATEGORIES.includes(catName);
          return true;
        })
      : items;

    // Agrupar por orden
    const orderMap: Record<string, {
      orderId: string;
      ticketNumber: number;
      orderType: string;
      tableName: string | null;
      waiterName: string;
      createdAt: string;
      items: typeof filteredItems;
    }> = {};

    for (const item of filteredItems) {
      const key = item.orderId;
      if (!orderMap[key]) {
        orderMap[key] = {
          orderId: item.order.id,
          ticketNumber: (item.order as any).ticketNumber,
          orderType: (item.order as any).type,
          tableName: item.order.table?.name || null,
          waiterName: item.order.user.name,
          createdAt: item.order.createdAt.toISOString(),
          items: [],
        };
      }
      orderMap[key].items.push(item);
    }

    // Enrich items with resolved modifier names for display
    const result = Object.values(orderMap).map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        notes: item.notes,
        status: item.status,
        product: item.product,
        orderId: item.orderId,
        modifiers: item.modifiers.map((m) => ({
          name: modifierItemsLookup[m.modifierId]?.name || 'Extra',
          price: modifierItemsLookup[m.modifierId]?.price || 0,
          quantity: m.quantity,
        })),
      })),
    }));

    return result;
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

    // Log event
    await logKitchenEvent(item.orderId, 'ITEM_PREPARING', `Preparando: ${updated.product.name}`);

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

    // Log event
    await logKitchenEvent(item.orderId, 'ITEM_READY', `Listo: ${updated.product.name}`);

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

    // Log event
    await logKitchenEvent(orderId, 'ORDER_READY', 'Toda la orden lista para servir');

    return { success: true };
  },

  /**
   * Obtener órdenes completadas recientemente (última hora) para referencia del cocinero
   */
  getRecentlyCompleted: async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['READY', 'DELIVERED', 'CLOSED'] },
        updatedAt: { gte: oneHourAgo },
      },
      include: {
        items: { include: { product: { select: { name: true } } } },
        table: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return orders.map((o) => ({
      orderId: o.id,
      ticketNumber: o.ticketNumber,
      tableName: o.table?.name || null,
      status: o.status,
      completedAt: o.updatedAt.toISOString(),
      items: o.items.map((i) => ({ quantity: i.quantity, name: i.product.name })),
    }));
  },
};
