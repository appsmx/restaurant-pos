import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const menuService = {
  getCategories: async () => {
    return prisma.category.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  },

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
  }
};