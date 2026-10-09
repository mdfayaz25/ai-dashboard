import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'aidash.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  },
);

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (!err.response) return 'Cannot reach the server. Check that the API is running.';
  }
  return err instanceof Error ? err.message : fallback;
}
