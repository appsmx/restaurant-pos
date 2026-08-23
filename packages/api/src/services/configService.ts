import { prisma } from '../lib/prisma';

export const configService = {
  /**
   * Obtener la configuración del restaurante (crea una por defecto si no existe)
   */
  getConfig: async () => {
    let config = await prisma.restaurantConfig.findUnique({ where: { id: 'main' } });
    if (!config) {
      config = await prisma.restaurantConfig.create({
        data: { id: 'main', name: 'Mi Restaurante' },
      });
    }
    return config;
  },

  /**
   * Actualizar configuración del restaurante
   */
  updateConfig: async (data: {
    name?: string;
    address?: string;
    phone?: string;
    rfc?: string;
    taxRate?: number;
    currency?: string;
    logoUrl?: string;
  }) => {
    // Asegurar que existe
    await configService.getConfig();

    return prisma.restaurantConfig.update({
      where: { id: 'main' },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.rfc !== undefined && { rfc: data.rfc || null }),
        ...(data.taxRate !== undefined && { taxRate: data.taxRate }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
      },
    });
  },
};
