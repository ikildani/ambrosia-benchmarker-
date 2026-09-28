'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/20/solid';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarSubNav } from '@/components/radar/RadarSubNav';
import { apiJson, btnGhost, btnSecondary, Pill, Skeleton, ErrorState, EmptyState, scoreTone } from '@/components/radar/asset/ui';
import { label, fmtAge } from '@/components/radar/asset/format';
import { radarLabel } from '@/lib/radar/vocab';
import { mandateSummary } from '@/lib/radar/client/mandate';
import { rankPhrase } from '@/lib/radar/client/score-copy';
import type { RadarMandate } from '@/lib/radar/client/api-types';

interface MatchAsset {
  id: string;
  company_name: string;
  asset_name: string;
  modality: string | null;
  therapeutic_area: string | null;
  indication_specific: string | null;
  phase: string | null;
  partnership_status: string | null;
  ownership_status: string | null;
  licensing_intent_score: number | string | null;
  score_pct_peer: number | string | null;
  deal_readiness_score: number | string | null;
  competitive_heat: number | string | null;
  confidence_score: number | string | null;
  originator_country: string | null;
}
export interface MandateMatch {
  id: string;
  match_score: number | string | null;
  match_reasons: string[] | null;
  is_read: boolean;
  is_saved: boolean;
  is_dismissed: boolean;
  is_stale: boolean | null;
  stale_reason: string | null;
  matched_at: string;
  clinical_assets: MatchAsset | MatchAsset[] | null;
}
interface Resp { mandate: RadarMandate; matches: MandateMatch[] }

type Tab = 'new' | 'all' | 'saved';

function assetOf(m: MandateMatch): MatchAsset | null {
  return Array.isArray(m.clinical_assets) ? m.clinical_assets[0] ?? null : m.clinical_assets;
}

/** Tab membership: new = unread and live; saved = flagged; all = every live match plus saved stale ones. */
export function matchInTab(m: Pick<MandateMatch, 'is_read' | 'is_saved' | 'is_stale'>, tab: Tab): boolean {
  if (tab === 'saved') return m.is_saved;
  if (tab === 'new') return !m.is_read && !m.is_stale;
  return !m.is_stale || m.is_saved;
}

/**
 * /radar/mandates/[id] — every asset that matched one mandate, newest first,
 * with save / dismiss. Opening the page marks the visible matches read, which
 * is what clears the "N new" badge on the mandate switcher.
 */
