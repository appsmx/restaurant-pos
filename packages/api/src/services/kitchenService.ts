import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { emitItemStatusChanged, emitOrderReady } from '../lib/socket';

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

    // WebSocket: notify item status change
    emitItemStatusChanged({ orderId: item.orderId, itemId, status: 'PREPARING', productName: updated.product.name });

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

    // WebSocket: notify item ready
    emitItemStatusChanged({ orderId: item.orderId, itemId, status: 'READY', productName: updated.product.name });

    // Si todos los items de la orden están READY o más, actualizar la orden
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
    const allReady = orderItems.every((oi) => ['READY', 'DELIVERED'].includes(oi.status));
    if (allReady) {
      await prisma.order.update({ where: { id: item.orderId }, data: { status: 'READY' } });
      // WebSocket: notify entire order is ready
      const order = await prisma.order.findUnique({
        where: { id: item.orderId },
        select: { ticketNumber: true, table: { select: { name: true } } },
      });
      emitOrderReady({ orderId: item.orderId, ticketNumber: order?.ticketNumber || 0, tableName: order?.table?.name || undefined });
    }

    return updated;
  },

  /**
   * Marcar items de una orden como READY — filtrado por destino
   * Si destination = 'BAR', solo marca bebidas. Si 'KITCHEN', solo comida.
   */
  markOrderReady: async (orderId: string, destination?: string) => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Orden no encontrada', 404);

    const BAR_CATEGORIES = ['bebidas'];

    if (destination) {
      // Get items with their category to filter
      const items = await prisma.orderItem.findMany({
        where: { orderId, status: { in: ['SENT', 'PREPARING'] } },
        include: { product: { include: { category: true } } },
      });

      const itemsToMark = items.filter((item) => {
        const catName = item.product.category?.name?.toLowerCase() || '';
        if (destination === 'BAR') return BAR_CATEGORIES.includes(catName);
        if (destination === 'KITCHEN') return !BAR_CATEGORIES.includes(catName);
        return true;
      });

      // Mark only filtered items as READY
      if (itemsToMark.length > 0) {
        await prisma.orderItem.updateMany({
          where: { id: { in: itemsToMark.map((i) => i.id) } },
          data: { status: 'READY' },
        });
      }

      // Log event
      const destLabel = destination === 'BAR' ? 'Barra' : 'Cocina';
      await logKitchenEvent(orderId, 'ORDER_READY', `${destLabel}: ${itemsToMark.length} items listos`);
    } else {
      // No destination filter — mark ALL items (legacy/admin behavior)
      await prisma.orderItem.updateMany({
        where: { orderId, status: { in: ['SENT', 'PREPARING'] } },
        data: { status: 'READY' },
      });
      await logKitchenEvent(orderId, 'ORDER_READY', 'Toda la orden lista para servir');
    }

    // Check if ALL items in the order are now READY → update order status
    const allItems = await prisma.orderItem.findMany({ where: { orderId } });
    const allReady = allItems.every((oi) => ['READY', 'DELIVERED'].includes(oi.status));
    if (allReady) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'READY' } });
      // WebSocket: notify entire order is ready
      emitOrderReady({ orderId, ticketNumber: order.ticketNumber, tableName: undefined });
    }

    // WebSocket: notify item changes regardless
    emitItemStatusChanged({ orderId, itemId: 'all', status: 'READY', productName: 'Toda la orden' });

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
