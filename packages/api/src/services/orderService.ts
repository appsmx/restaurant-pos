import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { inventoryService } from './inventoryService';
import { emitOrderSentToKitchen, emitOrderClosed, emitTableStatusChanged } from '../lib/socket';

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

  addOrderItem: async (orderId: string, productId: string, quantity: number, notes?: string, userId?: string, modifiers?: { modifierId: string; quantity?: number }[]) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    // Calculate modifier price additions
    let modifierPriceTotal = 0;
    if (modifiers && modifiers.length > 0) {
      const modifierItems = await prisma.modifierItem.findMany({
        where: { id: { in: modifiers.map((m) => m.modifierId) } },
      });
      for (const mod of modifiers) {
        const modItem = modifierItems.find((mi) => mi.id === mod.modifierId);
        if (modItem) {
          modifierPriceTotal += modItem.price * (mod.quantity || 1);
        }
      }
    }

    const unitPrice = product.price + modifierPriceTotal;

    const orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        quantity,
        unitPrice,
        notes: notes || null,
        status: 'PENDING'
      }
    });

    // Create OrderItemModifier records
    if (modifiers && modifiers.length > 0) {
      await Promise.all(
        modifiers.map((mod) =>
          prisma.orderItemModifier.create({
            data: {
              orderItemId: orderItem.id,
              modifierId: mod.modifierId,
              quantity: mod.quantity || 1,
            },
          })
        )
      );
    }

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
      const modNote = modifiers && modifiers.length > 0 ? ` (+${modifiers.length} extras)` : '';
      await logEvent(orderId, 'ITEM_ADDED', userId, user?.name || 'Sistema', `${quantity}x ${product.name}${modNote}${notes ? ` (${notes})` : ''}`);
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

    // WebSocket: notify kitchen/bar screens
    const orderForSocket = await prisma.order.findUnique({
      where: { id: orderId },
      select: { ticketNumber: true, table: { select: { name: true } } },
    });
    emitOrderSentToKitchen({
      orderId,
      ticketNumber: orderForSocket?.ticketNumber || 0,
      tableName: orderForSocket?.table?.name || undefined,
    });

    return updatedOrder;
  },

  getActiveOrders: async () => {
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['OPEN', 'SENT', 'PREPARING', 'READY'] }
      },
      include: {
        items: { include: { product: true, modifiers: true } },
        table: true,
        user: { select: { name: true } }
      },
      orderBy: { ticketNumber: 'desc' }
    });

    // Resolve modifier names for all orders
    const allModifierIds = orders.flatMap((o) => o.items.flatMap((i) => i.modifiers.map((m) => m.modifierId)));
    let modifierLookup: Record<string, { name: string; price: number }> = {};
    if (allModifierIds.length > 0) {
      const modifierRecords = await prisma.modifierItem.findMany({
        where: { id: { in: allModifierIds } },
        select: { id: true, name: true, price: true },
      });
      for (const m of modifierRecords) {
        modifierLookup[m.id] = { name: m.name, price: m.price };
      }
    }

    return orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        modifiers: item.modifiers.map((m) => ({
          id: m.id,
          name: modifierLookup[m.modifierId]?.name || 'Extra',
          price: modifierLookup[m.modifierId]?.price || 0,
          quantity: m.quantity,
        })),
      })),
    }));
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

    // WebSocket: notify order closed + table freed
    emitOrderClosed({ orderId, ticketNumber: closedOrder.ticketNumber, tableId: order.tableId || undefined });
    if (order.tableId) {
      const tableName = closedOrder.table?.name || '';
      emitTableStatusChanged({ tableId: order.tableId, status: 'AVAILABLE', tableName });
    }

    return closedOrder;
  },

  /**
   * Get full order details with timeline events
   */
  getOrderDetail: async (orderId: string) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true, price: true } },
            modifiers: true,
          },
        },
        table: { select: { name: true } },
        user: { select: { id: true, name: true, role: true } },
        closedBy: { select: { id: true, name: true, role: true } },
        payments: { select: { method: true, amount: true, tip: true, createdAt: true, user: { select: { name: true } } } },
      },
    });

    if (!order) throw new AppError('Orden no encontrada', 404);

    // Resolve modifier names
    const allModifierIds = order.items.flatMap((item) => item.modifiers.map((m) => m.modifierId));
    let modifierLookup: Record<string, { name: string; price: number }> = {};
    if (allModifierIds.length > 0) {
      const modifierRecords = await prisma.modifierItem.findMany({
        where: { id: { in: allModifierIds } },
        select: { id: true, name: true, price: true },
      });
      for (const m of modifierRecords) {
        modifierLookup[m.id] = { name: m.name, price: m.price };
      }
    }

    // Enrich items with modifier names
    const enrichedItems = order.items.map((item) => ({
      ...item,
      modifiers: item.modifiers.map((m) => ({
        id: m.id,
        name: modifierLookup[m.modifierId]?.name || 'Extra',
        price: modifierLookup[m.modifierId]?.price || 0,
        quantity: m.quantity,
      })),
    }));

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

    return { ...order, items: enrichedItems, events };
  },

  /**
   * Split payment — register a partial payment for an order.
   * When the sum of all payments >= order total, auto-close the order.
   */
  splitPay: async (orderId: string, userId: string, method: string, amount: number, tip: number = 0, label?: string) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new AppError('Orden no encontrada', 404);
    if (order.status === 'CLOSED') throw new AppError('La orden ya está cerrada', 400);

    // Create the partial payment
    await prisma.payment.create({
      data: {
        orderId,
        amount,
        tip,
        method: method as any,
        status: 'COMPLETED',
        userId,
      },
    });

    // Calculate total paid so far
    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
    const remaining = order.total - totalPaid;

    // Log event
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const eventDetails = `Pago parcial $${amount.toFixed(2)} (${method})${label ? ` — ${label}` : ''}. Restante: $${Math.max(0, remaining).toFixed(2)}`;
    await logEvent(orderId, 'PAID', userId, user?.name || 'Cajero', eventDetails);

    // If fully paid, close the order
    if (remaining <= 0.01) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: userId,
        },
      });

      // Release table
      if (order.tableId) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }

      // Deduct stock
      try {
        await inventoryService.deductStockForOrder(orderId, userId);
      } catch { /* graceful */ }

      return { status: 'CLOSED', totalPaid, remaining: 0, message: 'Orden cerrada — cuenta saldada' };
    }

    return { status: 'PARTIAL', totalPaid, remaining: Math.max(0, remaining), message: `Faltan $${remaining.toFixed(2)} por cobrar` };
  },

  /**
   * Cancelar/quitar un item de una orden abierta (antes de cobrar)
   */
  cancelItem: async (orderId: string, itemId: string, userId: string) => {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Orden no encontrada', 404);
    if (order.status === 'CLOSED') throw new AppError('No se pueden quitar items de una orden cerrada', 400);

    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: { select: { name: true } } },
    });
    if (!item) throw new AppError('Item no encontrado', 404);
    if (item.orderId !== orderId) throw new AppError('El item no pertenece a esta orden', 400);

    // Remove the item
    await prisma.orderItem.delete({ where: { id: itemId } });

    // Recalculate order total
    const remainingItems = await prisma.orderItem.findMany({ where: { orderId } });
    const newTotal = remainingItems.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);

    await prisma.order.update({
      where: { id: orderId },
      data: { total: newTotal, subtotal: newTotal },
    });

    // Log event
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await logEvent(orderId, 'ITEM_CANCELLED', userId, user?.name || 'Usuario', `Cancelado: ${item.quantity}x ${item.product.name}`);

    return { success: true, removedItem: item.product.name, newTotal };
  },

  /**
   * Reabrir una orden cerrada (revertir cobro)
   * Elimina los pagos y vuelve la orden a estado READY
   */
  reopenOrder: async (orderId: string, userId: string) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new AppError('Orden no encontrada', 404);
    if (order.status !== 'CLOSED') throw new AppError('Solo se pueden reabrir órdenes cerradas', 400);

    // Delete all payments for this order
    await prisma.payment.deleteMany({ where: { orderId } });

    // Reopen the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'READY',
        closedAt: null,
        closedById: null,
        discount: 0,
        discountType: null,
        discountReason: null,
      },
    });

    // If order had a table, mark it as OCCUPIED again
    if (order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    // Log event
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await logEvent(orderId, 'REOPENED', userId, user?.name || 'Admin', `Orden reabierta. Pagos revertidos: $${order.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}`);

    return { success: true, message: 'Orden reabierta. Los pagos fueron eliminados.' };
  },
};
