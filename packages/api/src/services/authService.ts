import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretposjwt';

export const authService = {
  /**
   * Login con username + password (modo tradicional)
   *
   * Multi-tenant: If a slug is provided, scope the search to that tenant.
   * If no slug, find ALL matching users and check password (backward compat).
   */
  login: async (username: string, password: string, slug?: string) => {
    let users;

    if (slug) {
      // Scoped login: find user within the specific tenant
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) throw new AppError('Negocio no encontrado', 404);
      if (!tenant.active) throw new AppError('Este negocio está desactivado. Contacta soporte.', 403);

      users = await prisma.user.findMany({ where: { username, tenantId: tenant.id } });
    } else {
      // Global login (backward compat — searches all tenants)
      users = await prisma.user.findMany({ where: { username } });
    }

    if (!users || users.length === 0) throw new AppError('Credenciales inválidas', 401);

    // Try password against each user until we find the right one
    for (const user of users) {
      if (!user.active) continue;

      // Check tenant is active (when no slug was provided)
      if (!slug) {
        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (!tenant || !tenant.active) continue;
      }

      const valid = await bcrypt.compare(password, user.password);
      if (valid) {
        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true, name: true } });
        const token = jwt.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '8h' });
        await prisma.session.create({
          data: { tenantId: user.tenantId, userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
        });
        return {
          token,
          user: { id: user.id, username: user.username, name: user.name, role: user.role },
          tenantId: user.tenantId,
          tenant: { slug: tenant?.slug, name: tenant?.name },
        };
      }
    }

    // No match found
    throw new AppError('Credenciales inválidas', 401);
  },

  /**
   * Login con PIN de 4 dígitos (modo rápido para restaurante)
   *
   * If slug is provided, scope to that tenant. Otherwise global search.
   */
  loginWithPin: async (pin: string, slug?: string) => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      throw new AppError('El PIN debe ser de 4 dígitos', 400);
    }

    let users;

    if (slug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) throw new AppError('Negocio no encontrado', 404);
      if (!tenant.active) throw new AppError('Este negocio está desactivado. Contacta soporte.', 403);

      users = await prisma.user.findMany({ where: { pin, tenantId: tenant.id } });
    } else {
      users = await prisma.user.findMany({ where: { pin } });
    }

    if (!users || users.length === 0) throw new AppError('PIN incorrecto', 401);

    for (const user of users) {
      if (!user.active) continue;

      // Check tenant is active
      if (!slug) {
        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
        if (!tenant || !tenant.active) continue;
      }

      // Verify against pinHash if exists, otherwise direct match
      let isValid = false;
      if (user.pinHash) {
        isValid = await bcrypt.compare(pin, user.pinHash);
      } else {
        isValid = true; // Legacy: PIN stored as plaintext, direct match
      }

      if (isValid) {
        const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { slug: true, name: true } });
        const token = jwt.sign({ userId: user.id, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '8h' });
        await prisma.session.create({
          data: { tenantId: user.tenantId, userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
        });
        return {
          token,
          user: { id: user.id, username: user.username, name: user.name, role: user.role },
          tenantId: user.tenantId,
          tenant: { slug: tenant?.slug, name: tenant?.name },
        };
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

    // Get user's tenant to scope uniqueness check
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    if (!user) throw new AppError('Usuario no encontrado', 404);

    const existing = await prisma.user.findFirst({ where: { pin, tenantId: user.tenantId, id: { not: userId } } });
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
