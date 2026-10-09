import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type TokenPayload = { sub: string; role: 'user' | 'admin' };

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload & jwt.JwtPayload;
}
