import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';
import { isProd } from '../config/env.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors)[0]?.message ?? 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue ?? {})[0] ?? 'Value'} already exists`;
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message, ...(details ? { details } : {}), ...(!isProd && status >= 500 ? { stack: err?.stack } : {}) });
};
