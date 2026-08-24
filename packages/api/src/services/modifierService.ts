import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const modifierService = {
  /**
   * Get all modifier groups with their items (for a tenant)
   */
  getGroups: async (tenantId: string) => {
    return prisma.modifierGroup.findMany({
      where: { tenantId },
      include: {
        modifiers: { orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Create a modifier group
   */
  createGroup: async (tenantId: string, data: { name: string; required?: boolean; minSelect?: number; maxSelect?: number }) => {
    return prisma.modifierGroup.create({
      data: {
        tenantId,
        name: data.name,
        required: data.required || false,
        minSelect: data.minSelect || 0,
        maxSelect: data.maxSelect || 1,
      },
      include: { modifiers: true },
    });
  },

  /**
   * Update a modifier group
   */
  updateGroup: async (groupId: string, data: { name?: string; required?: boolean; minSelect?: number; maxSelect?: number }) => {
    const group = await prisma.modifierGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Grupo no encontrado', 404);

    return prisma.modifierGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.required !== undefined && { required: data.required }),
        ...(data.minSelect !== undefined && { minSelect: data.minSelect }),
        ...(data.maxSelect !== undefined && { maxSelect: data.maxSelect }),
      },
      include: { modifiers: true },
    });
  },

  /**
   * Delete a modifier group (and all its items)
   */
  deleteGroup: async (groupId: string) => {
    const group = await prisma.modifierGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Grupo no encontrado', 404);

    await prisma.modifierItem.deleteMany({ where: { groupId } });
    await prisma.modifierGroup.delete({ where: { id: groupId } });
    return { success: true };
  },

  /**
   * Add a modifier item to a group
   */
  createItem: async (tenantId: string, groupId: string, data: { name: string; price?: number }) => {
    const group = await prisma.modifierGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new AppError('Grupo no encontrado', 404);

    return prisma.modifierItem.create({
      data: {
        tenantId,
        groupId,
        name: data.name,
        price: data.price || 0,
      },
    });
  },

  /**
   * Update a modifier item
   */
  updateItem: async (itemId: string, data: { name?: string; price?: number }) => {
    const item = await prisma.modifierItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Modificador no encontrado', 404);

    return prisma.modifierItem.update({
      where: { id: itemId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.price !== undefined && { price: data.price }),
      },
    });
  },

  /**
   * Delete a modifier item
   */
  deleteItem: async (itemId: string) => {
    const item = await prisma.modifierItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError('Modificador no encontrado', 404);

    await prisma.modifierItem.delete({ where: { id: itemId } });
    return { success: true };
  },

  /**
   * Assign modifier groups to a product (link items to product)
   */
  assignToProduct: async (productId: string, modifierItemIds: string[]) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Producto no encontrado', 404);

    await prisma.product.update({
      where: { id: productId },
      data: {
        modifiers: { set: modifierItemIds.map((id) => ({ id })) },
      },
    });

    return prisma.product.findUnique({
      where: { id: productId },
      include: { modifiers: { include: { group: true } } },
    });
  },

  /**
   * Get modifiers for a specific product (grouped)
   */
  getProductModifiers: async (productId: string) => {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        modifiers: { include: { group: true } },
      },
    });
    if (!product) throw new AppError('Producto no encontrado', 404);

    // Group by modifier group
    const groups: Record<string, { id: string; name: string; required: boolean; minSelect: number; maxSelect: number; items: any[] }> = {};
    for (const mod of product.modifiers) {
      if (!groups[mod.groupId]) {
        groups[mod.groupId] = {
          id: mod.group.id,
          name: mod.group.name,
          required: mod.group.required,
          minSelect: mod.group.minSelect,
          maxSelect: mod.group.maxSelect,
          items: [],
        };
      }
      groups[mod.groupId].items.push({ id: mod.id, name: mod.name, price: mod.price });
    }

    return Object.values(groups);
  },
};
