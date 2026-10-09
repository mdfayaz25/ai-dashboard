import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import type { Provider } from './types.js';

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }));

export const anthropicProvider: Provider = {
  id: 'anthropic',
  label: 'Anthropic Claude',
  available: () => Boolean(env.ANTHROPIC_API_KEY),
  async stream({ model, system, prompt, temperature, maxTokens, signal }, onDelta) {
    const stream = getClient().messages.stream(
      {
        model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
      },
      { signal },
    );
    stream.on('text', (text) => onDelta(text));
    const final = await stream.finalMessage();
    const output = final.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return { output, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, stopReason: final.stop_reason ?? undefined };
  },
};
