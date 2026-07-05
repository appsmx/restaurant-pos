import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretposjwt';

export const authService = {
  login: async (username: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new AppError('Credenciales inválidas', 401);
    if (!user.active) throw new AppError('Usuario inactivo', 403);
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Credenciales inválidas', 401);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '8h' });
    await prisma.session.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) }
    });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  },
  logout: async (token: string) => {
    await prisma.session.deleteMany({ where: { token } });
    return { success: true };
  }
};