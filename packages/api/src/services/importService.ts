import Papa from 'papaparse';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

interface ImportResult {
  type: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Loyverse CSV Import Service
 * Parses and imports data exported from Loyverse POS into our schema.
 */
export const importService = {
  /**
   * Import Items (Products) from Loyverse CSV
   * Loyverse columns: Handle, SKU, Name, Category, Description, Cost, Price, Available for sale, Track stock, In stock
   */
  importItems: async (csvContent: string): Promise<ImportResult> => {
    const result: ImportResult = { type: 'items', created: 0, updated: 0, skipped: 0, errors: [] };

    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
    if (parsed.errors.length > 0) {
      throw new AppError(`Error al parsear CSV: ${parsed.errors[0].message}`, 400);
    }

    const rows = parsed.data as Record<string, string>[];
    if (rows.length === 0) {
      throw new AppError('El archivo CSV está vacío', 400);
    }

    // Detect column names (Loyverse uses English or Spanish headers)
    const firstRow = rows[0];
    const getCol = (row: Record<string, string>, ...names: string[]): string => {
      for (const name of names) {
        if (row[name] !== undefined) return row[name]?.trim() || '';
      }
      return '';
    };

    // Group categories to create/find
    const categoryMap: Record<string, string> = {}; // categoryName -> categoryId

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = getCol(row, 'Name', 'Nombre', 'Item Name');
        const categoryName = getCol(row, 'Category', 'Categoría', 'Categoria');
        const priceStr = getCol(row, 'Price', 'Precio', 'Default price');
        const description = getCol(row, 'Description', 'Descripción', 'Descripcion');
        const sku = getCol(row, 'SKU');
        const inStockStr = getCol(row, 'In stock', 'En stock', 'Stock');
        const trackStock = getCol(row, 'Track stock', 'Rastrear stock');

        if (!name) {
          result.skipped++;
          continue;
        }

        const price = parseFloat(priceStr) || 0;

        // Find or create category
        let categoryId: string;
        const catKey = categoryName || 'Sin categoría';
        if (categoryMap[catKey]) {
          categoryId = categoryMap[catKey];
        } else {
          let category = await prisma.category.findFirst({ where: { name: catKey } });
          if (!category) {
            category = await prisma.category.create({ data: { name: catKey } });
          }
          categoryMap[catKey] = category.id;
          categoryId = category.id;
        }

        // Check if product already exists (by name + category)
        const existing = await prisma.product.findFirst({ where: { name, categoryId } });
        if (existing) {
          // Update price if different
          if (existing.price !== price) {
            await prisma.product.update({ where: { id: existing.id }, data: { price, description: description || existing.description } });
            result.updated++;
          } else {
            result.skipped++;
          }
        } else {
          // Create new product
          await prisma.product.create({
            data: { name, price, categoryId, description: description || null, active: true },
          });
          result.created++;
        }

        // Handle stock if tracking enabled
        if ((trackStock === 'Y' || trackStock === 'y') && inStockStr) {
          const stockQty = parseFloat(inStockStr);
          if (!isNaN(stockQty) && stockQty > 0) {
            // Create ingredient for stock tracking (if not exists)
            const ingredientName = name;
            let ingredient = await prisma.ingredient.findFirst({ where: { name: ingredientName } });
            if (!ingredient) {
              ingredient = await prisma.ingredient.create({
                data: { name: ingredientName, stock: stockQty, unit: 'PZ' },
              });
            }
          }
        }
      } catch (err: any) {
        result.errors.push(`Fila ${i + 2}: ${err.message || 'Error desconocido'}`);
      }
    }

