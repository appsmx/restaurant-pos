import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'Ya existe un registro con ese valor único.' });
  }
  return res.status(500).json({ success: false, message: 'Error interno del servidor' });
};