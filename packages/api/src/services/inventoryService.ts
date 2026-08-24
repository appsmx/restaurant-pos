import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const inventoryService = {
  // ==================== INGREDIENTES ====================

  /**
   * Listar todos los ingredientes con stock actual
   */
  getIngredients: async () => {
    return prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { recipes: true } },
      },
    });
  },

  /**
   * Obtener un ingrediente con su historial de movimientos reciente
   */
  getIngredientById: async (id: string) => {
    const ingredient = await prisma.ingredient.findUnique({
      where: { id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { name: true } } },
        },
        recipes: {
          include: { product: { select: { name: true } } },
        },
      },
    });
    if (!ingredient) throw new AppError('Ingrediente no encontrado', 404);
    return ingredient;
  },

  /**
   * Crear un ingrediente nuevo
   */
  createIngredient: async (data: { name: string; stock?: number; unit?: string }) => {
    return prisma.ingredient.create({
      data: {
        name: data.name,
        stock: data.stock || 0,
        unit: data.unit || 'UNIT',
      },
    });
  },

  /**
   * Actualizar nombre/unidad de un ingrediente
   */
  updateIngredient: async (id: string, data: { name?: string; unit?: string }) => {
    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) throw new AppError('Ingrediente no encontrado', 404);

    return prisma.ingredient.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.unit && { unit: data.unit }),
      },
    });
  },

  // ==================== MOVIMIENTOS DE STOCK ====================

  /**
   * Registrar un movimiento de stock (entrada, salida, ajuste, desperdicio)
   */
  createMovement: async (data: {
    ingredientId: string;
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE';
    quantity: number;
    reason?: string;
    userId: string;
  }) => {
    const ingredient = await prisma.ingredient.findUnique({ where: { id: data.ingredientId } });
    if (!ingredient) throw new AppError('Ingrediente no encontrado', 404);

    // Calcular nuevo stock
    let newStock: number;
    switch (data.type) {
      case 'IN':
        newStock = ingredient.stock + data.quantity;
        break;
      case 'OUT':
      case 'WASTE':
        newStock = ingredient.stock - data.quantity;
        if (newStock < 0) newStock = 0; // No permitir stock negativo
        break;
      case 'ADJUSTMENT':
        newStock = data.quantity; // Ajuste establece el valor absoluto
        break;
      default:
        newStock = ingredient.stock;
    }

    // Crear el movimiento y actualizar stock en una transacción
    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          ingredientId: data.ingredientId,
          type: data.type as any,
          quantity: data.quantity,
          reason: data.reason || null,
          userId: data.userId,
        },
      }),
      prisma.ingredient.update({
        where: { id: data.ingredientId },
        data: { stock: newStock },
      }),
    ]);

    return { movement, newStock };
  },

  /**
   * Obtener historial de movimientos (con filtros opcionales)
   */
  getMovements: async (ingredientId?: string, limit: number = 50) => {
    return prisma.stockMovement.findMany({
      where: ingredientId ? { ingredientId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        ingredient: { select: { name: true, unit: true } },
        user: { select: { name: true } },
      },
    });
  },

  // ==================== DESCUENTO AUTOMÁTICO ====================

  /**
   * Descontar stock de ingredientes basado en los items de una orden
   * Se llama al cerrar una orden (desde orderService.closeOrder)
   */
  deductStockForOrder: async (orderId: string, userId: string) => {
    // Obtener los items de la orden con sus recetas
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      include: {
        product: {
          include: {
            ingredients: {
              include: { ingredient: true },
            },
          },
        },
      },
    });

    const deductions: { ingredientId: string; ingredientName: string; quantity: number }[] = [];

    for (const item of orderItems) {
      for (const recipe of item.product.ingredients) {
        const totalQuantity = recipe.quantity * item.quantity;
        deductions.push({
          ingredientId: recipe.ingredientId,
          ingredientName: recipe.ingredient.name,
          quantity: totalQuantity,
        });
      }
    }

    // Ejecutar descuentos en batch
    if (deductions.length > 0) {
      const operations = deductions.map((d) => [
        prisma.stockMovement.create({
          data: {
            ingredientId: d.ingredientId,
            type: 'OUT',
            quantity: d.quantity,
            reason: `Venta - Orden ${orderId.slice(0, 8)}`,
            userId,
          },
        }),
        prisma.ingredient.update({
          where: { id: d.ingredientId },
          data: { stock: { decrement: d.quantity } },
        }),
      ]).flat();

      await prisma.$transaction(operations);
    }

    return deductions;
  },

  // ==================== ALERTAS DE STOCK BAJO ====================

  /**
   * Obtener ingredientes con stock por debajo del umbral
   */
  getLowStockAlerts: async (threshold: number = 10) => {
    const ingredients = await prisma.ingredient.findMany({
      where: { stock: { lte: threshold } },
      orderBy: { stock: 'asc' },
      include: {
        _count: { select: { recipes: true } },
      },
    });

    return ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      stock: Math.round(i.stock * 100) / 100,
      unit: i.unit,
      recipesCount: i._count.recipes,
      severity: i.stock <= 3 ? 'CRITICAL' : i.stock <= threshold ? 'LOW' : 'OK',
    }));
  },
};
