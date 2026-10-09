import { ALL_MODELS, type ProviderId } from '../../config/models.js';
import { anthropicProvider } from './anthropic.js';
import { bedrockProvider } from './bedrock.js';
import { demoProvider } from './demo.js';
import type { Provider } from './types.js';

export const PROVIDERS: Record<ProviderId, Provider> = { anthropic: anthropicProvider, bedrock: bedrockProvider, demo: demoProvider };

export function providerStatus() {
  return (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({
    id,
    label: PROVIDERS[id].label,
    available: PROVIDERS[id].available(),
    models: ALL_MODELS.filter((m) => m.provider === id).map(({ id: mid, label, pricing }) => ({ id: mid, label, priced: Boolean(pricing) })),
  }));
}
