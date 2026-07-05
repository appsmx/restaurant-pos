import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No autorizado. Token faltante.', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretposjwt') as { userId: string };
    const session = await prisma.session.findFirst({
      where: { token, locked: false, expiresAt: { gt: new Date() } },
    });
    if (!session) {
      throw new AppError('Sesión inválida o expirada.', 401);
    }
    req.userId = decoded.userId;
    next();
  } catch (error) {
    next(new AppError('Token inválido o expirado.', 401));
  }
};