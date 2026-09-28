'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';
import { RadarSubNav } from '@/components/radar/RadarSubNav';
import { SectionCard, KV, Pill, apiJson, btnGhost, btnSecondary, Skeleton, ErrorState, EmptyState, scoreTone } from '@/components/radar/asset/ui';
import { label, fmtM, fmtAge, fmtDate } from '@/components/radar/asset/format';
import { rankPhrase } from '@/lib/radar/client/score-copy';
import type { GapGroup, LeaderboardRow, OpportunityWithAsset } from '@/lib/radar/acquirer-view';
import { CompanyCombobox, type CompanyLite } from './CompanyCombobox';

interface Acquirer {
  id: string;
  name: string;
  company_type: string | null;
  hq_country: string | null;
  modalities_active: string[] | null;
  modalities_primary: string[] | null;
  indications_active: string[] | null;
  deals_last_12mo: number | null;
  deals_last_24mo: number | null;
  acquisition_appetite: string | null;
  revenue_at_risk_2026: number | null;
  revenue_at_risk_2027: number | null;
  revenue_at_risk_total: number;
  revenue_at_risk_display: string | null;
  patent_cliffs: unknown;
  strategic_priorities: unknown;
  active_trials_count: number | null;
}
interface ViewResp {
  acquirer: Acquirer;
  opportunities: OpportunityWithAsset[];
  by_gap_type: GapGroup<OpportunityWithAsset>[];
  total_opportunities: number;
  excluded_opportunities: number;
  generated_at: string | null;
  summary: { gap_types: number; top_opportunity: OpportunityWithAsset | null; avg_score: number };
}

function listOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : typeof x === 'object' && x && 'name' in x ? String((x as { name: unknown }).name) : JSON.stringify(x)));
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}

