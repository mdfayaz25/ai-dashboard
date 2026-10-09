import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../lib/jwt.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(AppError.unauthorized());
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Your session has expired. Please sign in again.'));
  }
};

export const requireRole =
  (...roles: Array<'user' | 'admin'>): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
