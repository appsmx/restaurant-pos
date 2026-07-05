import { AuthRequest } from './auth';
import { Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return next(new AppError('No autenticado', 401));
    next();
  };
};