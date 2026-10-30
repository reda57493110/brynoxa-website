import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { duplicateKeyMessage } from '../utils/duplicateKey';
import { env, isProd } from '../config/env';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  if (err && typeof err === 'object' && 'name' in err && err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: (err as unknown as { errors: unknown }).errors,
    });
  }

  const taken = duplicateKeyMessage(err);
  if (taken) {
    return res.status(409).json({
      success: false,
      message: taken,
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
