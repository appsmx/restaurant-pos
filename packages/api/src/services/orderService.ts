import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const orderService = {
  createOrder: async (userId: string, tableId?: string, type: string = 'DINE_IN') => {
    const order = await prisma.order.create({
      data: {
        userId,
        tableId: tableId || null,
        type: type as any,
        status: 'OPEN',
      },
      include: { items: true }
    });

    if (tableId) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' }
      });
    }

    return order;
  },

  addOrderItem: async (orderId: string, productId: string, quantity: number, notes?: string) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        quantity,
        unitPrice: product.price,
        notes: notes || null,
        status: 'PENDING'
      }
    });

    await prisma.order.update({
      where: { id: orderId },
      data: { total: { increment: product.price * quantity } }
    });

    return orderItem;
  },

  sendToKitchen: async (orderId: string) => {
    await prisma.orderItem.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'SENT' }
    });

    return prisma.order.update({
      where: { id: orderId },
      data: { status: 'SENT' },
      include: { items: true }
    });
  },

  getActiveOrders: async () => {
    return prisma.order.findMany({
      where: {
        status: { in: ['OPEN', 'SENT', 'PREPARING', 'READY'] }
      },
      include: {
        items: { include: { product: true } },
        table: true,
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  // --- ESTA ES LA NUEVA ---
  closeOrder: async (orderId: string, userId: string, method: string = 'CASH') => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Orden no encontrada', 404);
    if (order.status === 'CLOSED') throw new AppError('La orden ya está cerrada', 400);

    // 1. Crear el registro de pago
    await prisma.payment.create({
      data: {
        orderId,
        amount: order.total,
        method: method as any,
        status: 'COMPLETED',
        userId,
      },
    });

    // 2. Cambiar estado a CLOSED y registrar timestamp
    const closedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: { items: true, table: true, payments: true }
    });

    // 3. Si tenía mesa, liberarla (ponerla en AVAILABLE)
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' }
      });
    }

    return closedOrder;
  }
};