function Leaderboard({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setRows((await apiJson<{ acquirers: LeaderboardRow[] }>('/api/radar/acquirer-view?top=25')).acquirers); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!rows) return <Skeleton lines={6} />;
  if (rows.length === 0) return <EmptyState title="No acquirer opportunities yet" detail="The deal creator runs after each scoring wave." />;
  return (
    <ol className="divide-y divide-neutral-100 dark:divide-neutral-800/70" aria-label="Acquirers with the most open opportunities">
      {rows.map((r, i) => (
        <li key={r.company_id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <button type="button" onClick={() => onPick(r.company_id)} className="min-w-0 truncate text-left font-medium text-neutral-900 hover:underline dark:text-neutral-100">
            <span className="mr-2 font-mono text-xs tabular-nums text-neutral-400">{i + 1}</span>{r.name}
          </button>
          <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-300">{r.opportunities} · avg {r.avg_score}</span>
        </li>
      ))}
    </ol>
  );
}

function OpportunityTable({ rows }: { rows: OpportunityWithAsset[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full min-w-[960px] text-xs">
        <caption className="sr-only">Recommended assets</caption>
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
            <th scope="col" className="px-3 py-2">Asset</th>
            <th scope="col" className="px-3 py-2">Profile</th>
            <th scope="col" className="px-3 py-2 text-right">Intent</th>
            <th scope="col" className="px-3 py-2 text-right">Fit</th>
            <th scope="col" className="px-3 py-2 text-right">Upfront (mid)</th>
            <th scope="col" className="px-3 py-2 text-right">Total (mid)</th>
            <th scope="col" className="px-3 py-2">Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(o => {
            const a = o.asset;
            const score = Math.round(Number(a?.licensing_intent_score ?? 0));
            const pct = a?.score_pct_peer != null ? Math.round(Number(a.score_pct_peer)) : null;
            const tone = scoreTone(score);
            return (
              <tr key={o.id} className="border-b border-neutral-100 align-top dark:border-neutral-800/70">
                <td className="px-3 py-2">
                  <Link href={`/radar/${o.asset_id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">{a?.asset_name ?? o.asset_name}</Link>
                  <span className="block text-neutral-500 dark:text-neutral-400">{a?.company_name ?? o.asset_company_name}{a?.originator_country ? ` · ${label(a.originator_country)}` : ''}</span>
                </td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">
                  {a ? `${label(a.phase)} · ${label(a.modality)} · ${label(a.therapeutic_area)}` : '—'}
                  {a?.indication_specific && <span className="block max-w-[16rem] truncate text-neutral-500 dark:text-neutral-400" title={a.indication_specific}>{a.indication_specific}</span>}
                  {a?.partnership_status && <span className="block"><Pill tone={a.partnership_status === 'unpartnered' ? 'emerald' : 'amber'}>{label(a.partnership_status)}</Pill></span>}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
                  <span className="text-sm">{score}</span>
                  {pct != null && <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">{rankPhrase(pct)} of peers</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{Math.round(Number(o.opportunity_score))}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{o.predicted_upfront_mid != null ? fmtM(o.predicted_upfront_mid) : '—'}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                  {o.predicted_total_mid != null ? fmtM(o.predicted_total_mid) : '—'}
                  {o.comp_count ? <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">{o.comp_count} comps</span> : null}
                </td>
                <td className="max-w-[22rem] px-3 py-2 text-neutral-600 dark:text-neutral-300">{o.gap_detail || o.rationale?.split('. ')[0] || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * /radar/acquirers — "I am <company>: which programs should I be looking
 * at?" Pro-only. `?company_id=` selects an acquirer; without one, a
 * leaderboard of acquirers with the most open opportunities, and a prompt
 * to start from the company on the viewer's profile.
 */
export function AcquirersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user } = useAuth();
  const companyId = params.get('company_id');
  const companyName = params.get('company');

  const [picked, setPicked] = useState<CompanyLite | null>(null);
  const [data, setData] = useState<ViewResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gap, setGap] = useState<string | 'all'>('all');

  const go = useCallback((next: { company_id?: string; company?: string } | null) => {
    const p = new URLSearchParams();
    if (next?.company_id) p.set('company_id', next.company_id);
    else if (next?.company) p.set('company', next.company);
    router.push(p.toString() ? `${pathname}?${p}` : pathname);
  }, [router, pathname]);

  const load = useCallback(async () => {
    if (!companyId && !companyName) { setData(null); return; }
    setLoading(true); setError(null); setGap('all');
    try {
      const qs = companyId ? `company_id=${companyId}` : `company=${encodeURIComponent(companyName!)}`;
      const d = await apiJson<ViewResp>(`/api/radar/acquirer-view?${qs}`);
      setData(d);
      setPicked({ id: d.acquirer.id, name: d.acquirer.name, company_type: d.acquirer.company_type, hq_country: d.acquirer.hq_country, deals_last_12mo: d.acquirer.deals_last_12mo });
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load acquirer view'); setData(null); }
    finally { setLoading(false); }
  }, [companyId, companyName]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    if (gap === 'all') return data.opportunities;
    return data.by_gap_type.find(g => g.gap_type === gap)?.opportunities ?? [];
  }, [data, gap]);

  const acq = data?.acquirer ?? null;
  const priorities = listOf(acq?.strategic_priorities);
  const cliffs = listOf(acq?.patent_cliffs);

  return (
    <RadarPageFrame>
      <main className="min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <RadarSubNav current="acquirers" />
          <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">Acquirer view</h1>
              <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
                Pick a buyer and see the programs that fit its gaps: patent cliffs, thin therapeutic areas, missing modalities, pipeline stage. Predicted terms come from the comps behind each asset.
              </p>
            </div>
            <div className="w-full sm:w-80">
              <CompanyCombobox value={picked} onChange={c => { setPicked(c); if (c) go({ company_id: c.id }); }} />
            </div>
          </header>

          {!companyId && !companyName ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SectionCard title="Most open opportunities" meta="Acquirers ranked by proposed deals">
                <Leaderboard onPick={id => go({ company_id: id })} />
              </SectionCard>
              <SectionCard title="Start from your company">
                {user?.company ? (
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    <p>Your profile lists <span className="font-medium text-neutral-900 dark:text-neutral-100">{user.company}</span>.</p>
                    <button type="button" onClick={() => go({ company: user.company! })} className={`${btnSecondary} mt-3`}>View as {user.company}</button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Search for a company above, or add your company to your profile to start here every time.</p>
                )}
              </SectionCard>
            </div>
          ) : loading ? (
            <div className="mt-5"><Skeleton lines={8} /></div>
          ) : error ? (
            <div className="mt-5"><ErrorState message={error} onRetry={load} /></div>
          ) : data && acq ? (
            <>
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
                <SectionCard title={acq.name} meta={acq.company_type ? label(acq.company_type) : undefined}>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <KV label="Deals, 12 / 24 mo" mono>{acq.deals_last_12mo ?? 0} / {acq.deals_last_24mo ?? 0}</KV>
                    <KV label="Active trials" mono>{acq.active_trials_count ?? '—'}</KV>
                    <KV label="Revenue at risk 2026-27" mono>{acq.revenue_at_risk_display ?? '—'}</KV>
                    <KV label="Acquisition appetite">{acq.acquisition_appetite ? label(acq.acquisition_appetite) : '—'}</KV>
                    {acq.hq_country && <KV label="HQ">{label(acq.hq_country)}</KV>}
                    {(acq.modalities_primary?.length || acq.modalities_active?.length) ? (
                      <KV label="Modalities">{(acq.modalities_primary?.length ? acq.modalities_primary : acq.modalities_active ?? []).slice(0, 6).map(label).join(', ')}</KV>
                    ) : null}
                  </dl>
                  {cliffs.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Patent cliffs</h3>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-neutral-700 dark:text-neutral-300">{cliffs.slice(0, 6).map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                  {priorities.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Stated priorities</h3>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-neutral-700 dark:text-neutral-300">{priorities.slice(0, 6).map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  )}
                  <p className="mt-4 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {data.total_opportunities} programs across {data.summary.gap_types} gap types · generated {data.generated_at ? fmtAge(data.generated_at) : '—'}
                    {data.excluded_opportunities > 0 ? ` · ${data.excluded_opportunities} older suggestions hidden (approved, comparator or partnered)` : ''}
                  </p>
                </SectionCard>

                <SectionCard title="Gaps" meta={`${data.total_opportunities} recommended programs`}>
                  {data.by_gap_type.length === 0 ? (
                    <EmptyState title="No open gaps with matching programs" detail="The deal creator proposes assets for gaps it can see in the acquirer's portfolio; none survive today's exclusions for this company." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setGap('all')} aria-pressed={gap === 'all'} className={`${btnGhost} border ${gap === 'all' ? 'border-neutral-900 dark:border-neutral-100' : 'border-neutral-200 dark:border-neutral-800'}`}>All · {data.total_opportunities}</button>
                      {data.by_gap_type.map(g => (
                        <button key={g.gap_type} type="button" onClick={() => setGap(g.gap_type)} aria-pressed={gap === g.gap_type} className={`${btnGhost} border ${gap === g.gap_type ? 'border-neutral-900 dark:border-neutral-100' : 'border-neutral-200 dark:border-neutral-800'}`}>
                          {g.label} · {g.count}
                        </button>
                      ))}
                    </div>
                  )}
                  {data.summary.top_opportunity?.asset && (
                    <p className="mt-4 text-xs text-neutral-600 dark:text-neutral-400">
                      Strongest fit: <Link href={`/radar/${data.summary.top_opportunity.asset_id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">{data.summary.top_opportunity.asset.asset_name}</Link>
                      {' '}({data.summary.top_opportunity.asset.company_name}) · fit {Math.round(Number(data.summary.top_opportunity.opportunity_score))}
                      {data.summary.top_opportunity.generated_at ? ` · ${fmtDate(data.summary.top_opportunity.generated_at)}` : ''}
                    </p>
                  )}
                </SectionCard>
              </div>

              <div className="mt-5">
                {rows.length === 0 ? <EmptyState title="Nothing in this gap" /> : <OpportunityTable rows={rows} />}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </RadarPageFrame>
  );
}
