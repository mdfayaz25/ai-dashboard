import { ArrowDownRight, ArrowUpRight, Clock, Coins, Gauge, MessageSquareText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAnalytics, useRuns } from '@/hooks/queries';
import { change, compact, ms, pct, PROVIDER_META, usd } from '@/lib/format';
import { ModelBadge, StatusDot } from '@/components/ModelBadge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const tick = { fontSize: 11, fill: 'rgb(var(--muted))' };
const tooltipStyle = { borderRadius: 12, border: '1px solid rgb(var(--line))', fontSize: 12, boxShadow: '0 12px 30px -12px rgba(11,18,32,.3)' };

export default function Overview() {
  const [days, setDays] = useState(14);
  const { user } = useAuth();
  const { data, isLoading } = useAnalytics(days);
  const recent = useRuns({ limit: 6 });

  if (isLoading || !data) return <div className="grid h-[70vh] place-items-center"><Spinner className="h-7 w-7" /></div>;
  const s = data.summary;
  const p = data.previous;
  const satisfaction = s.rated ? s.positive / s.rated : 0;
  const maxRuns = Math.max(1, ...data.models.map((m) => m.runs));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Overview</p>
          <h1 className="mt-1 text-3xl font-bold">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="mt-1 text-muted">Usage across Claude, Bedrock and the demo model for the last {days} days.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-line bg-surface p-1 shadow-card" role="tablist" aria-label="Date range">
            {[7, 14, 30].map((d) => (
              <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)} className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition', days === d ? 'bg-night text-white' : 'text-muted hover:text-ink')}>{d}d</button>
            ))}
          </div>
          <Link to="/playground"><Button><Sparkles className="h-4 w-4" /> New run</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={MessageSquareText} label="Runs" value={compact(s.runs)} delta={change(s.runs, p.runs)} />
        <Kpi icon={Coins} label={s.cost !== null ? 'Est. cost' : 'Tokens'} value={s.cost !== null ? usd(s.cost) : compact(s.tokens)} delta={change(s.tokens, p.tokens)} hint={s.cost === null ? 'Set prices in config to see cost' : undefined} />
        <Kpi icon={Clock} label="Avg latency" value={ms(s.avgLatency)} sub={`p95 ${ms(s.p95Latency)}`} delta={change(s.avgLatency, p.avgLatency)} lowerIsBetter />
        <Kpi icon={Gauge} label="Success rate" value={pct(s.successRate)} sub={`${s.rated ? pct(satisfaction) : '–'} rated helpful`} delta={change(s.successRate, p.successRate)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Runs per day</h2>
            <span className="text-xs text-muted">by provider</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={data.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
                <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { day: 'numeric', month: 'short' })} tick={tick} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgb(var(--surface-2))' }} contentStyle={tooltipStyle} labelFormatter={(d) => formatDate(String(d), { weekday: 'short', day: 'numeric', month: 'short' })} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {(['anthropic', 'bedrock', 'demo'] as const).map((k, i, arr) => (
                  <Bar key={k} dataKey={k} name={PROVIDER_META[k].label} stackId="runs" fill={PROVIDER_META[k].color} radius={i === arr.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Token usage</h2>
            <span className="tabular text-xs text-muted">{compact(s.tokens)} total</span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={data.daily} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06B6D4" stopOpacity={0.35} /><stop offset="100%" stopColor="#06B6D4" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gout" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
                <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { day: 'numeric', month: 'short' })} tick={tick} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={compact} tick={tick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => compact(Number(v))} labelFormatter={(d) => formatDate(String(d), { weekday: 'short', day: 'numeric', month: 'short' })} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="inputTokens" name="Input" stroke="#06B6D4" strokeWidth={2} fill="url(#gin)" />
                <Area type="monotone" dataKey="outputTokens" name="Output" stroke="#8B5CF6" strokeWidth={2} fill="url(#gout)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-4">
            <h2 className="font-semibold">Model performance</h2>
            <span className="text-xs text-muted">latency of successful runs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-y border-line bg-surface-2/60 text-left text-[11px] uppercase tracking-wider text-muted">
                <tr><th className="px-5 py-2.5 font-semibold">Model</th><th className="px-3 py-2.5 font-semibold">Runs</th><th className="px-3 py-2.5 text-right font-semibold">TTFT p50</th><th className="px-3 py-2.5 text-right font-semibold">Latency p50</th><th className="px-3 py-2.5 text-right font-semibold">p95</th><th className="px-5 py-2.5 text-right font-semibold">Errors</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.models.map((m) => (
                  <tr key={`${m.provider}:${m.model}`} className="hover:bg-surface-2/40">
                    <td className="px-5 py-3"><ModelBadge provider={m.provider} label={m.label} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="tabular w-7 font-semibold">{m.runs}</span>
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(m.runs / maxRuns) * 100}%`, background: PROVIDER_META[m.provider].color }} /></span>
                      </div>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-mono text-[13px]">{ms(m.ttftP50)}</td>
                    <td className="tabular px-3 py-3 text-right font-mono text-[13px]">{ms(m.p50)}</td>
                    <td className="tabular px-3 py-3 text-right font-mono text-[13px] text-muted">{ms(m.p95)}</td>
                    <td className="px-5 py-3 text-right"><span className={cn('tabular rounded-md px-1.5 py-0.5 text-xs font-semibold', m.errors ? 'bg-red-50 text-red-700' : 'text-muted')}>{m.errors}</span></td>
                  </tr>
                ))}
                {data.models.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-muted">No runs in this period yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Most-used prompts</h2>
            <ul className="mt-4 space-y-3">
              {data.topPrompts.map((t, i) => (
                <li key={t.title} className="flex items-center gap-3 text-sm">
                  <span className="tabular grid h-6 w-6 place-items-center rounded-md bg-surface-2 font-mono text-xs text-muted">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{t.title}</span>
                  <span className="tabular font-mono text-xs text-muted">{t.runs} runs</span>
                </li>
              ))}
              {data.topPrompts.length === 0 && <p className="text-sm text-muted">Run a saved prompt to see it here.</p>}
            </ul>
          </section>
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recent runs</h2>
              <Link to="/history" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {recent.data?.runs.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PROVIDER_META[r.provider].color }} />
                  <span className="min-w-0 flex-1 truncate">{r.promptTitle ?? r.input.slice(0, 60)}</span>
                  <StatusDot status={r.status} />
                  <span className="w-16 shrink-0 text-right text-xs text-muted">{timeAgo(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta, lowerIsBetter, hint }: { icon: typeof Clock; label: string; value: string; sub?: string; delta: number | null; lowerIsBetter?: boolean; hint?: string }) {
  const good = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);
  return (
    <div className="card p-4 sm:p-5" title={hint}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-muted"><Icon className="h-4 w-4" /> {label}</span>
        {delta !== null && Math.abs(delta) >= 0.005 && (
          <span className={cn('tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(delta * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="tabular mt-3 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub ?? (delta !== null ? 'vs previous period' : 'No previous data')}</p>
    </div>
  );
}

