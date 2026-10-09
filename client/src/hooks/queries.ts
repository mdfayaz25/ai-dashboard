import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Analytics, Prompt, ProviderInfo, Run } from '@/types';

export const useProviders = () =>
  useQuery({ queryKey: ['providers'], queryFn: async () => (await api.get<{ providers: ProviderInfo[] }>('/providers')).data.providers, staleTime: 5 * 60_000 });

export const usePrompts = () => useQuery({ queryKey: ['prompts'], queryFn: async () => (await api.get<{ prompts: Prompt[] }>('/prompts')).data.prompts });

export const useAnalytics = (days: number) =>
  useQuery({ queryKey: ['analytics', days], queryFn: async () => (await api.get<Analytics>('/analytics', { params: { days } })).data });

export const useRuns = (params: Record<string, string | number | undefined>) =>
  useQuery({
    queryKey: ['runs', params],
    queryFn: async () => (await api.get<{ runs: Run[]; total: number; page: number; pages: number }>('/runs', { params })).data,
    placeholderData: (prev) => prev,
  });
