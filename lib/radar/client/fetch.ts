/**
 * Fetch helper for the Radar client: JSON parsing, typed errors, request
 * de-duplication, a small in-memory GET cache, and AbortController plumbing.
 * Browser-only (module state lives for the tab's lifetime).
 */

export class RadarApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'RadarApiError';
    this.status = status;
  }
}

interface CacheEntry {
  expires: number;
  value: unknown;
}

const CACHE_MAX = 60;
const DEFAULT_TTL_MS = 60 * 1000;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown, ttl: number): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + ttl, value });
}

/** Drops every cached GET whose URL starts with `prefix` (e.g. after a mandate write). */
export function invalidateRadarCache(prefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === 'AbortError' : (err as { name?: string } | null)?.name === 'AbortError';
}

async function parseError(res: Response): Promise<RadarApiError> {
  let message = res.statusText || `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // body was not JSON
  }
  return new RadarApiError(res.status, message);
}

export interface RadarFetchOptions {
  signal?: AbortSignal;
  /** Cache GET responses for this long; 0 disables. Default 60 s. */
  ttlMs?: number;
}

/** GET with cache + in-flight de-duplication. Rejects with RadarApiError or the AbortError. */
export async function radarGet<T>(url: string, opts: RadarFetchOptions = {}): Promise<T> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  if (ttl > 0) {
    const cached = cacheGet<T>(url);
    if (cached !== undefined) return cached;
  }

  const existing = inflight.get(url);
  if (existing) {
    // Share the network call, but let this caller's abort stop *its* wait.
    return abortable(existing as Promise<T>, opts.signal);
  }

  const p = (async () => {
    const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!res.ok) throw await parseError(res);
    const json = (await res.json()) as T;
    if (ttl > 0) cacheSet(url, json, ttl);
    return json;
  })();

  inflight.set(url, p);
  p.finally(() => inflight.delete(url)).catch(() => undefined);
  return abortable(p, opts.signal);
}

/** Non-GET request; never cached. */
export async function radarSend<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  opts: RadarFetchOptions = {},
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      v => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      e => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
