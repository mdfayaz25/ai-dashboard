import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Prompt } from './models/Prompt.js';
import { Run } from './models/Run.js';

/** Deterministic pseudo-random numbers so the sample history looks the same on every seed. */
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const PROMPTS = [
  {
    title: 'Code reviewer', tags: ['engineering', 'review'], favorite: true, model: 'claude-sonnet-5-5', temperature: 0.2,
    description: 'Reviews a diff for bugs, security issues and readability, ranked by severity.',
    system: 'You are a senior TypeScript engineer doing a careful code review. Be specific and cite line numbers.',
    template: 'Review the following {{language}} code. List issues ranked by severity (critical, major, minor) with a suggested fix for each.\n\n```{{language}}\n{{code}}\n```',
    sample: '### Critical\n1. **Unvalidated input on line 12** — `req.body.email` is used in a query without validation. Parse it with a schema first.\n\n### Major\n2. **Missing await on line 27** — `saveOrder()` returns a promise, so errors are swallowed.\n\n### Minor\n3. Rename `d` to `deliveryDate` for clarity.',
  },
  {
    title: 'Support ticket summariser', tags: ['support', 'summarise'], favorite: true, model: 'claude-haiku-5-5', temperature: 0.3,
    description: 'Groups a batch of tickets into themes with counts and an example for each.',
    system: '', template: 'Summarise these {{count}} support tickets from {{period}} into themes. For each theme give a count, a one-line description and one representative quote.\n\n{{tickets}}',
    sample: '| Theme | Tickets | Example |\n| --- | --- | --- |\n| Payment failures on UPI | 14 | "Money was debited but order shows pending" |\n| Delivery delays in Pune | 9 | "Promised Tuesday, still not shipped" |\n| Login with OTP | 5 | "OTP never arrives on Jio" |',
  },
  {
    title: 'SQL from a question', tags: ['data', 'sql'], model: 'claude-sonnet-5-5', temperature: 0,
    description: 'Turns a business question into a PostgreSQL query using the given schema.',
    system: 'Return only one PostgreSQL query in a code block, then one sentence explaining it.',
    template: 'Schema:\n{{schema}}\n\nQuestion: {{question}}',
    sample: '```sql\nSELECT date_trunc(\'week\', created_at) AS week, SUM(total) AS revenue\nFROM orders\nWHERE status IN (\'paid\', \'delivered\')\nGROUP BY 1 ORDER BY 1;\n```\nWeekly revenue from paid and delivered orders.',
  },
  {
    title: 'Product description writer', tags: ['marketing', 'copy'], model: 'amazon.nova-pro-v1:0', provider: 'bedrock', temperature: 0.8,
    description: 'Writes a 60-word product description in a given tone.',
    system: '', template: 'Write a {{tone}} product description (about 60 words) for {{product}}. Mention: {{features}}.',
    sample: 'Meet the Aura Pro: 40 hours of adaptive noise cancelling that keeps the city out and your music in. Memory-foam cushions stay comfortable on long flights, and a tuned 40 mm driver keeps bass tight at any volume. Fold it, pack it, forget it is there.',
  },
  {
    title: 'Bug report triage', tags: ['engineering', 'triage'], model: 'claude-haiku-5-5', temperature: 0.2,
    description: 'Classifies a bug report and drafts reproduction steps.',
    system: '', template: 'Classify this bug report by area and severity, then write numbered reproduction steps.\n\n{{report}}',
    sample: '**Area:** Checkout · **Severity:** High\n\n1. Add any item to the cart\n2. Choose UPI and enter an invalid VPA\n3. Correct the VPA and pay\n4. Order stays in "pending" although payment succeeded',
  },
  {
    title: 'Meeting notes → action items', tags: ['productivity'], model: 'meta.llama3-1-70b-instruct-v1:0', provider: 'bedrock', temperature: 0.3,
    description: 'Pulls owners, tasks and due dates out of raw notes.',
    system: '', template: 'Extract action items from these notes as a table with Owner, Task and Due.\n\n{{notes}}',
    sample: '| Owner | Task | Due |\n| --- | --- | --- |\n| Priya | Final pricing mockups | Thu |\n| Arjun | Migrate blog to MDX | Fri |\n| Neha | Regression pass on staging | Mon |',
  },
  {
    title: 'Unit test generator', tags: ['engineering', 'testing'], model: 'claude-opus-5-5', temperature: 0.2,
    description: 'Writes Vitest tests for a function, including edge cases.',
    system: 'Use Vitest. Cover happy paths, edge cases and error handling.',
    template: 'Write unit tests for this function:\n\n```ts\n{{code}}\n```',
    sample: "```ts\nimport { describe, it, expect } from 'vitest';\nimport { computeTotals } from './pricing';\n\ndescribe('computeTotals', () => {\n  it('adds GST and free shipping over the threshold', () => {\n    expect(computeTotals([{ price: 4000, qty: 1 }]).totalPrice).toBe(4720);\n  });\n});\n```",
  },
  {
    title: 'Customer email reply', tags: ['support', 'email'], model: 'demo-assistant', provider: 'demo', temperature: 0.6,
    description: 'Drafts a short, warm reply that resolves the customer issue.',
    system: 'Write in plain, friendly English. No more than 120 words.', template: 'Customer {{name}} wrote:\n\n{{message}}\n\nDraft a reply that {{goal}}.',
    sample: 'Hi Rahul,\n\nThanks for flagging this, and sorry for the wait. Your refund of ₹3,299 was processed today and should reach your account within 3–5 working days.\n\nIf it has not arrived by Monday, reply here and I will chase it personally.\n\nBest,\nFayaz',
  },
];

