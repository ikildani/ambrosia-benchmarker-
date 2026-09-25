/**
 * Tiny in-memory LRU with TTL for resolve responses. Per-process (each
 * serverless instance keeps its own); good enough to absorb repeated
 * lookups from Terrain / Augur within a burst. Keys are the canonical JSON of
 * one resolve item, so identical queries share an entry regardless of the
 * batch they arrived in.
 */

export interface LruOptions {
  max: number;
  ttlMs: number;
}

export class TtlLru<V> {
  private readonly map = new Map<string, { value: V; expires: number }>();
  constructor(private readonly opts: LruOptions) {}

  get(key: string, now = Date.now()): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= now) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: now + this.opts.ttlMs });
    while (this.map.size > this.opts.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Stable JSON: sorted keys, undefined dropped, strings trimmed. */
export function canonicalKey(input: unknown): string {
  return JSON.stringify(sortKeys(input));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val === undefined) continue;
      out[k] = sortKeys(val);
    }
    return out;
  }
  if (typeof v === 'string') return v.trim();
  return v;
}

export const RESOLVE_CACHE_TTL_MS = 10 * 60 * 1000;
export const RESOLVE_CACHE_MAX = 5000;
