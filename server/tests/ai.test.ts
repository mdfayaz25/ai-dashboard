import request from 'supertest';
import { describe, expect, it } from 'vitest';
import './setup.js';
import { app, createUser } from './helpers.js';
import { Run } from '../src/models/Run.js';

const parseSSE = (text: string) =>
  text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => ({ event: /event: (.+)/.exec(block)?.[1], data: JSON.parse(/data: (.+)/.exec(block)?.[1] ?? 'null') }));

describe('providers and runs', () => {
  it('always offers the offline demo model', async () => {
    const { auth } = await createUser();
    const res = await request(app).get('/api/providers').set(auth);
    const demo = res.body.providers.find((p: { id: string }) => p.id === 'demo');
    expect(demo.available).toBe(true);
    expect(demo.models[0].id).toBe('demo-assistant');
  });

  it('streams a response over SSE and records the run', async () => {
    const { auth } = await createUser();
    const res = await request(app)
      .post('/api/runs')
      .set(auth)
      .send({ provider: 'demo', model: 'demo-assistant', prompt: 'Review this TypeScript function for bugs', maxTokens: 400 })
      .buffer(true)
      .parse((r, cb) => { let d = ''; r.on('data', (c: Buffer) => (d += c)); r.on('end', () => cb(null, d)); });
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = parseSSE(res.body as string);
    expect(events[0].event).toBe('meta');
    expect(events.filter((e) => e.event === 'delta').length).toBeGreaterThan(10);
    const done = events.at(-1)!;
    expect(done.event).toBe('done');
    expect(done.data.run.status).toBe('success');
    expect(done.data.run.outputTokens).toBeGreaterThan(0);
    expect(done.data.run.ttftMs).toBeGreaterThan(0);
    expect(await Run.countDocuments()).toBe(1);
  }, 30000);

  it('rejects unknown models and providers without credentials', async () => {
    const { auth } = await createUser();
    const bad = await request(app).post('/api/runs').set(auth).send({ provider: 'demo', model: 'gpt-nope', prompt: 'hi' });
    expect(bad.status).toBe(400);
    const noKey = await request(app).post('/api/runs').set(auth).send({ provider: 'anthropic', model: 'claude-sonnet-5-5', prompt: 'hi' });
    expect(noKey.status).toBe(400);
    expect(noKey.body.message).toMatch(/not configured/);
  });

  it('keeps runs private and supports rating and filters', async () => {
    const a = await createUser();
    const b = await createUser();
    const run = await Run.create({ user: a.user.id, provider: 'demo', model: 'demo-assistant', input: 'x', output: 'y', status: 'success', latencyMs: 900 });
    await Run.create({ user: a.user.id, provider: 'bedrock', model: 'amazon.nova-lite-v1:0', input: 'x', status: 'error', error: 'throttled' });

    expect((await request(app).get('/api/runs').set(b.auth)).body.total).toBe(0);
    expect((await request(app).get('/api/runs?status=error').set(a.auth)).body.total).toBe(1);
    await request(app).patch(`/api/runs/${run.id}`).set(b.auth).send({ rating: 1 }).expect(404);
    const rated = await request(app).patch(`/api/runs/${run.id}`).set(a.auth).send({ rating: 1 });
    expect(rated.body.run.rating).toBe(1);
  });
});

describe('prompts and analytics', () => {
  it('extracts {{variables}} from templates', async () => {
    const { auth } = await createUser();
    const res = await request(app).post('/api/prompts').set(auth).send({ title: 'Reply', template: 'Reply to {{ customer }} about {{issue}}. Sign as {{customer}}.', tags: ['Support'] });
    expect(res.status).toBe(201);
    expect(res.body.prompt.variables).toEqual(['customer', 'issue']);
    expect(res.body.prompt.tags).toEqual(['support']);
    const upd = await request(app).patch(`/api/prompts/${res.body.prompt.id}`).set(auth).send({ template: 'Only {{tone}}' });
    expect(upd.body.prompt.variables).toEqual(['tone']);
  });

  it('summarises usage by day and model', async () => {
    const { auth, user } = await createUser();
    const now = Date.now();
    await Run.create([
      { user: user.id, provider: 'demo', model: 'demo-assistant', input: 'a', status: 'success', inputTokens: 100, outputTokens: 300, latencyMs: 1000, createdAt: new Date(now - 3600e3) },
      { user: user.id, provider: 'demo', model: 'demo-assistant', input: 'b', status: 'success', inputTokens: 50, outputTokens: 150, latencyMs: 3000, createdAt: new Date(now - 7200e3) },
      { user: user.id, provider: 'demo', model: 'demo-assistant', input: 'c', status: 'error', createdAt: new Date(now - 3 * 864e5) },
    ]);
    const res = await request(app).get('/api/analytics?days=7').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.summary.runs).toBe(3);
    expect(res.body.summary.tokens).toBe(600);
    expect(res.body.summary.avgLatency).toBe(2000);
    expect(res.body.summary.successRate).toBeCloseTo(2 / 3);
    expect(res.body.daily).toHaveLength(7);
    expect(res.body.models[0]).toMatchObject({ model: 'demo-assistant', runs: 3, errors: 1 });
  });
});