const LATENCY: Record<string, [number, number]> = {
  'claude-haiku-5-5': [600, 1800], 'claude-sonnet-5-5': [1400, 4200], 'claude-opus-5-5': [2600, 7800],
  'amazon.nova-pro-v1:0': [1200, 3600], 'amazon.nova-lite-v1:0': [500, 1500], 'meta.llama3-1-70b-instruct-v1:0': [1500, 4800], 'demo-assistant': [1800, 3200],
};

async function run() {
  await connectDB();
  await Promise.all([User.deleteMany({}), Prompt.deleteMany({}), Run.deleteMany({})]);
  const user = await User.create({ name: 'Mohammed Fayaz', email: 'fayaz@aidash.dev', password: 'Demo@1234', avatarColor: '#06B6D4' });

  const prompts = [];
  for (const p of PROMPTS) {
    const { sample: _sample, ...rest } = p;
    prompts.push(await Prompt.create({ ...rest, provider: p.provider ?? 'anthropic', user: user._id, maxTokens: 1024 }));
  }

  const runs = [];
  for (let i = 0; i < 170; i++) {
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 30);
    const createdAt = new Date(Date.now() - daysAgo * 864e5 - between(0, 20) * 36e5);
    const pi = Math.floor(rand() * PROMPTS.length);
    const meta = PROMPTS[pi];
    const prompt = prompts[pi];
    const useOther = rand() < 0.25;
    const provider = useOther ? pick(['anthropic', 'bedrock'] as const) : (prompt.provider as 'anthropic' | 'bedrock' | 'demo');
    const model = useOther ? (provider === 'anthropic' ? pick(['claude-haiku-5-5', 'claude-sonnet-5-5']) : pick(['amazon.nova-lite-v1:0', 'amazon.nova-pro-v1:0'])) : prompt.model;
    const failed = rand() < 0.045;
    const [lo, hi] = LATENCY[model] ?? [800, 3000];
    const latency = between(lo, hi);
    runs.push({
      user: user._id, prompt: prompt._id, promptTitle: prompt.title, provider, model, system: prompt.system,
      input: prompt.template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, v: string) => `<${v}>`),
      output: failed ? '' : meta.sample,
      temperature: prompt.temperature, maxTokens: 1024,
      inputTokens: failed ? 0 : between(180, 2400), outputTokens: failed ? 0 : between(90, 900),
      latencyMs: failed ? between(200, 900) : latency, ttftMs: failed ? undefined : Math.round(latency * (0.18 + rand() * 0.15)),
      status: failed ? 'error' : 'success', error: failed ? pick(['ThrottlingException: Rate exceeded', 'Overloaded, please retry', 'Request timed out']) : undefined,
      rating: failed ? 0 : rand() < 0.35 ? (rand() < 0.86 ? 1 : -1) : 0,
      stopReason: failed ? undefined : 'end_turn',
      createdAt, updatedAt: createdAt,
    });
  }
  await Run.insertMany(runs);
  for (const p of prompts) {
    const mine = runs.filter((r) => String(r.prompt) === String(p._id));
    p.runCount = mine.length;
    p.lastRunAt = mine.reduce<Date | undefined>((a, r) => (!a || r.createdAt > a ? r.createdAt : a), undefined);
    await p.save();
  }

  console.log(`Seeded ${prompts.length} prompts and ${runs.length} sample runs over 30 days.`);
  console.log('Sign in → fayaz@aidash.dev / Demo@1234');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
