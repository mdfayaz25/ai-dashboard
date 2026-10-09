import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { providerStatus } from './lib/llm/index.js';

async function main() {
  await connectDB();
  createApp().listen(env.PORT, () => {
    console.log(`AI Dashboard API → http://localhost:${env.PORT}`);
    for (const p of providerStatus()) console.log(`  ${p.available ? '✓' : '·'} ${p.label}${p.available ? '' : ' (not configured)'}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
