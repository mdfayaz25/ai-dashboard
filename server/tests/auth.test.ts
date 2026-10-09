import request from 'supertest';
import { describe, expect, it } from 'vitest';
import './setup.js';
import { app } from './helpers.js';

describe('auth', () => {
  it('registers, logs in and returns the current user', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Fayaz', email: 'fayaz@example.com', password: 'supersecret' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('fayaz@example.com');
    expect(reg.body.user.password).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email: 'fayaz@example.com', password: 'supersecret' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.name).toBe('Fayaz');
  });

  it('rejects duplicate emails and bad passwords', async () => {
    await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@example.com', password: 'password1' });
    const short = await request(app).post('/api/auth/register').send({ name: 'Ab', email: 'b@example.com', password: 'x' });
    expect(short.status).toBe(400);

    await request(app).post('/api/auth/register').send({ name: 'Abc', email: 'dup@example.com', password: 'password1' });
    const dup = await request(app).post('/api/auth/register').send({ name: 'Abc', email: 'dup@example.com', password: 'password1' });
    expect(dup.status).toBe(409);

    const bad = await request(app).post('/api/auth/login').send({ email: 'dup@example.com', password: 'wrongpass' });
    expect(bad.status).toBe(401);
  });

  it('blocks protected routes without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
