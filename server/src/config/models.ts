import { env } from './env.js';

export type ProviderId = 'anthropic' | 'bedrock' | 'demo';

export interface ModelInfo {
  id: string;
  label: string;
  provider: ProviderId;
  contextWindow?: number;
  /**
   * Optional USD prices per 1M tokens. Left empty on purpose: model prices change,
   * so set them from your provider's pricing page to turn on cost estimates.
   */
  pricing?: { input: number; output: number };
}

export const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', provider: 'anthropic' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic' },
];

const BEDROCK_LABELS: Record<string, string> = {
  'amazon.nova-pro-v1:0': 'Amazon Nova Pro',
  'amazon.nova-lite-v1:0': 'Amazon Nova Lite',
  'amazon.nova-micro-v1:0': 'Amazon Nova Micro',
  'meta.llama3-1-70b-instruct-v1:0': 'Llama 3.1 70B Instruct',
  'mistral.mistral-large-2407-v1:0': 'Mistral Large',
};

export const BEDROCK_MODELS: ModelInfo[] = env.BEDROCK_MODELS.split(',')
  .map((id) => id.trim())
  .filter(Boolean)
  .map((id) => ({ id, label: BEDROCK_LABELS[id] ?? id, provider: 'bedrock' as const }));

export const DEMO_MODELS: ModelInfo[] = [{ id: 'demo-assistant', label: 'Demo assistant (offline)', provider: 'demo' }];

export const ALL_MODELS = [...ANTHROPIC_MODELS, ...BEDROCK_MODELS, ...DEMO_MODELS];
export const findModel = (provider: string, id: string) => ALL_MODELS.find((m) => m.provider === provider && m.id === id);

export function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number) {
  const p = findModel(provider, model)?.pricing;
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}
