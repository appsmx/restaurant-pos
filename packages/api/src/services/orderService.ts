import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { inventoryService } from './inventoryService';

// ==================== HELPER: Log order event ====================

async function logEvent(orderId: string, action: string, userId: string, userName: string, details?: string) {
  try {
    await (prisma as any).orderEvent.create({
      data: { orderId, action, userId, userName, details: details || null },
    });
  } catch {
    // Never block main flow for audit logging
    // OrderEvent table may not exist yet
  }
}

// ==================== SERVICE ====================

export const orderService = {
  createOrder: async (userId: string, tableId?: string, type: string = 'DINE_IN') => {
    // Get user name for events
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const userName = user?.name || 'Sistema';

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
      include: { items: true, table: true }
    });

    if (tableId) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' }
      });
    }

    // Log event
    const tableInfo = order.table ? `Mesa: ${order.table.name}` : 'Para llevar';
    await logEvent(order.id, 'CREATED', userId, userName, `Orden #${ticketNumber} creada. ${tableInfo}`);

    return order;
  },

  addOrderItem: async (orderId: string, productId: string, quantity: number, notes?: string, userId?: string) => {
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

    // Update subtotal and total
    const newSubtotal = await prisma.orderItem.aggregate({
      where: { orderId },
      _sum: { unitPrice: true },
    });

    // Recalculate total from all items
    const allItems = await prisma.orderItem.findMany({ where: { orderId } });
    const subtotal = allItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    await prisma.order.update({
      where: { id: orderId },
      data: { subtotal, total: subtotal }
    });

    // Log event
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      await logEvent(orderId, 'ITEM_ADDED', userId, user?.name || 'Sistema', `${quantity}x ${product.name}${notes ? ` (${notes})` : ''}`);
    }

    return orderItem;
  },

  sendToKitchen: async (orderId: string, userId?: string) => {
    const pendingItems = await prisma.orderItem.findMany({
      where: { orderId, status: 'PENDING' },
      include: { product: { select: { name: true } } },
    });

    await prisma.orderItem.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'SENT' }
    });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SENT', sentAt: new Date() },
      include: { items: true }
    });

    // Log event
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const itemsSummary = pendingItems.map((i) => `${i.quantity}x ${i.product.name}`).join(', ');
      await logEvent(orderId, 'SENT_TO_KITCHEN', userId, user?.name || 'Sistema', `Enviado a cocina: ${itemsSummary}`);
    }

    return updatedOrder;
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

  closeOrder: async (
    orderId: string,
    userId: string,
    method: string = 'CASH',
    customerId?: string,
    discount?: { amount: number; type: 'PERCENT' | 'FIXED'; reason?: string },
    tip?: number
  ) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new AppError('Orden no encontrada', 404);
    if (order.status === 'CLOSED') throw new AppError('La orden ya está cerrada', 400);

    // Calculate final total with discount
    const subtotal = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    let discountAmount = 0;

    if (discount && discount.amount > 0) {
      if (discount.type === 'PERCENT') {
        discountAmount = subtotal * (discount.amount / 100);
      } else {
        discountAmount = discount.amount;
      }
      // Don't allow discount bigger than subtotal
      discountAmount = Math.min(discountAmount, subtotal);
    }

    const finalTotal = subtotal - discountAmount;

    const tipAmount = tip && tip > 0 ? tip : 0;

    // 1. Create payment record
    await prisma.payment.create({
      data: {
        orderId,
        amount: finalTotal,
        tip: tipAmount,
        method: method as any,
        status: 'COMPLETED',
        userId,
      },
    });

    // 2. Close the order
    const closedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: userId,
        subtotal,
        total: finalTotal,
        discount: discountAmount,
        discountType: discount?.type || null,
        discountReason: discount?.reason || null,
        ...(customerId && { customerId }),
      },
      include: { items: true, table: true, payments: true }
    });

    // 3. Customer loyalty
    if (customerId) {
      try {
        const pointsEarned = Math.floor(finalTotal / 10);
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            totalVisits: { increment: 1 },
            totalSpent: { increment: finalTotal },
            loyaltyPoints: { increment: pointsEarned },
          },
        });
      } catch (err) {
        console.warn('No se pudo actualizar puntos del cliente:', err);
      }
    }

    // 4. Release table
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' }
      });
    }

    // 5. Deduct stock
    try {
      await inventoryService.deductStockForOrder(orderId, userId);
    } catch (err) {
      console.warn('Advertencia: No se pudo descontar stock para orden', orderId, err);
    }

    // 6. Log event
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    let payDetails = `Cobrado $${finalTotal.toFixed(2)} con ${method}`;
    if (discountAmount > 0) {
      payDetails += ` (Descuento: $${discountAmount.toFixed(2)} - ${discount?.reason || 'Sin razón'})`;
    }
    if (tipAmount > 0) {
      payDetails += ` + Propina: $${tipAmount.toFixed(2)}`;
    }
    await logEvent(orderId, 'PAID', userId, user?.name || 'Cajero', payDetails);

    return closedOrder;
  },

  /**
   * Get full order details with timeline events
   */
  getOrderDetail: async (orderId: string) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { name: true, price: true } } } },
        table: { select: { name: true } },
        user: { select: { id: true, name: true, role: true } },
        closedBy: { select: { id: true, name: true, role: true } },
        payments: { select: { method: true, amount: true, tip: true, createdAt: true, user: { select: { name: true } } } },
      },
    });

    if (!order) throw new AppError('Orden no encontrada', 404);

    // Try to fetch events separately (table may not exist yet)
    let events: any[] = [];
    try {
      events = await (prisma as any).orderEvent.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      // OrderEvent table doesn't exist yet — return empty
    }

    return { ...order, events };
  },
};
