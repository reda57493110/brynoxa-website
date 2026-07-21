import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
  message = 'Success'
) {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      ...meta,
      pages: Math.ceil(meta.total / meta.limit) || 1,
    },
  });
}
