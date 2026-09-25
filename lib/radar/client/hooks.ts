'use client';

/**
 * Data hooks for the Radar feed. Each hook owns one AbortController per
 * in-flight request, cancels it when its inputs change or the component
 * unmounts, and never reports a stale response.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { radarGet, radarSend, invalidateRadarCache, isAbortError, RadarApiError } from './fetch';
import {
  buildFeedQuery,
  filtersFingerprint,
  FEED_PAGE_SIZE,
  type RadarFilterState,
  type RadarUiState,
} from './filter-schema';
import type {
  FeedResponse,
  FeedCountResponse,
  FacetsResponse,
  MandatesResponse,
  RadarMandate,
  SearchSuggestResponse,
  SearchSuggestion,
  SearchParseResponse,
  CompareResponse,
  CompareAsset,
} from './api-types';
import type { MandateFields } from './mandate';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

function messageOf(err: unknown): string {
  if (err instanceof RadarApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

/** Generic GET-with-abort hook. `url` null = idle. */
function useAbortableGet<T>(url: string | null, opts: { ttlMs?: number; keepPrevious?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>(url ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const { ttlMs, keepPrevious } = opts;

  useEffect(() => {
    if (!url) {
      setStatus('idle');
      setData(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    if (!keepPrevious) setData(null);
    radarGet<T>(url, { signal: controller.signal, ttlMs })
      .then(res => {
        if (controller.signal.aborted) return;
        setData(res);
        setStatus('ready');
      })
      .catch(err => {
        if (controller.signal.aborted || isAbortError(err)) return;
        setError(messageOf(err));
        setStatus('error');
      });
    return () => controller.abort();
  }, [url, nonce, ttlMs, keepPrevious]);

  const retry = useCallback(() => {
    if (url) invalidateRadarCache(url);
    setNonce(n => n + 1);
  }, [url]);

  return { data, status, error, retry };
}

// ── Feed ──────────────────────────────────────────────────────────────────

export function useFeed(filters: RadarFilterState, ui: Pick<RadarUiState, 'sort' | 'dir' | 'after'>, enabled = true) {
  const url = useMemo(() => {
    if (!enabled) return null;
    const qs = buildFeedQuery(filters, { sort: ui.sort, dir: ui.dir, after: ui.after, limit: FEED_PAGE_SIZE });
    return `/api/radar/feed?${qs.toString()}`;
  }, [filters, ui.sort, ui.dir, ui.after, enabled]);

  const { data, status, error, retry } = useAbortableGet<FeedResponse>(url, { keepPrevious: true });

  // The estimate only comes back on the first page; keep it while paging.
  const totalRef = useRef<number | null>(null);
  const fingerprint = `${filtersFingerprint(filters)}|${ui.sort}|${ui.dir}`;
  const lastFingerprint = useRef(fingerprint);
  if (lastFingerprint.current !== fingerprint) {
    lastFingerprint.current = fingerprint;
    totalRef.current = null;
  }
  if (data?.estimated_total !== null && data?.estimated_total !== undefined) totalRef.current = data.estimated_total;

  return {
    rows: data?.rows ?? [],
    nextCursor: data?.next_cursor ?? null,
    estimatedTotal: totalRef.current,
    status,
    error,
    retry,
  };
}

/** Debounced count-only feed call for the live match counter on the mandate form. */
export function useMatchCount(filters: RadarFilterState, enabled: boolean, debounceMs = 350) {
  const [url, setUrl] = useState<string | null>(null);
  const target = useMemo(
    () => (enabled ? `/api/radar/feed?${buildFeedQuery(filters, { countOnly: true }).toString()}` : null),
    [filters, enabled],
  );
  useEffect(() => {
    if (!target) {
      setUrl(null);
      return;
    }
    const t = window.setTimeout(() => setUrl(target), debounceMs);
    return () => window.clearTimeout(t);
  }, [target, debounceMs]);

  const { data, status, error } = useAbortableGet<FeedCountResponse>(url, { keepPrevious: true, ttlMs: 5 * 60 * 1000 });
  return { count: data?.estimated_total ?? null, status: target && !url ? 'loading' : status, error };
}

// ── Facets ────────────────────────────────────────────────────────────────

export function useFacets(filters: RadarFilterState, enabled = true) {
  const url = useMemo(
    () => (enabled ? `/api/radar/facets?${buildFeedQuery(filters).toString()}` : null),
    [filters, enabled],
  );
  const { data, status, error, retry } = useAbortableGet<FacetsResponse>(url, { keepPrevious: true, ttlMs: 5 * 60 * 1000 });
  return { facets: data?.facets ?? null, total: data?.total ?? null, status, error, retry };
}

// ── Mandates ──────────────────────────────────────────────────────────────

const MANDATES_URL = '/api/radar/mandates';

export function useMandates(enabled = true) {
  const [nonce, setNonce] = useState(0);
  const url = enabled ? `${MANDATES_URL}?v=${nonce}` : null;
  const { data, status, error } = useAbortableGet<MandatesResponse>(url, { keepPrevious: true, ttlMs: 0 });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    invalidateRadarCache(MANDATES_URL);
    setNonce(n => n + 1);
  }, []);

  const create = useCallback(
    async (fields: MandateFields): Promise<RadarMandate> => {
      setSaving(true);
      try {
        const res = await radarSend<{ mandate: RadarMandate }>(MANDATES_URL, 'POST', fields);
        refresh();
        return res.mandate;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, fields: Partial<MandateFields>): Promise<RadarMandate> => {
      setSaving(true);
      try {
        const res = await radarSend<{ mandate: RadarMandate }>(`${MANDATES_URL}/${id}`, 'PATCH', fields);
        refresh();
        return res.mandate;
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      setSaving(true);
      try {
        await radarSend<unknown>(`${MANDATES_URL}/${id}`, 'DELETE');
        refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh],
  );

  return { mandates: data?.mandates ?? null, status, error, saving, refresh, create, update, remove };
}

// ── Search ────────────────────────────────────────────────────────────────

/** How long typeahead stays quiet after a 429 before it tries again. */
const TYPEAHEAD_PAUSE_MS = 20_000;

export function useTypeahead(q: string, debounceMs = 150) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  /** Set while the server has rate-limited us; the search box says so instead of going silently empty. */
  const [paused, setPaused] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    controllerRef.current?.abort();
    const term = q.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (Date.now() < pausedUntilRef.current) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    const t = window.setTimeout(() => {
      radarGet<SearchSuggestResponse>(`/api/radar/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(res => {
          if (controller.signal.aborted) return;
          setSuggestions(res.suggestions);
          setLoading(false);
          setPaused(false);
        })
        .catch(err => {
          if (controller.signal.aborted || isAbortError(err)) return;
          setSuggestions([]);
          setLoading(false);
          if (err instanceof RadarApiError && err.status === 429) {
            pausedUntilRef.current = Date.now() + TYPEAHEAD_PAUSE_MS;
            setPaused(true);
            window.setTimeout(() => setPaused(false), TYPEAHEAD_PAUSE_MS);
          }
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [q, debounceMs]);

  return { suggestions, loading, paused };
}

export function useNaturalSearch() {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const parse = useCallback(async (query: string): Promise<SearchParseResponse | null> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setParsing(true);
    setError(null);
    try {
      return await radarSend<SearchParseResponse>('/api/radar/search', 'POST', { query }, { signal: controller.signal });
    } catch (err) {
      if (isAbortError(err)) return null;
      setError(messageOf(err));
      return null;
    } finally {
      if (controllerRef.current === controller) setParsing(false);
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { parse, parsing, error };
}

// ── Compare ───────────────────────────────────────────────────────────────

export function useCompare(ids: string[]) {
  const url = ids.length >= 2 ? `/api/radar/compare?ids=${ids.join(',')}` : null;
  const { data, status, error, retry } = useAbortableGet<CompareResponse>(url, { keepPrevious: true });
  const assets: CompareAsset[] = data?.assets ?? [];
  return { assets, status, error, retry };
}

// ── Utilities ─────────────────────────────────────────────────────────────

/** True when the OS asks for reduced motion; false during SSR. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Tailwind `lg` breakpoint; false during SSR so mobile markup renders first. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return desktop;
}
