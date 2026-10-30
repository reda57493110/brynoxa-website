import { Request, Response, NextFunction } from 'express';
import { z, type ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodType, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = z.flattenError(result.error) as { fieldErrors: Record<string, string[] | undefined> };
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
