import { PROVIDER_META } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ModelBadge({ provider, label, className }: { provider: string; label: string; className?: string }) {
  const meta = PROVIDER_META[provider];
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium', className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta?.color }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function StatusDot({ status }: { status: 'success' | 'error' | 'cancelled' }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', status === 'success' ? 'bg-emerald-50 text-emerald-700' : status === 'error' ? 'bg-red-50 text-red-700' : 'bg-surface-2 text-muted')}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === 'success' ? 'OK' : status === 'error' ? 'Error' : 'Cancelled'}
    </span>
  );
}
