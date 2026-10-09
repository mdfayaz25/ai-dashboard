import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Run } from '../models/Run.js';
import { Prompt } from '../models/Prompt.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { findModel, estimateCost } from '../config/models.js';
import { PROVIDERS, providerStatus } from '../lib/llm/index.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/providers', (_req, res) => res.json({ providers: providerStatus() }));

const runSchema = z.object({
  provider: z.enum(['anthropic', 'bedrock', 'demo']),
  model: z.string().min(1).max(120),
  system: z.string().max(8000).optional(),
  prompt: z.string().trim().min(1, 'Write a prompt first').max(40000),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().int().min(16).max(8192).default(1024),
  promptId: z.string().refine((v) => Types.ObjectId.isValid(v)).optional(),
});

/** Streams a model response as Server-Sent Events: `meta`, many `delta`, then `done` (or `error`). */
router.post(
  '/runs',
  validate({ body: runSchema }),
  asyncHandler(async (req, res) => {
    const body = runSchema.parse(req.body);
    const provider = PROVIDERS[body.provider];
    if (!findModel(body.provider, body.model)) throw AppError.badRequest('Unknown model for this provider');
    if (!provider.available()) throw AppError.badRequest(`${provider.label} is not configured on the server. Add its credentials to server/.env.`);
    const saved = body.promptId ? await Prompt.findOne({ _id: body.promptId, user: req.user!.id }).select('title') : null;

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const controller = new AbortController();
    res.on('close', () => !res.writableEnded && controller.abort());

    const started = Date.now();
    let ttft: number | undefined;
    send('meta', { provider: body.provider, model: body.model, startedAt: new Date(started).toISOString() });

    const base = {
      user: req.user!.id, prompt: saved?._id, promptTitle: saved?.title, provider: body.provider, model: body.model,
      system: body.system ?? '', input: body.prompt, temperature: body.temperature, maxTokens: body.maxTokens,
    };
    try {
      const result = await provider.stream({ ...body, signal: controller.signal }, (text) => {
        ttft ??= Date.now() - started;
        send('delta', { text });
      });
      const run = await Run.create({ ...base, ...result, latencyMs: Date.now() - started, ttftMs: ttft, status: 'success' });
      if (saved) await Prompt.updateOne({ _id: saved._id }, { $inc: { runCount: 1 }, lastRunAt: new Date() });
      send('done', { run: { ...run.toJSON(), cost: estimateCost(run.provider, run.model, run.inputTokens, run.outputTokens) } });
    } catch (err) {
      const cancelled = controller.signal.aborted;
      const message = cancelled ? 'Cancelled' : err instanceof Error ? err.message : 'The model request failed';
      const run = await Run.create({ ...base, status: cancelled ? 'cancelled' : 'error', error: message, latencyMs: Date.now() - started, ttftMs: ttft });
      if (!cancelled) send('error', { message, runId: run.id });
    } finally {
      res.end();
    }
  }),
);

const listQuery = z.object({
  search: z.string().trim().max(80).optional(),
  provider: z.enum(['anthropic', 'bedrock', 'demo']).optional(),
  model: z.string().max(120).optional(),
  status: z.enum(['success', 'error', 'cancelled']).optional(),
  rating: z.enum(['1', '-1']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get(
  '/runs',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const filter: Record<string, unknown> = { user: req.user!.id };
    if (q.provider) filter.provider = q.provider;
    if (q.model) filter.model = q.model;
    if (q.status) filter.status = q.status;
    if (q.rating) filter.rating = Number(q.rating);
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), 'i');
      filter.$or = [{ input: rx }, { output: rx }, { promptTitle: rx }];
    }
    const [runs, total] = await Promise.all([
      Run.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
      Run.countDocuments(filter),
    ]);
    res.json({
      runs: runs.map((r) => ({ ...r.toJSON(), cost: estimateCost(r.provider, r.model, r.inputTokens, r.outputTokens) })),
      total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)),
    });
  }),
);

router.patch(
  '/runs/:id',
  validate({ body: z.object({ rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }) }),
  asyncHandler(async (req, res) => {
    const run = await Run.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, { rating: req.body.rating }, { new: true });
    if (!run) throw AppError.notFound('Run not found');
    res.json({ run });
  }),
);

router.delete(
  '/runs/:id',
  asyncHandler(async (req, res) => {
    const run = await Run.findOneAndDelete({ _id: req.params.id, user: req.user!.id });
    if (!run) throw AppError.notFound('Run not found');
    res.status(204).end();
  }),
);

export default router;
