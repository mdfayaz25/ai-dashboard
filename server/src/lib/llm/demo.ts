import type { Provider } from './types.js';

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

export const estimateTokens = (s: string) => Math.max(1, Math.round(s.length / 4));

/** Builds a structured, clearly-labelled sample answer so the whole app can be explored without API keys. */
function draft(prompt: string, system?: string) {
  const firstLine = prompt.split('\n').find((l) => l.trim()) ?? 'your request';
  const topic = firstLine.replace(/[#*`>]/g, '').trim().slice(0, 90);
  const words = [...new Set(prompt.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? [])].slice(0, 4);
  const isCode = /code|function|bug|test|sql|api|typescript|react|query/i.test(prompt);
  return [
    `> **Demo mode.** This answer comes from the built-in offline model. Add \`ANTHROPIC_API_KEY\` or AWS credentials in \`server/.env\` to get real responses from Claude or Bedrock.`,
    '',
    `### Summary`,
    `You asked about **${topic}**.${system ? ' I followed the system instructions you set.' : ''} Here is how I would approach it.`,
    '',
    `### Key points`,
    ...(words.length ? words : ['clarity', 'structure', 'next-steps']).map((w, i) => `${i + 1}. **${w[0].toUpperCase() + w.slice(1)}** — what matters most here and the trade-off to keep in mind.`),
    '',
    ...(isCode
      ? ['### Example', '```ts', `export function handle(input: string) {`, `  const cleaned = input.trim();`, `  if (!cleaned) throw new Error('Input is required');`, `  return cleaned.split(/\\s+/).length;`, `}`, '```', '']
      : []),
    `| Aspect | Recommendation |`,
    `| --- | --- |`,
    `| Scope | Start small and measure |`,
    `| Risk | Validate with real data |`,
    '',
    `Want me to go deeper on any of these?`,
  ].join('\n');
}

export const demoProvider: Provider = {
  id: 'demo',
  label: 'Demo (offline)',
  available: () => true,
  async stream({ prompt, system, maxTokens, signal }, onDelta) {
    const text = draft(prompt, system);
    const chunks = text.match(/\S+\s*|\s+/g) ?? [];
    let output = '';
    await sleep(350, signal); // time to first token
    for (const chunk of chunks) {
      if (estimateTokens(output) >= maxTokens) break;
      output += chunk;
      onDelta(chunk);
      await sleep(12 + Math.random() * 18, signal);
    }
    return { output, inputTokens: estimateTokens((system ?? '') + prompt), outputTokens: estimateTokens(output), stopReason: 'end_turn' };
  },
};
