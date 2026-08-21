import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const recipeService = {
  /**
   * Obtener la receta de un producto (lista de ingredientes con cantidades)
   */
  getRecipeByProduct: async (productId: string) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    const recipe = await prisma.recipeIngredient.findMany({
      where: { productId },
      include: {
        ingredient: { select: { id: true, name: true, unit: true, stock: true } },
      },
      orderBy: { ingredient: { name: 'asc' } },
    });

    return { product: { id: product.id, name: product.name }, ingredients: recipe };
  },

  /**
   * Agregar un ingrediente a la receta de un producto
   */
  addIngredientToRecipe: async (productId: string, ingredientId: string, quantity: number) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    if (!ingredient) throw new AppError('Ingrediente no encontrado', 404);

    // Verificar si ya existe la relación
    const existing = await prisma.recipeIngredient.findFirst({
      where: { productId, ingredientId },
    });

    if (existing) {
      // Si ya existe, actualizar la cantidad
      return prisma.recipeIngredient.update({
        where: { id: existing.id },
        data: { quantity },
        include: { ingredient: { select: { id: true, name: true, unit: true } } },
      });
    }

    // Si no existe, crear
    return prisma.recipeIngredient.create({
      data: { productId, ingredientId, quantity },
      include: { ingredient: { select: { id: true, name: true, unit: true } } },
    });
  },

  /**
   * Actualizar la cantidad de un ingrediente en una receta
   */
  updateRecipeIngredient: async (recipeIngredientId: string, quantity: number) => {
    const ri = await prisma.recipeIngredient.findUnique({ where: { id: recipeIngredientId } });
    if (!ri) throw new AppError('Ingrediente de receta no encontrado', 404);

    return prisma.recipeIngredient.update({
      where: { id: recipeIngredientId },
      data: { quantity },
      include: { ingredient: { select: { id: true, name: true, unit: true } } },
    });
  },

  /**
   * Eliminar un ingrediente de una receta
   */
  removeIngredientFromRecipe: async (recipeIngredientId: string) => {
    const ri = await prisma.recipeIngredient.findUnique({ where: { id: recipeIngredientId } });
    if (!ri) throw new AppError('Ingrediente de receta no encontrado', 404);

    await prisma.recipeIngredient.delete({ where: { id: recipeIngredientId } });
    return { success: true };
  },

  /**
   * Reemplazar toda la receta de un producto (bulk update)
   */
  setRecipe: async (productId: string, ingredients: { ingredientId: string; quantity: number }[]) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    // Eliminar receta actual y crear la nueva en una transacción
    await prisma.$transaction([
      prisma.recipeIngredient.deleteMany({ where: { productId } }),
      ...ingredients.map((ing) =>
        prisma.recipeIngredient.create({
          data: {
            productId,
            ingredientId: ing.ingredientId,
            quantity: ing.quantity,
          },
        })
      ),
    ]);

    // Retornar la receta actualizada
    return recipeService.getRecipeByProduct(productId);
  },
};
