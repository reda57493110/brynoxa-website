import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { env, isProd } from '../config/env';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err && typeof err === 'object' && 'name' in err && err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: (err as unknown as { errors: unknown }).errors,
    });
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry',
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: isProd ? 'Internal server error' : (err as Error)?.message || 'Internal server error',
  });
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'Route not found'));
}

void env;
