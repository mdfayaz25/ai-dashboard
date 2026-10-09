import type { ProviderId, ProviderInfo } from '@/types';

export type ModelChoice = { provider: ProviderId; model: string };

export function ModelSelect({ providers, value, onChange, id, label = 'Model' }: { providers?: ProviderInfo[]; value: ModelChoice; onChange: (v: ModelChoice) => void; id: string; label?: string }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">{label}</label>
      <select
        id={id}
        value={`${value.provider}::${value.model}`}
        onChange={(e) => { const [provider, model] = e.target.value.split('::'); onChange({ provider: provider as ProviderId, model }); }}
        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-medium outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
      >
        {providers?.map((p) => (
          <optgroup key={p.id} label={`${p.label}${p.available ? '' : ' — add credentials to enable'}`}>
            {p.models.map((m) => <option key={m.id} value={`${p.id}::${m.id}`} disabled={!p.available}>{m.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function defaultChoice(providers?: ProviderInfo[]): ModelChoice {
  const p = providers?.find((x) => x.available && x.id !== 'demo') ?? providers?.find((x) => x.available);
  return p ? { provider: p.id, model: p.models[0].id } : { provider: 'demo', model: 'demo-assistant' };
}
