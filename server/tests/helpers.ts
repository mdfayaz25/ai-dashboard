import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

export const app = createApp();

export async function createUser(overrides: Partial<{ name: string; email: string; password: string; role: 'user' | 'admin' }> = {}) {
  const data = {
    name: 'Test User',
    email: `user${Math.random().toString(36).slice(2, 8)}@example.com`,
    password: 'password123',
    role: 'user' as const,
    ...overrides,
  };
  await User.create(data);
  const res = await request(app).post('/api/auth/login').send({ email: data.email, password: data.password });
  return { token: res.body.token as string, user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}
