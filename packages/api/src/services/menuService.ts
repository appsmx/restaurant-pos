import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const menuService = {
  // ==================== CATEGORÍAS ====================

  getCategories: async () => {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: { name: 'asc' },
          include: { _count: { select: { modifiers: true } } },
        },
      },
    });

    // Add hasModifiers flag to each product
    return categories.map((cat) => ({
      ...cat,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        hasModifiers: p._count.modifiers > 0,
      })),
    }));
  },

  getAllCategories: async () => {
    return prisma.category.findMany({
      orderBy: { sort: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  },

  createCategory: async (data: { name: string; sort?: number }) => {
    return prisma.category.create({
      data: {
        name: data.name,
        sort: data.sort || 0,
      },
    });
  },

  updateCategory: async (id: string, data: { name?: string; sort?: number; active?: boolean }) => {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new AppError('Categoría no encontrada', 404);

    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sort !== undefined && { sort: data.sort }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
  },

  deleteCategory: async (id: string) => {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new AppError('Categoría no encontrada', 404);
    if (category._count.products > 0) {
      throw new AppError('No se puede eliminar una categoría con productos. Mueve o elimina los productos primero.', 400);
    }

    await prisma.category.delete({ where: { id } });
    return { success: true };
  },

  // ==================== PRODUCTOS ====================

  getProducts: async (categoryId?: string) => {
    return prisma.product.findMany({
      where: { 
        active: true,
        ...(categoryId ? { categoryId } : {})
      },
      include: { modifiers: true },
      orderBy: { name: 'asc' },
    });
  },

  getAllProducts: async (categoryId?: string) => {
    return prisma.product.findMany({
      where: categoryId ? { categoryId } : {},
      include: { 
        category: { select: { name: true } },
        _count: { select: { ingredients: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  createProduct: async (data: any) => {
    if (!data.name || !data.price || !data.categoryId) {
      throw new AppError('Nombre, precio y categoría son obligatorios', 400);
    }
    return prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price,
        categoryId: data.categoryId,
        type: data.type || 'STANDARD',
      }
    });
  },

  updateProduct: async (id: string, data: { name?: string; description?: string; price?: number; categoryId?: string; active?: boolean }) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    return prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: { category: { select: { name: true } } },
    });
  },

  deleteProduct: async (id: string) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    // Soft delete — just deactivate
    await prisma.product.update({ where: { id }, data: { active: false } });
    return { success: true };
  },
};