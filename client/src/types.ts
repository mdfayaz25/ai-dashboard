export interface User { id: string; name: string; email: string; role: 'user' | 'admin'; avatarColor: string }

export type ProviderId = 'anthropic' | 'bedrock' | 'demo';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  available: boolean;
  models: { id: string; label: string; priced: boolean }[];
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  system: string;
  template: string;
  variables: string[];
  tags: string[];
  favorite: boolean;
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  runCount: number;
  lastRunAt?: string;
  updatedAt: string;
}

export interface Run {
  id: string;
  prompt?: string;
  promptTitle?: string;
  provider: ProviderId;
  model: string;
  system: string;
  input: string;
  output: string;
  temperature: number;
  maxTokens: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  ttftMs?: number;
  status: 'success' | 'error' | 'cancelled';
  error?: string;
  rating: -1 | 0 | 1;
  cost?: number | null;
  createdAt: string;
}

export interface Analytics {
  days: number;
  summary: Summary;
  previous: Summary;
  daily: { date: string; anthropic: number; bedrock: number; demo: number; inputTokens: number; outputTokens: number; errors: number }[];
  models: { provider: ProviderId; model: string; label: string; runs: number; tokens: number; errors: number; p50: number; p95: number; ttftP50: number }[];
  topPrompts: { title: string; runs: number }[];
}

export interface Summary {
  runs: number;
  successRate: number;
  tokens: number;
  avgLatency: number;
  p95Latency: number;
  cost: number | null;
  rated: number;
  positive: number;
}
