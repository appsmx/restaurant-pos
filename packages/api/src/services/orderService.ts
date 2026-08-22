import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { inventoryService } from './inventoryService';

export const orderService = {
  createOrder: async (userId: string, tableId?: string, type: string = 'DINE_IN') => {
    // Generate next ticket number (max + 1)
    const lastOrder = await prisma.order.findFirst({ orderBy: { ticketNumber: 'desc' } });
    const ticketNumber = (lastOrder?.ticketNumber || 0) + 1;

    const order = await prisma.order.create({
      data: {
        userId,
        tableId: tableId || null,
        type: type as any,
        status: 'OPEN',
        ticketNumber,
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
      orderBy: { ticketNumber: 'desc' }
    });
  },

  // --- ESTA ES LA NUEVA ---
  closeOrder: async (orderId: string, userId: string, method: string = 'CASH', customerId?: string) => {
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

    // 2. Cambiar estado a CLOSED, registrar timestamp y cliente (si se asignó)
    const closedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        ...(customerId && { customerId }),
      },
      include: { items: true, table: true, payments: true }
    });

    // 3. Si se asignó un cliente, registrar la visita + puntos de lealtad
    if (customerId) {
      try {
        const pointsEarned = Math.floor(order.total / 10);
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            totalVisits: { increment: 1 },
            totalSpent: { increment: order.total },
            loyaltyPoints: { increment: pointsEarned },
          },
        });
      } catch (err) {
        // No bloquear el cobro si falla la actualización del cliente
        console.warn('No se pudo actualizar puntos del cliente:', err);
      }
    }

    // 4. Si tenía mesa, liberarla (ponerla en AVAILABLE)
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' }
      });
    }

    // 4. Descontar stock de ingredientes automáticamente
    try {
      await inventoryService.deductStockForOrder(orderId, userId);
    } catch (err) {
      // No bloquear el cierre de la orden si falla el descuento de stock
      // (puede que no haya recetas configuradas aún)
      console.warn('Advertencia: No se pudo descontar stock para orden', orderId, err);
    }

    return closedOrder;
  }
};