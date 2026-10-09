import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from '@/lib/api';
import type { User } from '@/types';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const qc = useQueryClient();

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const handleAuth = useCallback((data: { user: User; token: string }) => {
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => handleAuth((await api.post('/auth/login', { email, password })).data),
    [handleAuth],
  );
  const register = useCallback(
    async (name: string, email: string, password: string) =>
      handleAuth((await api.post('/auth/register', { name, email, password })).data),
    [handleAuth],
  );

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