export function MandateMatchesPage({ mandateId }: { mandateId: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('new');
  const [justRead, setJustRead] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await apiJson<Resp>(`/api/radar/mandates/${mandateId}`);
      setData(d);
      const unread = d.matches.filter(m => !m.is_read).map(m => m.id);
      if (unread.length > 0) {
        setJustRead(new Set(unread));
        void apiJson(`/api/radar/mandates/${mandateId}/matches`, { method: 'PATCH', body: JSON.stringify({ ids: unread.slice(0, 200), is_read: true }) }).catch(() => undefined);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load matches'); } finally { setLoading(false); }
  }, [mandateId]);
  useEffect(() => { void load(); }, [load]);

  const patch = async (m: MandateMatch, fields: { is_saved?: boolean; is_dismissed?: boolean }) => {
    try {
      await apiJson(`/api/radar/mandates/${mandateId}/matches`, { method: 'PATCH', body: JSON.stringify({ ids: [m.id], ...fields }) });
      setData(d => d ? { ...d, matches: fields.is_dismissed ? d.matches.filter(x => x.id !== m.id) : d.matches.map(x => x.id === m.id ? { ...x, ...fields } : x) } : d);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  };

  const counts = useMemo(() => {
    const ms = data?.matches ?? [];
    // "new" keeps the rows that were unread when the page opened, so the tab does not empty itself on mark-read.
    const isNew = (m: MandateMatch) => (justRead.has(m.id) || !m.is_read) && !m.is_stale;
    return { new: ms.filter(isNew).length, all: ms.filter(m => matchInTab(m, 'all')).length, saved: ms.filter(m => m.is_saved).length, isNew };
  }, [data, justRead]);
  const rows = useMemo(() => {
    const ms = data?.matches ?? [];
    return tab === 'new' ? ms.filter(counts.isNew) : ms.filter(m => matchInTab(m, tab));
  }, [data, tab, counts]);

  const mandate = data?.mandate ?? null;

  return (
    <RadarPageFrame>
      <main className="min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <RadarSubNav current="feed" />
          <nav aria-label="Breadcrumb" className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="/radar" className="inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100"><ChevronLeftIcon className="h-3.5 w-3.5" aria-hidden="true" /> Search & Evaluation</Link>
            <span className="mx-1.5" aria-hidden="true">/</span>
            <span className="text-neutral-700 dark:text-neutral-300">{mandate?.name ?? 'Mandate'}</span>
          </nav>

          {loading && !data ? <div className="mt-4"><Skeleton lines={6} /></div> : error && !data ? <div className="mt-4"><ErrorState message={error} onRetry={load} /></div> : mandate && (
            <>
              <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold tracking-tight">{mandate.name}</h1>
                  <p className="mt-1 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">{mandate.description || mandateSummary(mandate, radarLabel)}</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {mandate.match_count} matches · last matched {fmtAge(mandate.last_matched_at)} · {mandate.digest_frequency} digest{mandate.notify_email ? ' by email' : ''}{mandate.notify_in_app ? ' and in-app' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/radar?m=${mandate.id}`} className={btnSecondary}>Open in feed</Link>
                </div>
              </header>

              <div role="tablist" aria-label="Match lists" className="mt-5 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
                {(['new', 'all', 'saved'] as Tab[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium capitalize ${tab === t ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'}`}
                  >
                    {t} <span className="ml-1 font-mono tabular-nums text-neutral-500 dark:text-neutral-400">{counts[t]}</span>
                  </button>
                ))}
              </div>

              {error && <div className="mt-3"><ErrorState message={error} /></div>}
              {rows.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title={tab === 'new' ? 'No new matches' : tab === 'saved' ? 'Nothing saved yet' : 'No matches yet'}
                    detail={tab === 'all' ? 'The matcher runs after each scoring wave. Widen the mandate or lower its minimum score to see more.' : 'Matches you save stay here even after the asset drops out of the mandate.'}
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full min-w-[900px] text-xs">
                    <caption className="sr-only">Mandate matches</caption>
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                        <th scope="col" className="px-3 py-2">Asset</th>
                        <th scope="col" className="px-3 py-2">Profile</th>
                        <th scope="col" className="px-3 py-2 text-right">Score</th>
                        <th scope="col" className="px-3 py-2 text-right">Fit</th>
                        <th scope="col" className="px-3 py-2">Why it matched</th>
                        <th scope="col" className="px-3 py-2">Matched</th>
                        <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(m => {
                        const a = assetOf(m);
                        const score = Math.round(Number(a?.licensing_intent_score ?? 0));
                        const pct = a?.score_pct_peer != null ? Math.round(Number(a.score_pct_peer)) : null;
                        const tone = scoreTone(score);
                        const isNew = counts.isNew(m);
                        return (
                          <tr key={m.id} className={`border-b border-neutral-100 dark:border-neutral-800/70 ${m.is_stale ? 'opacity-60' : ''}`}>
                            <td className="px-3 py-2">
                              {a ? <Link href={`/radar/${a.id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">{a.asset_name}</Link> : <span className="text-neutral-500">Asset removed</span>}
                              {isNew && <span className="ml-1.5 rounded-full bg-teal-600 px-1.5 text-[10px] font-semibold text-white">new</span>}
                              {m.is_stale && <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200" title={m.stale_reason ?? undefined}>no longer matches</span>}
                              {a && <span className="block text-neutral-500 dark:text-neutral-400">{a.company_name}{a.originator_country ? ` · ${label(a.originator_country)}` : ''}</span>}
                            </td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">
                              {a ? `${label(a.phase)} · ${label(a.modality)} · ${label(a.therapeutic_area)}` : '—'}
                              {a?.indication_specific && <span className="block truncate text-neutral-500 dark:text-neutral-400" title={a.indication_specific}>{a.indication_specific}</span>}
                              {a?.partnership_status && <span className="block"><Pill tone={a.partnership_status === 'unpartnered' ? 'emerald' : 'amber'}>{label(a.partnership_status)}</Pill></span>}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono tabular-nums ${tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                              <span className="text-sm">{score}</span>
                              {pct != null && <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">{rankPhrase(pct)} of peers</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{m.match_score != null ? Math.round(Number(m.match_score)) : '—'}</td>
                            <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{(m.match_reasons ?? []).slice(0, 3).join(' · ') || '—'}</td>
                            <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">{fmtAge(m.matched_at)}</td>
                            <td className="px-3 py-2 text-right">
                              <span className="flex justify-end gap-1">
                                <button type="button" onClick={() => patch(m, { is_saved: !m.is_saved })} className={btnGhost} aria-pressed={m.is_saved}>{m.is_saved ? 'Saved' : 'Save'}</button>
                                <button type="button" onClick={() => patch(m, { is_dismissed: true })} className={btnGhost}>Dismiss</button>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </RadarPageFrame>
  );
}
