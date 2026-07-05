export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  constructor(message: string, statusCode: number = 400, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}