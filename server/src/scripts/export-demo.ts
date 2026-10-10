/**
 * Exports the seeded database to client/src/demo/seed.json for the static GitHub Pages demo.
 * Run after `npm run seed`. Password hashes are replaced with the demo password so the
 * in-browser backend can check sign-ins.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_PASSWORDS: Record<string, string> = JSON.parse(process.env.DEMO_PASSWORDS ?? '{}');

/** Mirrors the API's JSON: top-level _id becomes id, sub-documents keep their _id. */
function normalize(value: unknown, depth = 0): unknown {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => normalize(v, depth));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__v') continue;
      out[k === '_id' && depth === 0 ? 'id' : k] = normalize(v, depth + 1);
    }
    return out;
  }
  return value;
}

async function run() {
  // Import models so they register with mongoose.
  await import('../seed-models.js');
  await connectDB();
  const data: Record<string, unknown[]> = {};
  for (const name of mongoose.modelNames()) {
    const docs = await mongoose.model(name).find().select('+password').lean();
    data[name.charAt(0).toLowerCase() + name.slice(1) + 's'] = docs.map((d) => {
      const n = normalize(d) as Record<string, unknown>;
      if ('password' in n) n.password = DEMO_PASSWORDS[String(n.email)] ?? 'Demo@1234';
      return n;
    });
  }
  const out = path.resolve(__dirname, '../../../client/src/demo/seed.json');
  await writeFile(out, JSON.stringify({ exportedAt: new Date().toISOString(), data }));
  console.log(`Wrote ${out}: ${Object.entries(data).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