    return result;
  },

  /**
   * Import Customers from Loyverse CSV
   * Loyverse columns: Name, Email, Phone, Note, Total visits, Total spent, Points balance
   */
  importCustomers: async (csvContent: string): Promise<ImportResult> => {
    const result: ImportResult = { type: 'customers', created: 0, updated: 0, skipped: 0, errors: [] };

    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
    if (parsed.errors.length > 0) {
      throw new AppError(`Error al parsear CSV: ${parsed.errors[0].message}`, 400);
    }

    const rows = parsed.data as Record<string, string>[];
    if (rows.length === 0) {
      throw new AppError('El archivo CSV está vacío', 400);
    }

    const getCol = (row: Record<string, string>, ...names: string[]): string => {
      for (const name of names) {
        if (row[name] !== undefined) return row[name]?.trim() || '';
      }
      return '';
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const fullName = getCol(row, 'Name', 'Nombre', 'Customer name');
        const email = getCol(row, 'Email', 'Correo');
        const phone = getCol(row, 'Phone', 'Teléfono', 'Phone number', 'Telefono');
        const notes = getCol(row, 'Note', 'Nota', 'Notes');
        const totalVisitsStr = getCol(row, 'Total visits', 'Visitas totales');
        const totalSpentStr = getCol(row, 'Total spent', 'Total gastado');
        const pointsStr = getCol(row, 'Points balance', 'Puntos', 'Points');

        if (!fullName) {
          result.skipped++;
          continue;
        }

        // Split name into first/last
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || fullName;
        const lastName = nameParts.slice(1).join(' ') || '';

        const totalVisits = parseInt(totalVisitsStr) || 0;
        const totalSpent = parseFloat(totalSpentStr) || 0;
        const loyaltyPoints = parseInt(pointsStr) || 0;

        // Check if customer already exists (by phone or email)
        let existing = null;
        if (phone) {
          existing = await prisma.customer.findFirst({ where: { phone } });
        }
        if (!existing && email) {
          existing = await prisma.customer.findFirst({ where: { email } });
        }

        if (existing) {
          // Update with Loyverse data if it has more info
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              ...(totalVisits > existing.totalVisits && { totalVisits }),
              ...(totalSpent > existing.totalSpent && { totalSpent }),
              ...(loyaltyPoints > existing.loyaltyPoints && { loyaltyPoints }),
              ...(notes && !existing.notes && { notes }),
            },
          });
          result.updated++;
        } else {
          await prisma.customer.create({
            data: {
              firstName,
              lastName,
              phone: phone || null,
              email: email || null,
              notes: notes || null,
              totalVisits,
              totalSpent,
              loyaltyPoints,
            },
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`Fila ${i + 2}: ${err.message || 'Error desconocido'}`);
      }
    }

    return result;
  },

  /**
   * Import Receipts (Sales History) from Loyverse CSV
   * Loyverse "Receipts by item" columns: Receipt number, Date, Item, Category, Quantity, Price, Discount, Total, Payment type, Employee
   */
  importReceipts: async (csvContent: string, userId: string): Promise<ImportResult> => {
    const result: ImportResult = { type: 'receipts', created: 0, updated: 0, skipped: 0, errors: [] };

    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
    if (parsed.errors.length > 0) {
      throw new AppError(`Error al parsear CSV: ${parsed.errors[0].message}`, 400);
    }

    const rows = parsed.data as Record<string, string>[];
    if (rows.length === 0) {
      throw new AppError('El archivo CSV está vacío', 400);
    }

    const getCol = (row: Record<string, string>, ...names: string[]): string => {
      for (const name of names) {
        if (row[name] !== undefined) return row[name]?.trim() || '';
      }
      return '';
    };

    // Group rows by receipt number
    const receiptGroups: Record<string, typeof rows> = {};
    for (const row of rows) {
      const receiptNum = getCol(row, 'Receipt number', 'Número de recibo', 'Receipt Number', 'No. Recibo');
      if (!receiptNum) continue;
      if (!receiptGroups[receiptNum]) receiptGroups[receiptNum] = [];
      receiptGroups[receiptNum].push(row);
    }

    // Get last ticket number
    const lastOrder = await prisma.order.findFirst({ orderBy: { ticketNumber: 'desc' } });
    let nextTicket = (lastOrder?.ticketNumber || 0) + 1;

    for (const [receiptNum, items] of Object.entries(receiptGroups)) {
      try {
        // Check if already imported (by checking if an order with this exact ticket exists)
        const existingOrder = await prisma.order.findFirst({
          where: { ticketNumber: parseInt(receiptNum) || 0 },
        });
        if (existingOrder) {
          result.skipped++;
          continue;
        }

        const firstItem = items[0];
        const dateStr = getCol(firstItem, 'Date', 'Fecha');
        const paymentType = getCol(firstItem, 'Payment type', 'Tipo de pago', 'Payment Type');

        // Parse date
        let orderDate = new Date();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) orderDate = parsedDate;
        }

        // Map payment method
        let method = 'CASH';
        const payLower = paymentType.toLowerCase();
        if (payLower.includes('card') || payLower.includes('tarjeta')) method = 'CARD';
        else if (payLower.includes('transfer') || payLower.includes('transferencia')) method = 'TRANSFER';

        // Calculate total
        let orderTotal = 0;
        const orderItems: { productName: string; quantity: number; unitPrice: number }[] = [];

        for (const item of items) {
          const itemName = getCol(item, 'Item', 'Artículo', 'Item name', 'Producto');
          const qtyStr = getCol(item, 'Quantity', 'Cantidad', 'Qty');
          const priceStr = getCol(item, 'Price', 'Precio');
          const totalStr = getCol(item, 'Total', 'Total line');

          const quantity = Math.abs(parseInt(qtyStr) || 1);
          const unitPrice = Math.abs(parseFloat(priceStr) || 0);
          const lineTotal = Math.abs(parseFloat(totalStr) || (unitPrice * quantity));

          if (itemName) {
            orderItems.push({ productName: itemName, quantity, unitPrice });
            orderTotal += lineTotal;
          }
        }

        if (orderItems.length === 0) {
          result.skipped++;
          continue;
        }

        // Create order (as CLOSED — it's historical)
        const order = await prisma.order.create({
          data: {
            userId,
            type: 'DINE_IN',
            status: 'CLOSED',
            ticketNumber: nextTicket++,
            subtotal: orderTotal,
            total: orderTotal,
            closedAt: orderDate,
            closedById: userId,
            createdAt: orderDate,
          },
        });

        // Create order items (link to existing products if possible)
        for (const item of orderItems) {
          let product = await prisma.product.findFirst({ where: { name: item.productName } });
          if (!product) {
            // Create product in "Importados" category
            let importCat = await prisma.category.findFirst({ where: { name: 'Importados (Loyverse)' } });
            if (!importCat) {
              importCat = await prisma.category.create({ data: { name: 'Importados (Loyverse)' } });
            }
            product = await prisma.product.create({
              data: { name: item.productName, price: item.unitPrice, categoryId: importCat.id },
            });
          }

          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              status: 'DELIVERED',
            },
          });
        }

        // Create payment record
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: orderTotal,
            method: method as any,
            status: 'COMPLETED',
            userId,
            createdAt: orderDate,
          },
        });

        result.created++;
      } catch (err: any) {
        result.errors.push(`Recibo ${receiptNum}: ${err.message || 'Error desconocido'}`);
      }
    }

    return result;
  },
};
