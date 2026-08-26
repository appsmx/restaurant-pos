import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretposjwt';

export const authService = {
  /**
   * Login con username + password (modo tradicional)
   *
   * Multi-tenant: since the same username can exist in multiple tenants
   * (e.g., "gerencia" in Quiroa AND "gerencia" in El Zahir), we find ALL
   * matching users and check the password against each one until we find
   * a match. This allows login without prior tenant context.
   */
  login: async (username: string, password: string) => {
    // Find ALL users with this username (across all tenants)
    const users = await prisma.user.findMany({ where: { username } });
    if (!users || users.length === 0) throw new AppError('Credenciales inválidas', 401);

    // Try password against each user until we find the right one
    for (const user of users) {
      if (!user.active) continue;
      const valid = await bcrypt.compare(password, user.password);
      if (valid) {
        const token = jwt.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '8h' });
        await prisma.session.create({
          data: { tenantId: user.tenantId, userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
        });
        return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role }, tenantId: user.tenantId };
      }
    }

    // No match found
    throw new AppError('Credenciales inválidas', 401);
  },

  /**
   * Login con PIN de 4 dígitos (modo rápido para restaurante)
   *
   * Same multi-tenant approach: find all users with this PIN, verify each.
   */
  loginWithPin: async (pin: string) => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new AppError('El PIN debe ser de 4 dígitos', 400);
    }

    const users = await prisma.user.findMany({ where: { pin } });
    if (!users || users.length === 0) throw new AppError('PIN incorrecto', 401);

    for (const user of users) {
      if (!user.active) continue;

      // Verify against pinHash if exists, otherwise direct match
      if (user.pinHash) {
        const valid = await bcrypt.compare(pin, user.pinHash);
        if (valid) {
          const token = jwt.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '8h' });
          await prisma.session.create({
            data: { tenantId: user.tenantId, userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
          });
          return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role }, tenantId: user.tenantId };
        }
      } else {
        // Legacy: PIN stored as plaintext, direct match is enough
        const token = jwt.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '8h' });
        await prisma.session.create({
          data: { tenantId: user.tenantId, userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
        });
        return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role }, tenantId: user.tenantId };
      }
    }

    throw new AppError('PIN incorrecto', 401);
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
