import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretposjwt';

export const authService = {
  /**
   * Login con username + password (modo tradicional)
   */
  login: async (username: string, password: string) => {
    const user = await prisma.user.findFirst({ where: { username } });
    if (!user) throw new AppError('Credenciales inválidas', 401);
    if (!user.active) throw new AppError('Usuario inactivo', 403);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Credenciales inválidas', 401);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
    await prisma.session.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
    });
    return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  },

  /**
   * Login con PIN de 4 dígitos (modo rápido para restaurante)
   */
  loginWithPin: async (pin: string) => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new AppError('El PIN debe ser de 4 dígitos', 400);
    }

    // Buscar usuario por PIN (el campo pin es único)
    const user = await prisma.user.findFirst({ where: { pin } });
    if (!user) throw new AppError('PIN incorrecto', 401);
    if (!user.active) throw new AppError('Usuario inactivo', 403);

    // Verificar contra pinHash si existe (más seguro), o comparar directamente
    if (user.pinHash) {
      const valid = await bcrypt.compare(pin, user.pinHash);
      if (!valid) throw new AppError('PIN incorrecto', 401);
    }
    // Si no hay pinHash pero sí pin match (legacy), aceptar

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
    await prisma.session.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
    });
    return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  },

  /**
   * Logout — invalidar sesión
   */
  logout: async (token: string) => {
    await prisma.session.deleteMany({ where: { token } });
    return { success: true };
  },

  /**
   * Asignar o cambiar PIN de un usuario
   */
  setPin: async (userId: string, pin: string) => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new AppError('El PIN debe ser exactamente 4 dígitos numéricos', 400);
    }

    // Verificar que el PIN no esté en uso por otro usuario
    const existing = await prisma.user.findFirst({ where: { pin, id: { not: userId } } });
    if (existing) {
      throw new AppError('Este PIN ya está en uso por otro empleado', 409);
    }

    const pinHash = await bcrypt.hash(pin, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { pin, pinHash },
    });

    return { success: true };
  },
};
