/* eslint-disable @typescript-eslint/no-explicit-any */
import seed from './seed.json';
import { tokenStore } from '../lib/api';
import { createAdapter, createRouter, createStore, fail, newId, now, withStatus } from './kernel';

type Doc = Record<string, any>;
type DB = { users: Doc[]; prompts: Doc[]; runs: Doc[] };

export const store = createStore<DB>('ai-dashboard.demo.v1', seed as unknown as { exportedAt: string; data: DB });
const db = () => store.db;

const PROVIDER_IDS = ['anthropic', 'bedrock', 'demo'] as const;
type ProviderId = (typeof PROVIDER_IDS)[number];
const MODELS: { provider: ProviderId; id: string; label: string }[] = [
  { provider: 'anthropic', id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { provider: 'anthropic', id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  { provider: 'anthropic', id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { provider: 'bedrock', id: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { provider: 'bedrock', id: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { provider: 'bedrock', id: 'meta.llama3-1-70b-instruct-v1:0', label: 'Llama 3.1 70B Instruct' },
  { provider: 'demo', id: 'demo-assistant', label: 'Demo assistant (offline)' },
];
const LABELS: Record<ProviderId, string> = { anthropic: 'Anthropic Claude', bedrock: 'AWS Bedrock', demo: 'Demo (offline)' };
const findModel = (provider: string, id: string) => MODELS.find((m) => m.provider === provider && m.id === id);

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const publicUser = ({ password: _p, ...u }: Doc) => u;
const token = (u: Doc) => `demo.${u.id}`;
const me = (userId: string | null) => db().users.find((u) => u.id === userId) ?? fail(401, 'Please sign in to continue');
const withCost = (r: Doc) => ({ ...r, cost: null }); // no hardcoded prices: costs stay off until pricing is configured
const extractVariables = (template: string) => [...new Set([...template.matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)].map((m) => m[1]))];

const r = createRouter();

// ---------- auth ----------
r.post('/auth/register', ({ body }) => {
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  if (name.length < 2) fail(400, 'name: Name must be at least 2 characters');
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'email: Enter a valid email');
  if (String(body.password ?? '').length < 8) fail(400, 'password: Password must be at least 8 characters');
  if (db().users.some((u) => u.email === email)) fail(409, 'An account with this email already exists');
  const user = { id: newId(), name, email, password: body.password, role: 'user', avatarColor: '#06B6D4', createdAt: now(), updatedAt: now() };
  db().users.push(user);
  store.save();
  return withStatus(201, { user: publicUser(user), token: token(user) });
}, false);
r.post('/auth/login', ({ body }) => {
  const user = db().users.find((u) => u.email === str(body.email).toLowerCase());
  if (!user || user.password !== body.password) fail(401, 'Incorrect email or password');
  return { user: publicUser(user!), token: token(user!) };
}, false);
r.get('/auth/me', ({ userId }) => ({ user: publicUser(me(userId)) }));
r.patch('/auth/me', ({ userId, body }) => {
  const u = me(userId);
  if (body.name !== undefined) {
    if (str(body.name).length < 2) fail(400, 'name: Name must be at least 2 characters');
    u.name = str(body.name);
  }
  store.save();
  return { user: publicUser(u) };
});

// ---------- providers ----------
r.get('/providers', () => ({
  providers: PROVIDER_IDS.map((id) => ({
    id,
    label: LABELS[id],
    available: id === 'demo',
    models: MODELS.filter((m) => m.provider === id).map((m) => ({ id: m.id, label: m.label, priced: false })),
  })),
}));

// ---------- prompts ----------
function promptBody(body: Doc, partial: boolean) {
  const out: Doc = {};
  if (!partial || 'title' in body) {
    const t = str(body.title);
    if (t.length < 2) fail(400, 'title: Give the prompt a title');
    out.title = t.slice(0, 80);
  }
  if (!partial || 'template' in body) {
    const t = str(body.template);
    if (!t) fail(400, 'template: The prompt template is empty');
    out.template = t.slice(0, 20000);
    out.variables = extractVariables(out.template);
  }
  if ('description' in body) out.description = str(body.description).slice(0, 280);
  if ('system' in body) out.system = String(body.system ?? '').slice(0, 8000);
  if ('tags' in body) out.tags = ((body.tags ?? []) as string[]).map((t) => str(t).toLowerCase()).filter(Boolean).slice(0, 8);
  if ('provider' in body) {
    if (!PROVIDER_IDS.includes(body.provider)) fail(400, 'provider: Unknown provider');
    out.provider = body.provider;
  }
  if ('model' in body) out.model = String(body.model).slice(0, 120);
  if ('temperature' in body) out.temperature = Math.min(1, Math.max(0, Number(body.temperature)));
  if ('maxTokens' in body) out.maxTokens = Math.min(8192, Math.max(16, Math.round(Number(body.maxTokens))));
  if ('favorite' in body) out.favorite = Boolean(body.favorite);
  return out;
}
const ownPrompt = (id: string, userId: string | null) => db().prompts.find((p) => p.id === id && p.user === userId) ?? fail(404, 'Prompt not found');

r.get('/prompts', ({ userId }) => ({
  prompts: db().prompts.filter((p) => p.user === userId).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)),
}));
r.get('/prompts/:id', ({ params, userId }) => ({ prompt: ownPrompt(params.id, userId) }));
r.post('/prompts', ({ userId, body }) => {
  const prompt = {
    id: newId(), user: userId, description: '', system: '', tags: [], favorite: false, provider: 'demo', model: 'demo-assistant', temperature: 0.7, maxTokens: 1024, runCount: 0,
    ...promptBody(body, false), createdAt: now(), updatedAt: now(),
  };
  db().prompts.push(prompt);
  store.save();
  return withStatus(201, { prompt });
});
r.patch('/prompts/:id', ({ params, userId, body }) => {
  const prompt = ownPrompt(params.id, userId);
  Object.assign(prompt, promptBody(body, true), { updatedAt: now() });
  store.save();
  return { prompt };
});
r.delete('/prompts/:id', ({ params, userId }) => {
  ownPrompt(params.id, userId);
  db().prompts = db().prompts.filter((p) => p.id !== params.id);
  store.save();
  return undefined;
});

// ---------- runs ----------
r.get('/runs', ({ userId, query }) => {
  const q = str(query.search).toLowerCase();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const list = db().runs
    .filter((x) => x.user === userId)
    .filter((x) => !query.provider || x.provider === query.provider)
    .filter((x) => !query.model || x.model === query.model)
    .filter((x) => !query.status || x.status === query.status)
    .filter((x) => !query.rating || x.rating === Number(query.rating))
    .filter((x) => !q || [x.input, x.output, x.promptTitle].some((f) => String(f ?? '').toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { runs: list.slice((page - 1) * limit, page * limit).map(withCost), total: list.length, page, pages: Math.max(1, Math.ceil(list.length / limit)) };
});
r.patch('/runs/:id', ({ params, userId, body }) => {
  const run = db().runs.find((x) => x.id === params.id && x.user === userId) ?? fail(404, 'Run not found');
  if (![-1, 0, 1].includes(body.rating)) fail(400, 'rating: Invalid rating');
  run.rating = body.rating;
  run.updatedAt = now();
  store.save();
  return { run };
});
r.delete('/runs/:id', ({ params, userId }) => {
  if (!db().runs.some((x) => x.id === params.id && x.user === userId)) fail(404, 'Run not found');
  db().runs = db().runs.filter((x) => x.id !== params.id);
  store.save();
  return undefined;
});

// ---------- analytics (same maths as the API) ----------
const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
r.get('/analytics', ({ userId, query }) => {
  const days = [7, 14, 30].includes(Number(query.days)) ? Number(query.days) : 14;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const prevSince = new Date(since.getTime() - days * 864e5);
  const runs = db().runs.filter((x) => x.user === userId && new Date(x.createdAt) >= prevSince);
  const current = runs.filter((x) => new Date(x.createdAt) >= since);
  const previous = runs.filter((x) => new Date(x.createdAt) < since);
  const summarize = (list: Doc[]) => {
    const ok = list.filter((x) => x.status === 'success');
    const lat = ok.map((x) => x.latencyMs).sort((a, b) => a - b);
    return {
      runs: list.length,
      successRate: list.length ? ok.length / list.length : 0,
      tokens: ok.reduce((n, x) => n + x.inputTokens + x.outputTokens, 0),
      avgLatency: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
      p95Latency: pct(lat, 95),
      cost: null,
      rated: list.filter((x) => x.rating !== 0).length,
      positive: list.filter((x) => x.rating === 1).length,
    };
  };
  const daily = Array.from({ length: days }, (_, i) => ({ date: new Date(since.getTime() + i * 864e5).toISOString().slice(0, 10), anthropic: 0, bedrock: 0, demo: 0, inputTokens: 0, outputTokens: 0, errors: 0 }));
  const byModel = new Map<string, Doc>();
  const byPrompt = new Map<string, number>();
  for (const x of current) {
    const day = daily.find((d) => d.date === x.createdAt.slice(0, 10));
    if (day) {
      (day as any)[x.provider] += 1;
      day.inputTokens += x.inputTokens;
      day.outputTokens += x.outputTokens;
      if (x.status === 'error') day.errors += 1;
    }
    const key = `${x.provider}:${x.model}`;
    const m = byModel.get(key) ?? { provider: x.provider, model: x.model, label: findModel(x.provider, x.model)?.label ?? x.model, runs: 0, latencies: [], ttfts: [], tokens: 0, errors: 0 };
    m.runs += 1;
    if (x.status === 'success') {
      m.latencies.push(x.latencyMs);
      if (x.ttftMs) m.ttfts.push(x.ttftMs);
      m.tokens += x.inputTokens + x.outputTokens;
    } else m.errors += 1;
    byModel.set(key, m);
    if (x.promptTitle) byPrompt.set(x.promptTitle, (byPrompt.get(x.promptTitle) ?? 0) + 1);
  }
  return {
    days,
    summary: summarize(current),
    previous: summarize(previous),
    daily,
    models: [...byModel.values()]
      .map(({ latencies, ttfts, ...m }): Doc => {
        const l = [...latencies].sort((a: number, b: number) => a - b);
        const t = [...ttfts].sort((a: number, b: number) => a - b);
        return { ...m, p50: pct(l, 50), p95: pct(l, 95), ttftP50: pct(t, 50) };
      })
      .sort((a, b) => b.runs - a.runs),
    topPrompts: [...byPrompt.entries()].map(([title, runs]) => ({ title, runs })).sort((a, b) => b.runs - a.runs).slice(0, 5),
  };
});

export const demoAdapter = createAdapter(r, (t) => (t?.startsWith('demo.') ? t.slice(5) : null));

// ---------- streaming runs (replaces the SSE endpoint) ----------
const estimateTokens = (s: string) => Math.max(1, Math.round(s.length / 4));
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

function draft(prompt: string, system?: string) {
  const firstLine = prompt.split('\n').find((l) => l.trim()) ?? 'your request';
  const topic = firstLine.replace(/[#*`>]/g, '').trim().slice(0, 90);
  const words = [...new Set(prompt.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? [])].slice(0, 4);
  const isCode = /code|function|bug|test|sql|api|typescript|react|query/i.test(prompt);
  return [
    '> **Live demo.** This answer comes from the built-in offline model running in your browser. Clone the repo and add an Anthropic API key or AWS credentials to get real responses from Claude or Bedrock.',
    '',
    '### Summary',
    `You asked about **${topic}**.${system ? ' I followed the system instructions you set.' : ''} Here is how I would approach it.`,
    '',
    '### Key points',
    ...(words.length ? words : ['clarity', 'structure', 'next-steps']).map((w, i) => `${i + 1}. **${w[0].toUpperCase() + w.slice(1)}** — what matters most here and the trade-off to keep in mind.`),
    '',
    ...(isCode ? ['### Example', '```ts', 'export function handle(input: string) {', '  const cleaned = input.trim();', "  if (!cleaned) throw new Error('Input is required');", '  return cleaned.split(/\\s+/).length;', '}', '```', ''] : []),
    '| Aspect | Recommendation |',
    '| --- | --- |',
    '| Scope | Start small and measure |',
    '| Risk | Validate with real data |',
    '',
    'Want me to go deeper on any of these?',
  ].join('\n');
}

type RunRequest = { provider: ProviderId; model: string; system?: string; prompt: string; temperature: number; maxTokens: number; promptId?: string };
type Handlers = { onMeta?: (m: { startedAt: string }) => void; onDelta: (text: string) => void; onDone: (run: any) => void; onError: (message: string) => void };

export async function streamDemoRun(body: RunRequest, h: Handlers, signal: AbortSignal) {
  const userId = (tokenStore.get() ?? '').replace(/^demo\./, '');
  if (!db().users.some((u) => u.id === userId)) return h.onError('Please sign in to continue');
  const prompt = str(body.prompt);
  if (!prompt) return h.onError('Write a prompt first');
  if (!findModel(body.provider, body.model)) return h.onError('Unknown model for this provider');
  const saved = body.promptId ? db().prompts.find((p) => p.id === body.promptId && p.user === userId) : undefined;
  const base = {
    id: newId(), user: userId, prompt: saved?.id, promptTitle: saved?.title, provider: body.provider, model: body.model,
    system: body.system ?? '', input: prompt, temperature: body.temperature, maxTokens: body.maxTokens, rating: 0, inputTokens: 0, outputTokens: 0,
  };
  const started = Date.now();
  if (body.provider !== 'demo') {
    await sleep(250, signal).catch(() => undefined);
    const message = `${LABELS[body.provider]} needs the API server, which this static demo doesn't have. Pick “Demo assistant (offline)”, or run the project locally with your own credentials.`;
    db().runs.push({ ...base, output: '', status: 'error', error: message, latencyMs: Date.now() - started, createdAt: now(), updatedAt: now() });
    store.save();
    return h.onError(message);
  }
  h.onMeta?.({ startedAt: new Date(started).toISOString() });
  const text = draft(prompt, body.system);
  const chunks = text.match(/\S+\s*|\s+/g) ?? [];
  let output = '';
  let ttft: number | undefined;
  try {
    await sleep(350, signal);
    for (const chunk of chunks) {
      if (estimateTokens(output) >= body.maxTokens) break;
      ttft ??= Date.now() - started;
      output += chunk;
      h.onDelta(chunk);
      await sleep(12 + Math.random() * 18, signal);
    }
  } catch {
    db().runs.push({ ...base, output, status: 'cancelled', error: 'Cancelled', latencyMs: Date.now() - started, ttftMs: ttft, createdAt: now(), updatedAt: now() });
    store.save();
    return;
  }
  const run = {
    ...base, output, inputTokens: estimateTokens((body.system ?? '') + prompt), outputTokens: estimateTokens(output), stopReason: 'end_turn',
    status: 'success', latencyMs: Date.now() - started, ttftMs: ttft, createdAt: now(), updatedAt: now(),
  };
  db().runs.push(run);
  if (saved) Object.assign(saved, { runCount: (saved.runCount ?? 0) + 1, lastRunAt: now() });
  store.save();
  h.onDone(withCost(run));
}
