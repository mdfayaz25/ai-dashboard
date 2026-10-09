export const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}s` : `${Math.round(n)}ms`);
export const pct = (n: number) => `${(n * 100).toFixed(n >= 0.995 || n === 0 ? 0 : 1)}%`;
export const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
export const change = (cur: number, prev: number) => (prev ? (cur - prev) / prev : null);

export const PROVIDER_META: Record<string, { label: string; color: string; short: string }> = {
  anthropic: { label: 'Anthropic', color: '#06B6D4', short: 'Claude' },
  bedrock: { label: 'AWS Bedrock', color: '#8B5CF6', short: 'Bedrock' },
  demo: { label: 'Demo', color: '#F59E0B', short: 'Demo' },
};

export const fillTemplate = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g, (m, v: string) => (values[v]?.length ? values[v] : m));

export const variablesOf = (template: string) => [...new Set([...template.matchAll(/\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g)].map((m) => m[1]))];
