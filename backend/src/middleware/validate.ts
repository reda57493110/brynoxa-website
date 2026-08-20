import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.flatten();
      const first = Object.entries(errors.fieldErrors)
        .flatMap(([field, msgs]) => (msgs || []).map((m) => `${field}: ${m}`))
        .slice(0, 3);
      const message = first.length ? `Validation failed — ${first.join('; ')}` : 'Validation failed';
      return next(new ApiError(400, message, errors.fieldErrors));
    }
    req[source] = result.data;
    next();
  };
}
