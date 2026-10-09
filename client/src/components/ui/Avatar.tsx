import { cn, initials } from '@/lib/utils';

export function Avatar({ name, color, size = 32, className, online }: { name: string; color?: string; size?: number; className?: string; online?: boolean }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <span
        className="grid h-full w-full place-items-center rounded-full font-semibold text-white ring-2 ring-surface"
        style={{ background: color ?? '#64748b', fontSize: size * 0.38 }}
        title={name}
      >
        {initials(name)}
      </span>
      {online !== undefined && (
        <span
          className={cn('absolute bottom-0 right-0 rounded-full ring-2 ring-surface', online ? 'bg-emerald-500' : 'bg-slate-400')}
          style={{ width: size * 0.3, height: size * 0.3 }}
        />
      )}
    </span>
  );
}
