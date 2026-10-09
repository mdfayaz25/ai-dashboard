import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, History as HistoryIcon, Search, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Run } from '@/types';
import { useProviders, useRuns } from '@/hooks/queries';
import { compact, ms, usd } from '@/lib/format';
import { Markdown } from '@/components/Markdown';
import { ModelBadge, StatusDot } from '@/components/ModelBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { cn, formatDate } from '@/lib/utils';

export default function History() {
  const { data: providers } = useProviders();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Run | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 250); return () => clearTimeout(t); }, [search]);
  const { data, isLoading, isFetching } = useRuns({ search: debounced || undefined, provider: provider || undefined, status: status || undefined, page, limit: 15 });
  const label = (r: Run) => providers?.find((p) => p.id === r.provider)?.models.find((m) => m.id === r.model)?.label ?? r.model;

  const rate = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => api.patch(`/runs/${id}`, { rating }),
    onSuccess: (_d, v) => { setOpen((r) => (r ? { ...r, rating: v.rating as Run['rating'] } : r)); qc.invalidateQueries({ queryKey: ['runs'] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/runs/${id}`),
    onSuccess: () => { setOpen(null); qc.invalidateQueries({ queryKey: ['runs'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); toast.success('Run deleted'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <div>
        <p className="label">History</p>
        <h1 className="mt-1 text-3xl font-bold">Run history</h1>
        <p className="tabular mt-1 text-muted">{data?.total ?? 0} runs, newest first</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inputs and outputs" className="h-10 pl-10" aria-label="Search runs" />
        </div>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-medium" aria-label="Provider">
          <option value="">All providers</option>
          {providers?.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm font-medium" aria-label="Status">
          <option value="">Any status</option><option value="success">Successful</option><option value="error">Errors</option><option value="cancelled">Cancelled</option>
        </select>
      </div>

      {!isLoading && data?.runs.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No runs found" text="Runs from the playground appear here with their inputs, outputs and timings." />
      ) : (
        <div className={cn('card overflow-x-auto transition-opacity', isFetching && 'opacity-70')}>
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-line bg-surface-2/60 text-left text-[11px] uppercase tracking-wider text-muted">
              <tr><th className="px-5 py-3 font-semibold">Prompt</th><th className="px-3 py-3 font-semibold">Model</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Tokens</th><th className="px-3 py-3 text-right font-semibold">Latency</th><th className="px-3 py-3 font-semibold">Rating</th><th className="px-5 py-3 text-right font-semibold">When</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(isLoading ? [] : data?.runs ?? []).map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer hover:bg-surface-2/50">
                  <td className="max-w-[320px] px-5 py-3">
                    <p className="truncate font-medium">{r.promptTitle ?? 'Ad-hoc prompt'}</p>
                    <p className="truncate text-xs text-muted">{r.input.replace(/\s+/g, ' ').slice(0, 90)}</p>
                  </td>
                  <td className="px-3 py-3"><ModelBadge provider={r.provider} label={label(r)} /></td>
                  <td className="px-3 py-3"><StatusDot status={r.status} /></td>
                  <td className="tabular px-3 py-3 text-right font-mono text-[12.5px]">{r.status === 'success' ? `${compact(r.inputTokens)} → ${compact(r.outputTokens)}` : '—'}</td>
                  <td className="tabular px-3 py-3 text-right font-mono text-[12.5px]">{ms(r.latencyMs)}</td>
                  <td className="px-3 py-3">{r.rating === 1 ? <ThumbsUp className="h-4 w-4 text-emerald-600" /> : r.rating === -1 ? <ThumbsDown className="h-4 w-4 text-red-500" /> : <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-muted">{formatDate(r.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                </tr>
              ))}
              {isLoading && Array.from({ length: 8 }, (_, i) => <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-8 animate-pulse rounded-lg bg-surface-2" /></td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="tabular text-sm text-muted">Page {page} of {data.pages}</span>
          <Button variant="outline" size="icon" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div className="absolute inset-0 bg-night/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} />
            <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }} className="relative flex h-full w-full max-w-2xl flex-col bg-surface shadow-pop" role="dialog" aria-label="Run details">
              <header className="flex items-center gap-3 border-b border-line px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{open.promptTitle ?? 'Ad-hoc prompt'}</p>
                  <p className="text-xs text-muted">{formatDate(open.createdAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { if (window.confirm('Delete this run?')) remove.mutate(open.id); }} aria-label="Delete run" className="hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(null)} aria-label="Close"><X className="h-5 w-5" /></Button>
              </header>
              <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['Latency', ms(open.latencyMs)], ['First token', open.ttftMs ? ms(open.ttftMs) : '—'], ['Tokens', `${compact(open.inputTokens)} → ${compact(open.outputTokens)}`], ['Cost', open.cost != null ? usd(open.cost) : 'Not priced']].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-surface-2/70 p-3"><p className="label">{k}</p><p className="tabular mt-1 font-mono text-sm font-semibold">{v}</p></div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2"><ModelBadge provider={open.provider} label={label(open)} /><StatusDot status={open.status} /><span className="text-xs text-muted">temp {open.temperature ?? '—'} · max {open.maxTokens ?? '—'}</span></div>
                {open.system && <section><p className="label mb-2">System</p><pre className="whitespace-pre-wrap rounded-xl bg-surface-2/70 p-3 font-mono text-[12.5px]">{open.system}</pre></section>}
                <section><p className="label mb-2">Input</p><pre className="whitespace-pre-wrap rounded-xl bg-surface-2/70 p-3 font-mono text-[12.5px]">{open.input}</pre></section>
                <section>
                  <p className="label mb-2">Output</p>
                  {open.status === 'success' ? <div className="rounded-xl border border-line p-4"><Markdown>{open.output}</Markdown></div> : <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{open.error ?? 'No output'}</div>}
                </section>
              </div>
              {open.status === 'success' && (
                <footer className="flex items-center gap-2 border-t border-line px-6 py-3">
                  <span className="mr-auto text-sm text-muted">Was this helpful?</span>
                  <Button variant="outline" size="sm" onClick={() => rate.mutate({ id: open.id, rating: open.rating === 1 ? 0 : 1 })} className={cn(open.rating === 1 && 'border-emerald-300 bg-emerald-50 text-emerald-700')}><ThumbsUp className="h-4 w-4" /> Yes</Button>
                  <Button variant="outline" size="sm" onClick={() => rate.mutate({ id: open.id, rating: open.rating === -1 ? 0 : -1 })} className={cn(open.rating === -1 && 'border-red-300 bg-red-50 text-red-700')}><ThumbsDown className="h-4 w-4" /> No</Button>
                </footer>
              )}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
