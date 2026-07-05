import { AuthRequest } from './auth';
import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const sessionTimeout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.userId) return next();
  const session = await prisma.session.findFirst({ where: { userId: req.userId, locked: false } });
  if (session && session.expiresAt < new Date()) {
    await prisma.session.update({ where: { id: session.id }, data: { locked: true } });
    return next(new AppError('La sesión ha expirado por inactividad.', 401));
  }
  next();
};