import { Router } from 'express';
import { z } from 'zod';
import { Run } from '../models/Run.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { estimateCost, findModel } from '../config/models.js';

const router = Router();
router.use(requireAuth);

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const query = z.object({ days: z.coerce.number().int().refine((d) => [7, 14, 30].includes(d)).default(14) });

/** Aggregates in application code so it runs on any MongoDB-compatible store. */
router.get(
  '/',
  validate({ query }),
  asyncHandler(async (req, res) => {
    const { days } = query.parse(req.query);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const prevSince = new Date(since.getTime() - days * 864e5);

    const runs = await Run.find({ user: req.user!.id, createdAt: { $gte: prevSince } })
      .select('provider model status inputTokens outputTokens latencyMs ttftMs rating promptTitle createdAt')
      .lean();
    const current = runs.filter((r) => r.createdAt >= since);
    const previous = runs.filter((r) => r.createdAt < since);

    const summarize = (list: typeof runs) => {
      const ok = list.filter((r) => r.status === 'success');
      const lat = ok.map((r) => r.latencyMs).sort((a, b) => a - b);
      const costs = ok.map((r) => estimateCost(r.provider, r.model, r.inputTokens, r.outputTokens));
      return {
        runs: list.length,
        successRate: list.length ? ok.length / list.length : 0,
        tokens: ok.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0),
        avgLatency: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
        p95Latency: pct(lat, 95),
        cost: costs.some((c) => c !== null) ? costs.reduce<number>((a, c) => a + (c ?? 0), 0) : null,
        rated: list.filter((r) => r.rating !== 0).length,
        positive: list.filter((r) => r.rating === 1).length,
      };
    };

    const daily = Array.from({ length: days }, (_, i) => {
      const d = new Date(since.getTime() + i * 864e5);
      return { date: d.toISOString().slice(0, 10), anthropic: 0, bedrock: 0, demo: 0, inputTokens: 0, outputTokens: 0, errors: 0 };
    });
    const byModel = new Map<string, { provider: string; model: string; label: string; runs: number; latencies: number[]; ttfts: number[]; tokens: number; errors: number }>();
    const byPrompt = new Map<string, number>();

    for (const r of current) {
      const day = daily.find((d) => d.date === r.createdAt.toISOString().slice(0, 10));
      if (day) {
        day[r.provider as 'anthropic' | 'bedrock' | 'demo'] += 1;
        day.inputTokens += r.inputTokens;
        day.outputTokens += r.outputTokens;
        if (r.status === 'error') day.errors += 1;
      }
      const key = `${r.provider}:${r.model}`;
      const m = byModel.get(key) ?? { provider: r.provider, model: r.model, label: findModel(r.provider, r.model)?.label ?? r.model, runs: 0, latencies: [], ttfts: [], tokens: 0, errors: 0 };
      m.runs += 1;
      if (r.status === 'success') {
        m.latencies.push(r.latencyMs);
        if (r.ttftMs) m.ttfts.push(r.ttftMs);
        m.tokens += r.inputTokens + r.outputTokens;
      } else m.errors += 1;
      byModel.set(key, m);
      if (r.promptTitle) byPrompt.set(r.promptTitle, (byPrompt.get(r.promptTitle) ?? 0) + 1);
    }

    res.json({
      days,
      summary: summarize(current),
      previous: summarize(previous),
      daily,
      models: [...byModel.values()]
        .map(({ latencies, ttfts, ...m }) => {
          const l = latencies.sort((a, b) => a - b);
          const t = ttfts.sort((a, b) => a - b);
          return { ...m, p50: pct(l, 50), p95: pct(l, 95), ttftP50: pct(t, 50) };
        })
        .sort((a, b) => b.runs - a.runs),
      topPrompts: [...byPrompt.entries()].map(([title, runs]) => ({ title, runs })).sort((a, b) => b.runs - a.runs).slice(0, 5),
    });
  }),
);

export default router;
