import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, History, LayoutDashboard, LogOut, Menu, Sparkles, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useProviders } from '@/hooks/queries';
import { PROVIDER_META } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/playground', label: 'Playground', icon: Sparkles },
  { to: '/prompts', label: 'Prompt library', icon: BookMarked },
  { to: '/history', label: 'Run history', icon: History },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#111A2E" stroke="#22304F" />
        <path d="M16 6.5l2.3 6.2 6.2 2.3-6.2 2.3L16 23.5l-2.3-6.2L7.5 15l6.2-2.3z" fill="#22D3EE" />
        <circle cx="24" cy="24" r="2.2" fill="#A78BFA" />
      </svg>
      <span className="font-display text-[17px] font-bold tracking-tight">AI Dashboard</span>
    </span>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { data: providers } = useProviders();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const side = (
    <div className="flex h-full flex-col gap-8 bg-night px-4 py-5 text-slate-300">
      <div className="px-2 text-white"><Logo /></div>
      <nav className="space-y-1" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-night-3 text-white shadow-[inset_0_0_0_1px_#22304F]' : 'text-slate-400 hover:bg-night-2 hover:text-white')}>
            {({ isActive }) => (<><n.icon className={cn('h-[18px] w-[18px]', isActive && 'text-brand-400')} /> {n.label}</>)}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-2 rounded-2xl border border-night-line bg-night-2 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">Providers</p>
        {providers?.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: PROVIDER_META[p.id].color }} />{p.label}</span>
            <span className={cn('rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold', p.available ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-500/15 text-slate-400')}>{p.available ? 'Ready' : 'No key'}</span>
          </div>
        ))}
      </div>
      {user && (
        <div className="mt-auto flex items-center gap-3 rounded-2xl p-2">
          <Avatar name={user.name} color={user.avatarColor} size={36} className="[&>span]:ring-night" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <button onClick={logout} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-night-2 hover:text-white" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 shrink-0 bg-night lg:block">
        <aside className="sticky top-0 h-screen">{side}</aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-night px-4 py-3 text-white lg:hidden">
          <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-night-2" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <Logo />
          <span className="w-9" />
        </header>
        <main className="min-w-0 flex-1">
          <Suspense fallback={<div className="grid h-[60vh] place-items-center"><Spinner className="h-7 w-7" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-y-0 left-0 w-72">
              <button onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-night-2" aria-label="Close menu"><X className="h-4 w-4" /></button>
              {side}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
