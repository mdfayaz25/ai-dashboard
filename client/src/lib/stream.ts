import { tokenStore } from './api';
import type { ProviderId, Run } from '@/types';

export type RunRequest = { provider: ProviderId; model: string; system?: string; prompt: string; temperature: number; maxTokens: number; promptId?: string };
type Handlers = { onMeta?: (m: { startedAt: string }) => void; onDelta: (text: string) => void; onDone: (run: Run) => void; onError: (message: string) => void };

/** POSTs a run and reads the Server-Sent Events stream with fetch, so the auth header can be sent. */
export async function streamRun(body: RunRequest, h: Handlers, signal: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStore.get()}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') h.onError('Cannot reach the server. Check that the API is running.');
    return;
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return h.onError(data.message ?? `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const raw = /^data: (.+)$/m.exec(block)?.[1];
        if (!event || !raw) continue;
        const data = JSON.parse(raw);
        if (event === 'meta') h.onMeta?.(data);
        else if (event === 'delta') h.onDelta(data.text);
        else if (event === 'done') h.onDone(data.run);
        else if (event === 'error') h.onError(data.message);
      }
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') h.onError('The stream was interrupted');
  }
}
