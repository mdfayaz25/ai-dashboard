import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Pencil, Play, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Prompt } from '@/types';
import { usePrompts, useProviders } from '@/hooks/queries';
import { variablesOf } from '@/lib/format';
import { ModelBadge } from '@/components/ModelBadge';
import { ModelSelect } from '@/components/ModelSelect';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn, timeAgo } from '@/lib/utils';

type Draft = Pick<Prompt, 'title' | 'description' | 'system' | 'template' | 'provider' | 'model' | 'temperature' | 'maxTokens'> & { tags: string };
const blank: Draft = { title: '', description: '', system: '', template: '', provider: 'anthropic', model: 'claude-sonnet-5-5', temperature: 0.7, maxTokens: 1024, tags: '' };

/** Shows {{variables}} highlighted inside a template preview. */
function Highlighted({ text }: { text: string }) {
  return <>{text.split(/(\{\{\s*[a-zA-Z_]\w*\s*\}\})/g).map((part, i) => (part.startsWith('{{') ? <mark key={i} className="rounded bg-brand-100 px-0.5 text-brand-800">{part}</mark> : part))}</>;
}

export default function Prompts() {
  const { data: prompts, isLoading } = usePrompts();
  const { data: providers } = useProviders();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);

  const tags = useMemo(() => [...new Set(prompts?.flatMap((p) => p.tags) ?? [])].sort(), [prompts]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (prompts ?? []).filter((p) => (!tag || p.tags.includes(tag)) && (!term || `${p.title} ${p.description} ${p.template}`.toLowerCase().includes(term)));
  }, [prompts, q, tag]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['prompts'] });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean) };
      return editing ? api.patch(`/prompts/${editing.id}`, body) : api.post('/prompts', body);
    },
    onSuccess: () => { invalidate(); toast.success(editing ? 'Prompt updated' : 'Prompt created'); setOpen(false); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const favorite = useMutation({ mutationFn: (p: Prompt) => api.patch(`/prompts/${p.id}`, { favorite: !p.favorite }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/prompts/${id}`), onSuccess: () => { invalidate(); toast.success('Prompt deleted'); }, onError: (e) => toast.error(getErrorMessage(e)) });

  const edit = (p?: Prompt) => {
    setEditing(p ?? null);
    setDraft(p ? { title: p.title, description: p.description, system: p.system, template: p.template, provider: p.provider, model: p.model, temperature: p.temperature, maxTokens: p.maxTokens, tags: p.tags.join(', ') } : blank);
    setOpen(true);
  };
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const label = (p: Prompt) => providers?.find((x) => x.id === p.provider)?.models.find((m) => m.id === p.model)?.label ?? p.model;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Library</p>
          <h1 className="mt-1 text-3xl font-bold">Prompt library</h1>
          <p className="mt-1 text-muted">Reusable templates with variables, default models and settings.</p>
        </div>
        <Button onClick={() => edit()}><Plus className="h-4 w-4" /> New prompt</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts" className="h-10 pl-10" aria-label="Search prompts" />
        </div>
        <button onClick={() => setTag(null)} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition', !tag ? 'border-night bg-night text-white' : 'border-line bg-surface text-muted hover:text-ink')}>All</button>
        {tags.map((t) => (
          <button key={t} onClick={() => setTag(tag === t ? null : t)} className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition', tag === t ? 'border-night bg-night text-white' : 'border-line bg-surface text-muted hover:text-ink')}>#{t}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-60 animate-pulse rounded-2xl bg-surface" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={BookMarked} title={prompts?.length ? 'No prompts match' : 'Your library is empty'} text="Save prompts you use often, with {{variables}} for the parts that change." action={<Button onClick={() => edit()}><Plus className="h-4 w-4" /> New prompt</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <article key={p.id} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-semibold">{p.title}</h2>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.description || 'No description'}</p>
                </div>
                <button onClick={() => favorite.mutate(p)} aria-pressed={p.favorite} aria-label={p.favorite ? 'Unfavourite' : 'Favourite'} className="rounded-lg p-1.5 transition hover:bg-surface-2">
                  <Star className={cn('h-4 w-4', p.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
                </button>
              </div>
              <pre className="mt-4 line-clamp-4 whitespace-pre-wrap break-words rounded-xl bg-surface-2/70 p-3 font-mono text-[12px] leading-relaxed text-ink/80"><Highlighted text={p.template} /></pre>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <ModelBadge provider={p.provider} label={label(p)} />
                {p.tags.map((t) => <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">#{t}</span>)}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                <span className="tabular text-xs text-muted">{p.runCount} runs{p.lastRunAt && ` · last ${timeAgo(p.lastRunAt)}`}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => edit(p)} aria-label={`Edit ${p.title}`}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Delete “${p.title}”?`)) remove.mutate(p.id); }} aria-label={`Delete ${p.title}`} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => navigate(`/playground?prompt=${p.id}`)}><Play className="h-3.5 w-3.5 fill-current" /> Run</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit prompt' : 'New prompt'} className="sm:max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor="p-title"><Input id="p-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} required /></Field>
            <Field label="Tags" htmlFor="p-tags" hint="Comma separated"><Input id="p-tags" value={draft.tags} onChange={(e) => set({ tags: e.target.value })} /></Field>
          </div>
          <Field label="Description" htmlFor="p-desc"><Input id="p-desc" value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={280} /></Field>
          <Field label="System prompt" htmlFor="p-sys"><Textarea id="p-sys" value={draft.system} onChange={(e) => set({ system: e.target.value })} className="min-h-[70px] font-mono text-[12.5px]" /></Field>
          <Field label="Template" htmlFor="p-tpl" hint={variablesOf(draft.template).length ? `Variables: ${variablesOf(draft.template).join(', ')}` : 'Use {{name}} for parts that change on each run'}>
            <Textarea id="p-tpl" value={draft.template} onChange={(e) => set({ template: e.target.value })} className="min-h-[140px] font-mono text-[12.5px]" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><ModelSelect id="p-model" label="Default model" providers={providers?.map((x) => ({ ...x, available: true }))} value={{ provider: draft.provider, model: draft.model }} onChange={(v) => set(v)} /></div>
            <div>
              <label htmlFor="p-temp" className="label mb-1.5 block">Temperature · {draft.temperature.toFixed(1)}</label>
              <input id="p-temp" type="range" min={0} max={1} step={0.1} value={draft.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} className="mt-2.5 w-full accent-brand-600" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Create prompt'}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
