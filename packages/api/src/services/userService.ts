import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import bcrypt from 'bcrypt';

export const userService = {
  /**
   * Listar todos los usuarios (sin contraseñas)
   */
  getUsers: async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Crear un usuario nuevo
   */
  createUser: async (data: { username: string; password: string; name: string; role: string }) => {
    // Verificar que el username no exista
    const existing = await prisma.user.findFirst({ where: { username: data.username } });
    if (existing) {
      throw new AppError('El nombre de usuario ya está en uso', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    return prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        role: data.role as any,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
  },

  /**
   * Activar o desactivar un usuario
   */
  toggleUserActive: async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Usuario no encontrado', 404);

    return prisma.user.update({
      where: { id: userId },
      data: { active: !user.active },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
      },
    });
  },

  /**
   * Actualizar rol de un usuario
   */
  updateUserRole: async (userId: string, role: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Usuario no encontrado', 404);

    return prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
      },
    });
  },

  /**
   * Resetear contraseña de un usuario
   */
  resetPassword: async (userId: string, newPassword: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('Usuario no encontrado', 404);

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  },
};
