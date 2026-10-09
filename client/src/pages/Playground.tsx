import { useQueryClient } from '@tanstack/react-query';
import { Check, Columns2, Copy, Play, Save, Square, ThumbsDown, ThumbsUp, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { streamRun } from '@/lib/stream';
import { compact, fillTemplate, ms, PROVIDER_META, variablesOf } from '@/lib/format';
import type { Prompt, Run } from '@/types';
import { usePrompts, useProviders } from '@/hooks/queries';
import { defaultChoice, ModelSelect, type ModelChoice } from '@/components/ModelSelect';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

type Pane = { text: string; status: 'idle' | 'streaming' | 'done' | 'error'; run?: Run; error?: string; startedAt?: number; ttft?: number };
const idle: Pane = { text: '', status: 'idle' };

export default function Playground() {
  const { data: providers } = useProviders();
  const { data: prompts } = usePrompts();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

  const [models, setModels] = useState<ModelChoice[]>([{ provider: 'demo', model: 'demo-assistant' }]);
  const [compare, setCompare] = useState(false);
  const [system, setSystem] = useState('');
  const [template, setTemplate] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [loaded, setLoaded] = useState<Prompt | null>(null);
  const [panes, setPanes] = useState<Pane[]>([idle, idle]);
  const [saving, setSaving] = useState(false);
  const controllers = useRef<AbortController[]>([]);
  const [, force] = useState(0);

  // Pick sensible default models once providers load.
  useEffect(() => {
    if (!providers) return;
    const first = defaultChoice(providers);
    const second = providers.flatMap((p) => (p.available ? p.models.map((m) => ({ provider: p.id, model: m.id })) : [])).find((c) => c.model !== first.model) ?? first;
    setModels((m) => (m.length === 1 && m[0].model === 'demo-assistant' ? [first, second] : m));
  }, [providers]);

  // Load a saved prompt from ?prompt=<id>.
  useEffect(() => {
    const id = params.get('prompt');
    const p = prompts?.find((x) => x.id === id);
    if (!p || loaded?.id === p.id) return;
    setLoaded(p);
    setTemplate(p.template);
    setSystem(p.system);
    setTemperature(p.temperature);
    setMaxTokens(p.maxTokens);
    setValues({});
    const available = providers?.find((x) => x.id === p.provider)?.available;
    if (available) setModels((m) => [{ provider: p.provider, model: p.model }, m[1] ?? m[0]]);
  }, [params, prompts, providers, loaded?.id]);

  const variables = useMemo(() => variablesOf(template), [template]);
  const finalPrompt = fillTemplate(template, values);
  const missing = variables.filter((v) => !values[v]?.trim());
  const streaming = panes.some((p) => p.status === 'streaming');

  // Tick the elapsed timer while streaming.
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(t);
  }, [streaming]);

  const run = () => {
    if (!template.trim()) return toast.error('Write a prompt first');
    if (missing.length) return toast.error(`Fill in ${missing.map((m) => `{{${m}}}`).join(', ')}`);
    const targets = compare ? [0, 1] : [0];
    controllers.current.forEach((c) => c.abort());
    controllers.current = [];
    setPanes((p) => p.map((x, i) => (targets.includes(i) ? { text: '', status: 'streaming', startedAt: Date.now() } : x)));
    for (const i of targets) {
      const ctrl = new AbortController();
      controllers.current[i] = ctrl;
      const update = (fn: (p: Pane) => Pane) => setPanes((ps) => ps.map((p, j) => (j === i ? fn(p) : p)));
      streamRun(
        { ...models[i], system: system || undefined, prompt: finalPrompt, temperature, maxTokens, promptId: loaded?.id },
        {
          onDelta: (t) => update((p) => ({ ...p, text: p.text + t, ttft: p.ttft ?? Date.now() - (p.startedAt ?? Date.now()) })),
          onDone: (r) => { update((p) => ({ ...p, status: 'done', run: r })); qc.invalidateQueries({ queryKey: ['runs'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); },
          onError: (message) => update((p) => ({ ...p, status: 'error', error: message })),
        },
        ctrl.signal,
      );
    }
  };
  const stop = () => { controllers.current.forEach((c) => c.abort()); setPanes((ps) => ps.map((p) => (p.status === 'streaming' ? { ...p, status: 'done' } : p))); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!streaming) run(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rate = async (i: number, rating: -1 | 0 | 1) => {
    const r = panes[i].run;
    if (!r) return;
    const next = r.rating === rating ? 0 : rating;
    setPanes((ps) => ps.map((p, j) => (j === i && p.run ? { ...p, run: { ...p.run, rating: next } } : p)));
    await api.patch(`/runs/${r.id}`, { rating: next }).catch((e) => toast.error(getErrorMessage(e)));
  };

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col lg:h-screen lg:flex-row">
      {/* Settings */}
      <aside className="space-y-5 border-b border-line bg-surface p-5 lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r scrollbar-thin">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Playground</h1>
          <button onClick={() => setCompare((c) => !c)} aria-pressed={compare} className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition', compare ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-line text-muted hover:text-ink')}>
            <Columns2 className="h-3.5 w-3.5" /> Compare
          </button>
        </div>
        <ModelSelect id="model-a" label={compare ? 'Model A' : 'Model'} providers={providers} value={models[0]} onChange={(v) => setModels((m) => [v, m[1] ?? v])} />
        {compare && <ModelSelect id="model-b" label="Model B" providers={providers} value={models[1] ?? models[0]} onChange={(v) => setModels((m) => [m[0], v])} />}
        <div>
          <div className="mb-1.5 flex justify-between"><label htmlFor="temp" className="label">Temperature</label><span className="tabular font-mono text-xs">{temperature.toFixed(1)}</span></div>
          <input id="temp" type="range" min={0} max={1} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full accent-brand-600" />
          <div className="mt-1 flex justify-between text-[11px] text-muted"><span>Precise</span><span>Creative</span></div>
        </div>
        <div>
          <div className="mb-1.5 flex justify-between"><label htmlFor="max" className="label">Max tokens</label><span className="tabular font-mono text-xs">{maxTokens}</span></div>
          <input id="max" type="range" min={64} max={4096} step={64} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-full accent-brand-600" />
        </div>
        <div>
          <label htmlFor="system" className="label mb-1.5 block">System prompt</label>
          <Textarea id="system" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="You are a helpful assistant…" className="min-h-[110px] font-mono text-[12.5px]" />
        </div>
        <div>
          <label htmlFor="load" className="label mb-1.5 block">Load from library</label>
          <select id="load" value={loaded?.id ?? ''} onChange={(e) => { setLoaded(null); setParams(e.target.value ? { prompt: e.target.value } : {}); if (!e.target.value) { setTemplate(''); setSystem(''); } }} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm">
            <option value="">Blank prompt</option>
            {prompts?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </aside>

      {/* Editor + output */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-line bg-surface/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="label">{loaded ? loaded.title : 'Prompt'}</p>
            <span className="text-[11px] text-muted">Use <code className="rounded bg-surface-2 px-1 font-mono">{'{{variable}}'}</code> for placeholders</span>
          </div>
          <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="Ask anything, or write a reusable template like: Summarise {{text}} in {{tone}} tone." className="min-h-[120px] text-[14px] leading-relaxed" aria-label="Prompt" />
          {variables.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {variables.map((v) => (
                <label key={v} className="block">
                  <span className="mb-1 block font-mono text-[11px] font-medium text-brand-700">{`{{${v}}}`}</span>
                  <textarea
                    value={values[v] ?? ''}
                    onChange={(e) => setValues((x) => ({ ...x, [v]: e.target.value }))}
                    rows={Math.min(8, Math.max(2, (values[v] ?? '').split('\n').length))}
                    aria-label={v}
                    placeholder={`Value for ${v}`}
                    className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {streaming ? (
              <Button variant="danger" onClick={stop}><Square className="h-3.5 w-3.5 fill-current" /> Stop</Button>
            ) : (
              <Button onClick={run}><Play className="h-4 w-4 fill-current" /> Run</Button>
            )}
            <Button variant="outline" onClick={() => setSaving(true)} disabled={!template.trim()}><Save className="h-4 w-4" /> {loaded ? 'Save as new' : 'Save to library'}</Button>
            <span className="ml-auto hidden text-xs text-muted sm:block"><kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">Ctrl</kbd> + <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px]">Enter</kbd> to run</span>
          </div>
        </div>

        <div className={cn('grid min-h-0 flex-1 gap-px bg-line', compare && 'md:grid-cols-2')}>
          {(compare ? [0, 1] : [0]).map((i) => (
            <OutputPane key={i} pane={panes[i]} choice={models[i] ?? models[0]} label={compare ? (i === 0 ? 'A' : 'B') : undefined} providers={providers} onRate={(r) => rate(i, r)} />
          ))}
        </div>
      </section>

      <SavePromptModal open={saving} onClose={() => setSaving(false)} draft={{ template, system, temperature, maxTokens, ...models[0] }} />
    </div>
  );
}

function OutputPane({ pane, choice, label, providers, onRate }: { pane: Pane; choice: ModelChoice; label?: string; providers?: ReturnType<typeof useProviders>['data']; onRate: (r: -1 | 1) => void }) {
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const modelLabel = providers?.find((p) => p.id === choice.provider)?.models.find((m) => m.id === choice.model)?.label ?? choice.model;
  const elapsed = pane.startedAt ? (pane.run?.latencyMs ?? Date.now() - pane.startedAt) : 0;
  const r = pane.run;
  const tps = r && r.outputTokens && r.latencyMs - (r.ttftMs ?? 0) > 0 ? r.outputTokens / ((r.latencyMs - (r.ttftMs ?? 0)) / 1000) : null;

  useEffect(() => {
    const el = scroller.current;
    if (el && pane.status === 'streaming' && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [pane.text, pane.status]);

  return (
    <div className="flex min-h-[320px] min-w-0 flex-col bg-bg">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-2.5 text-xs">
        {label && <span className="grid h-5 w-5 place-items-center rounded-md bg-night font-mono text-[10px] font-bold text-white">{label}</span>}
        <span className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: PROVIDER_META[choice.provider]?.color }} />{modelLabel}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-muted">
          {pane.status !== 'idle' && <Metric k="time" v={ms(elapsed)} live={pane.status === 'streaming'} />}
          {(pane.ttft ?? r?.ttftMs) !== undefined && <Metric k="ttft" v={ms((r?.ttftMs ?? pane.ttft)!)} />}
          {r && <Metric k="tokens" v={`${compact(r.inputTokens)} → ${compact(r.outputTokens)}`} />}
          {tps && <Metric k="speed" v={`${Math.round(tps)} tok/s`} />}
        </div>
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin lg:px-8">
        {pane.status === 'idle' && (
          <div className="grid h-full min-h-[220px] place-items-center text-center text-sm text-muted">
            <div>
              <Wand2 className="mx-auto mb-3 h-8 w-8 text-brand-500/60" />
              <p>Responses stream here as they are generated.</p>
            </div>
          </div>
        )}
        {pane.status === 'error' && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><b>Request failed.</b> {pane.error}</div>}
        {pane.text && (
          <div className="mx-auto max-w-3xl animate-fade-up">
            <Markdown>{pane.text}</Markdown>
            {pane.status === 'streaming' && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-caret bg-brand-500" />}
          </div>
        )}
        {pane.status === 'streaming' && !pane.text && (
          <div className="mx-auto max-w-3xl space-y-2.5">
            {[90, 75, 82].map((w, i) => <div key={i} className="h-3.5 animate-shimmer rounded bg-gradient-to-r from-surface-2 via-surface-3 to-surface-2 bg-[length:200%_100%]" style={{ width: `${w}%` }} />)}
          </div>
        )}
      </div>
      {pane.status === 'done' && r && (
        <div className="flex items-center gap-1 border-t border-line bg-surface px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(pane.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => toast.error('Copy is blocked in this browser'))}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
          </Button>
          <span className="ml-auto text-xs text-muted">Was this helpful?</span>
          <Button variant="ghost" size="icon" aria-pressed={r.rating === 1} onClick={() => onRate(1)} aria-label="Helpful" className={cn(r.rating === 1 && 'bg-emerald-50 text-emerald-700')}><ThumbsUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-pressed={r.rating === -1} onClick={() => onRate(-1)} aria-label="Not helpful" className={cn(r.rating === -1 && 'bg-red-50 text-red-700')}><ThumbsDown className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

function Metric({ k, v, live }: { k: string; v: string; live?: boolean }) {
  return (
    <span className="tabular flex items-center gap-1">
      <span className="text-muted/70">{k}</span>
      <span className={cn('font-semibold text-ink', live && 'text-brand-700')}>{v}</span>
    </span>
  );
}

function SavePromptModal({ open, onClose, draft }: { open: boolean; onClose: () => void; draft: { template: string; system: string; temperature: number; maxTokens: number; provider: string; model: string } }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const save = async () => {
    if (title.trim().length < 2) return toast.error('Give the prompt a title');
    setBusy(true);
    try {
      await api.post('/prompts', { ...draft, title, description, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
      qc.invalidateQueries({ queryKey: ['prompts'] });
      toast.success('Saved to your prompt library');
      setTitle(''); setDescription(''); setTags('');
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Save to library">
      <div className="space-y-4">
        <Field label="Title" htmlFor="sp-title"><Input id="sp-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} autoFocus /></Field>
        <Field label="Description" htmlFor="sp-desc"><Input id="sp-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} /></Field>
        <Field label="Tags" htmlFor="sp-tags" hint="Comma separated, e.g. support, email"><Input id="sp-tags" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
        <pre className="max-h-40 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-xs text-muted scrollbar-thin">{draft.template}</pre>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save prompt</Button></div>
      </div>
    </Modal>
  );
}
