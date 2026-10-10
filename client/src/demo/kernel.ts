/**
 * In-browser demo backend.
 *
 * The production app talks to the Express API. For the static GitHub Pages demo there is no server,
 * so this module answers the same REST calls inside the browser: an axios adapter routes each request
 * to a handler in ./server.ts, and data lives in localStorage, seeded from ./seed.json.
 */
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export type DemoRequest<B = any> = {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: B;
  userId: string | null;
};
type Handler = (req: DemoRequest) => unknown | Promise<unknown>;
type Route = { method: string; re: RegExp; keys: string[]; handler: Handler; auth: boolean };

/** Marks a handler result with an HTTP status other than 200. */
export const withStatus = <T>(status: number, data: T) => ({ __status: status, data });

export function createRouter() {
  const routes: Route[] = [];
  const add = (method: string, pattern: string, handler: Handler, auth = true) => {
    const keys: string[] = [];
    const re = new RegExp(`^${pattern.replace(/\/:(\w+)/g, (_m, k: string) => { keys.push(k); return '/([^/]+)'; })}/?$`);
    routes.push({ method, re, keys, handler, auth });
  };
  const api = {
    get: (p: string, h: Handler, auth?: boolean) => (add('GET', p, h, auth), api),
    post: (p: string, h: Handler, auth?: boolean) => (add('POST', p, h, auth), api),
    patch: (p: string, h: Handler, auth?: boolean) => (add('PATCH', p, h, auth), api),
    put: (p: string, h: Handler, auth?: boolean) => (add('PUT', p, h, auth), api),
    delete: (p: string, h: Handler, auth?: boolean) => (add('DELETE', p, h, auth), api),
    async handle(method: string, path: string, query: Record<string, string>, body: unknown, userId: string | null) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        if (r.auth && !userId) fail(401, 'Please sign in to continue');
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        return r.handler({ method, path, params, query, body, userId });
      }
      return fail(404, `Route ${method} ${path} not found`);
    },
  };
  return api;
}

export type Router = ReturnType<typeof createRouter>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Axios adapter that serves requests from the demo router with a small, realistic delay. */
export function createAdapter(router: Router, tokenToUser: (token: string | null) => string | null): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const full = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const url = new URL(full, 'http://demo.local');
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const query: Record<string, string> = Object.fromEntries(url.searchParams.entries());
    for (const [k, v] of Object.entries((config.params ?? {}) as Record<string, unknown>)) if (v !== undefined && v !== null && v !== '') query[k] = String(v);
    let body: unknown = config.data;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* keep string */ } }
    const auth = String(config.headers?.Authorization ?? '');
    const userId = tokenToUser(auth.startsWith('Bearer ') ? auth.slice(7) : null);
    await sleep(90 + Math.random() * 160);
    try {
      const out = (await router.handle((config.method ?? 'get').toUpperCase(), path, query, body, userId)) as { __status?: number; data?: unknown } | unknown;
      const isWrapped = typeof out === 'object' && out !== null && '__status' in (out as object);
      const status = isWrapped ? (out as { __status: number }).__status : out === undefined ? 204 : 200;
      const data = isWrapped ? (out as { data: unknown }).data : out ?? '';
      return { data: JSON.parse(JSON.stringify(data ?? '')), status, statusText: 'OK', headers: {}, config, request: {} };
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof Error ? e.message : 'Something went wrong';
      if (!(e instanceof HttpError)) console.error('[demo]', e);
      const response = { data: { message }, status, statusText: message, headers: {}, config, request: {} };
      throw new AxiosError(message, String(status), config, {}, response as never);
    }
  };
}

// ---------- storage ----------

export const newId = () => {
  const t = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  let r = '';
  for (let i = 0; i < 16; i++) r += Math.floor(Math.random() * 16).toString(16);
  return t + r;
};
export const now = () => new Date().toISOString();

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Moves every timestamp in the seed forward so "2 hours ago" stays true whenever the demo is opened. */
function shiftDates<T>(value: T, delta: number): T {
  if (typeof value === 'string' && ISO.test(value)) return new Date(new Date(value).getTime() + delta).toISOString() as T;
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, delta)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, delta)])) as T;
  return value;
}

export function createStore<T extends Record<string, any[]>>(key: string, seed: { exportedAt: string; data: T }) {
  const fresh = () => shiftDates(structuredClone(seed.data), Date.now() - new Date(seed.exportedAt).getTime());
  let db: T;
  try {
    const raw = localStorage.getItem(key);
    db = raw ? JSON.parse(raw) : fresh();
  } catch {
    db = fresh();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(db)); } catch { /* storage full: keep working in memory */ }
    }, 50);
  };
  return {
    get db() { return db; },
    save,
    reset() {
      db = fresh();
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      save();
    },
  };
}

// ---------- realtime ----------

type Listener = (payload: any) => void;

/** Minimal stand-in for a socket.io client: the demo server pushes events through it. */
export function createFakeSocket(onClientEmit: (event: string, payload: any) => void) {
  const listeners = new Map<string, Set<Listener>>();
  const sticky = new Map<string, any>();
  const send = (fn: Listener, payload: any) => setTimeout(() => fn(JSON.parse(JSON.stringify(payload))), 30);
  const socket = {
    connected: true,
    on(event: string, fn: Listener) {
      (listeners.get(event) ?? listeners.set(event, new Set()).get(event)!).add(fn);
      if (sticky.has(event)) send(fn, sticky.get(event));
      return socket;
    },
    off(event: string, fn: Listener) { listeners.get(event)?.delete(fn); return socket; },
    emit(event: string, payload?: any) { setTimeout(() => onClientEmit(event, payload), 0); return socket; },
    disconnect() { /* nothing to close */ },
    /** Server → client delivery. Sticky events are also replayed to listeners that subscribe later. */
    deliver(event: string, payload: any, opts?: { sticky?: boolean }) {
      if (opts?.sticky) sticky.set(event, payload);
      listeners.get(event)?.forEach((fn) => send(fn, payload));
    },
  };
  return socket;
}
