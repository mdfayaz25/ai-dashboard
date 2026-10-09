import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError.js';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields = err.flatten().fieldErrors;
        const first = Object.entries(fields)[0];
        const msg = first ? `${first[0]}: ${first[1]?.[0]}` : 'Invalid request';
        return next(AppError.badRequest(msg, fields));
      }
      next(err);
    }
  };
