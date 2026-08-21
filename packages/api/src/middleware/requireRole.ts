import { AuthRequest } from './auth';
import { Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return next(new AppError('No autenticado', 401));
    }
    if (!req.userRole) {
      return next(new AppError('Rol de usuario no disponible', 500));
    }
    if (!roles.includes(req.userRole)) {
      return next(new AppError(`Acceso denegado. Se requiere rol: ${roles.join(' o ')}`, 403));
    }
    next();
  };
};