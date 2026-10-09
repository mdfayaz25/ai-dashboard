import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Logo } from '@/components/layout/AppLayout';

const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
const registerSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email: z.string().email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') });

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register: signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';
  const form = useForm<{ name?: string; email: string; password: string }>({ resolver: zodResolver(isLogin ? loginSchema : registerSchema), defaultValues: { name: '', email: isLogin ? 'fayaz@aidash.dev' : '', password: isLogin ? 'Demo@1234' : '' } });
  const { errors } = form.formState;
  if (user) return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true);
    try {
      await (isLogin ? login(v.email, v.password) : signup(v.name!, v.email, v.password));
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.15fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-bold">{isLogin ? 'Sign in' : 'Create your workspace'}</h1>
          <p className="mt-2 text-muted">{isLogin ? 'The demo account is filled in for you.' : 'Bring your own Claude or AWS keys, or start with the offline demo model.'}</p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {!isLogin && <Field label="Name" error={errors.name?.message} htmlFor="name"><Input id="name" autoComplete="name" invalid={!!errors.name} {...form.register('name')} /></Field>}
            <Field label="Email" error={errors.email?.message} htmlFor="email"><Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...form.register('email')} /></Field>
            <Field label="Password" error={errors.password?.message} htmlFor="password"><Input id="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} invalid={!!errors.password} {...form.register('password')} /></Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>{isLogin ? 'Sign in' : 'Create account'}</Button>
          </form>
          <p className="mt-8 text-center text-sm text-muted">
            {isLogin ? 'New here? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-semibold text-brand-700 hover:underline">{isLogin ? 'Create an account' : 'Sign in'}</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-night lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(34,211,238,.25),transparent_70%),radial-gradient(50%_50%_at_10%_90%,rgba(139,92,246,.25),transparent_70%)]" />
        <div className="relative flex h-full flex-col justify-center gap-6 p-14 text-slate-200">
          <div className="max-w-lg rounded-2xl border border-night-line bg-night-2/80 p-5 font-mono text-[13px] shadow-pop backdrop-blur">
            <p className="text-slate-500">// Claude Sonnet 5.5 · streaming</p>
            <p className="mt-3 text-slate-300"><span className="text-cyan-300">prompt</span>: Summarise these 28 support tickets into themes</p>
            <div className="mt-4 space-y-1.5 text-slate-200">
              <p>| Payment failures on UPI | <span className="text-cyan-300">14</span> |</p>
              <p>| Delivery delays in Pune | <span className="text-cyan-300">9</span> |</p>
              <p>| OTP login issues        | <span className="text-cyan-300">5</span> |<span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-caret bg-cyan-300" /></p>
            </div>
            <div className="mt-5 flex gap-4 border-t border-night-line pt-3 text-[11px] text-slate-400"><span>ttft <b className="text-white">412ms</b></span><span>tokens <b className="text-white">1.2k → 210</b></span><span>speed <b className="text-white">86 tok/s</b></span></div>
          </div>
          <div className="max-w-md">
            <p className="font-display text-3xl font-bold leading-tight text-white">One workbench for every model you use.</p>
            <p className="mt-3 text-slate-400">Compare Claude and AWS Bedrock side by side, keep your best prompts, and see what each call costs in time and tokens.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
