'use client';

import { useEffect, useState, useCallback } from 'react';

interface AssetDetail {
  asset: Record<string, unknown>;
  linkedDeals: Record<string, unknown>[];
  comparableDeals: Record<string, unknown>[];
  trials: Record<string, unknown>[];
  thesis: Record<string, unknown> | null;
}

interface SignalData {
  asset: Record<string, unknown>;
  signals_by_type: Record<string, Record<string, unknown>[]>;
  trend: Record<string, unknown>[];
  current_trend: string;
  score_delta_7d: number;
  score_delta_30d: number;
}

interface IntelData {
  asset: Record<string, unknown>;
  intel: Record<string, unknown>[];
  by_type: Record<string, Record<string, unknown>[]>;
  competitors: { name: string; type: string; intensity: number }[];
}

interface OpportunityData {
  asset: Record<string, unknown>;
  proposed_acquirers: Record<string, unknown>[];
}

type Tab = 'overview' | 'signals' | 'competition' | 'acquirers';

interface Props {
  assetId: string | null;
  onClose: () => void;
}

function formatCurrency(val: unknown): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${n.toFixed(0)}M`;
}

function formatDate(d: unknown): string {
  if (!d || typeof d !== 'string') return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatLabel(raw: string): string {
  const LABELS: Record<string, string> = {
    phase_1: 'Phase 1', phase_2: 'Phase 2', phase_3: 'Phase 3', phase_4: 'Phase 4',
    phase1: 'Phase 1', phase2: 'Phase 2', phase3: 'Phase 3', phase4: 'Phase 4',
    early_phase1: 'Early Phase 1', phase_1_2: 'Phase 1/2', phase_2_3: 'Phase 2/3',
    phase1_phase2: 'Phase 1/2', phase2_phase3: 'Phase 2/3',
    small_molecule: 'Small Molecule', car_t: 'CAR-T', gene_therapy: 'Gene Therapy',
    cell_therapy: 'Cell Therapy', adc: 'ADC', mrna: 'mRNA',
    oligonucleotide: 'Oligonucleotide', radiopharm: 'Radiopharmaceutical',
    oncology: 'Oncology', neurology: 'Neurology', immunology: 'Immunology',
    cardiovascular: 'Cardiovascular', metabolic: 'Metabolic', hematology: 'Hematology',
    rare_disease: 'Rare Disease', infectious_disease: 'Infectious Disease',
    ophthalmology: 'Ophthalmology', dermatology: 'Dermatology', respiratory: 'Respiratory',
    womens_health: "Women's Health", cns: 'CNS',
  };
  return LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const SIGNAL_TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  cash_runway:           { label: 'Cash Runway',     icon: '💰', color: 'text-red-500' },
  regulatory_milestone:  { label: 'Regulatory',      icon: '📋', color: 'text-blue-500' },
  competitor_failure:    { label: 'Competitor Fail',  icon: '📉', color: 'text-orange-500' },
  management_commentary: { label: 'Mgmt Commentary', icon: '🎙️', color: 'text-purple-500' },
  strategic_review:      { label: 'Strategic Review', icon: '🔍', color: 'text-indigo-500' },
  patent_filing:         { label: 'Patent Filing',   icon: '📝', color: 'text-teal-500' },
  publication_velocity:  { label: 'Publications',    icon: '📚', color: 'text-cyan-500' },
  conference_activity:   { label: 'Conferences',     icon: '🎤', color: 'text-amber-500' },
  bd_executive_hire:     { label: 'BD Hiring',       icon: '👤', color: 'text-green-500' },
};

const INTEL_TYPE_META: Record<string, { label: string; icon: string }> = {
  user_interest:      { label: 'Platform Interest', icon: '👁️' },
  competitor_deal:    { label: 'Competitor Deals',  icon: '🤝' },
  patent_overlap:     { label: 'Patent Overlap',    icon: '📝' },
  conference_overlap: { label: 'Conference Overlap', icon: '🎤' },
  trial_crowding:     { label: 'Trial Crowding',    icon: '🔬' },
  publication_race:   { label: 'Publication Race',  icon: '📚' },
};

const TREND_CONFIG: Record<string, { label: string; color: string; arrow: string }> = {
  surging:   { label: 'Surging',   color: 'text-emerald-500', arrow: '↑↑' },
  rising:    { label: 'Rising',    color: 'text-emerald-400', arrow: '↑' },
  stable:    { label: 'Stable',    color: 'text-slate-400',   arrow: '→' },
  cooling:   { label: 'Cooling',   color: 'text-amber-400',   arrow: '↓' },
  declining: { label: 'Declining', color: 'text-red-400',     arrow: '↓↓' },
};

export function AssetDetailModal({ assetId, onClose }: Props) {
  const [data, setData] = useState<AssetDetail | null>(null);
  const [signalData, setSignalData] = useState<SignalData | null>(null);
  const [intelData, setIntelData] = useState<IntelData | null>(null);
  const [oppData, setOppData] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const fetchAll = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setTab('overview');

    try {
      const [assetRes, signalRes, intelRes, oppRes] = await Promise.all([
        fetch(`/api/radar/assets/${id}`),
        fetch(`/api/radar/signals?asset_id=${id}`),
        fetch(`/api/radar/intel?asset_id=${id}`),
        fetch(`/api/radar/opportunities?asset_id=${id}`),
      ]);

      if (!assetRes.ok) throw new Error('Failed to load asset');
      const assetJson = await assetRes.json();
      setData(assetJson);

      if (signalRes.ok) setSignalData(await signalRes.json());
      if (intelRes.ok) setIntelData(await intelRes.json());
      if (oppRes.ok) setOppData(await oppRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (assetId) fetchAll(assetId);
  }, [assetId, fetchAll]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!assetId) return null;
  const asset = data?.asset as Record<string, unknown> | undefined;
  const trend = TREND_CONFIG[signalData?.current_trend || 'stable'] || TREND_CONFIG.stable;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'signals', label: 'Signals', count: signalData ? Object.keys(signalData.signals_by_type).length : 0 },
    { key: 'competition', label: 'Competition', count: intelData?.competitors?.length || 0 },
    { key: 'acquirers', label: 'Acquirers', count: oppData?.proposed_acquirers?.length || 0 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-16 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-amber-500 animate-spin" />
          </div>
        )}

        {error && <div className="p-8 text-center"><p className="text-red-500">{error}</p></div>}

        {asset && (
          <div>
            {/* ── Header ──────────────────────────────────── */}
            <div className="p-6 pb-0 sm:p-8 sm:pb-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{String(asset.asset_name)}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {String(asset.company_name)}{asset.originator_country ? ` · ${asset.originator_country}` : ''}
                  </p>
                </div>
                {/* Trend badge */}
                {signalData && (
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${trend.color} text-xs font-semibold ${
                    trend.color.includes('emerald') ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/10' :
                    trend.color.includes('red') ? 'border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10' :
                    'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                  }`}>
                    <span>{trend.arrow}</span>
                    <span>{trend.label}</span>
                    {signalData.score_delta_7d !== 0 && (
                      <span className="text-[10px] opacity-70">({signalData.score_delta_7d > 0 ? '+' : ''}{signalData.score_delta_7d} 7d)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {asset.phase ? <Pill color="indigo">{formatLabel(String(asset.phase))}</Pill> : null}
                {asset.therapeutic_area ? <Pill color="slate">{formatLabel(String(asset.therapeutic_area))}</Pill> : null}
                {asset.modality ? <Pill color="slate">{formatLabel(String(asset.modality))}</Pill> : null}
                <Pill color={asset.partnership_status === 'unpartnered' ? 'emerald' : asset.partnership_status === 'partially_partnered' ? 'amber' : 'slate'}>
                  {asset.partnership_status === 'unpartnered' ? 'Unpartnered' : asset.partnership_status === 'partially_partnered' ? 'Partial Rights' : 'Partnered'}
                </Pill>
              </div>

              {/* Score strip */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <MiniScore label="Licensing Intent" value={asset.licensing_intent_score as number} color="amber" />
                <MiniScore label="Deal Readiness" value={asset.deal_readiness_score as number} color="teal" />
                <MiniScore label="Competitive Heat" value={asset.competitive_heat as number} color="rose" />
                <MiniScore label="Data Confidence" value={asset.confidence_score as number} color="blue" />
              </div>

              {/* Tabs */}
              <div className="flex gap-0.5 border-b border-slate-200 dark:border-slate-700">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2.5 text-xs font-semibold transition-all relative ${
                      tab === t.key
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {t.label}
                    {t.count ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{t.count}</span> : null}
                    {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tab Content ─────────────────────────────── */}
            <div className="p-6 sm:p-8 pt-5">
              {tab === 'overview' && <OverviewTab data={data!} />}
              {tab === 'signals' && <SignalsTab data={signalData} />}
              {tab === 'competition' && <CompetitionTab data={intelData} />}
              {tab === 'acquirers' && <AcquirersTab data={oppData} />}
            </div>

            {/* Meta footer */}
            <div className="px-6 sm:px-8 pb-6 flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
              <span>{(asset.nct_ids as string[])?.length || 0} NCT IDs</span>
              {asset.last_update_date ? <span>Updated {formatDate(asset.last_update_date)}</span> : null}
              {asset.last_enriched_at ? <span>Enriched {formatDate(asset.last_enriched_at)}</span> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB: OVERVIEW (L1 + L3)
// ════════════════════════════════════════════════════════════════

function OverviewTab({ data }: { data: AssetDetail }) {
  return (
    <div className="space-y-6">
      {/* Predicted Deal Terms */}
      {data.thesis && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-900/10 dark:to-slate-900 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Predicted Deal Terms</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">
              {String((data.thesis as Record<string, unknown>).comp_count)} comps
            </span>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <TermRange label="Upfront" low={(data.thesis as Record<string, unknown>).predicted_upfront_low as number | null} mid={(data.thesis as Record<string, unknown>).predicted_upfront_mid as number | null} high={(data.thesis as Record<string, unknown>).predicted_upfront_high as number | null} unit="$M" />
            <TermRange label="Total Value" low={(data.thesis as Record<string, unknown>).predicted_total_low as number | null} mid={(data.thesis as Record<string, unknown>).predicted_total_mid as number | null} high={(data.thesis as Record<string, unknown>).predicted_total_high as number | null} unit="$M" />
            <TermRange label="Royalty" low={(data.thesis as Record<string, unknown>).predicted_royalty_low as number | null} mid={(data.thesis as Record<string, unknown>).predicted_royalty_mid as number | null} high={(data.thesis as Record<string, unknown>).predicted_royalty_high as number | null} unit="%" />
          </div>
          {/* Likely acquirers */}
          {((data.thesis as Record<string, unknown>).likely_acquirers as { name: string; dealCount: number }[])?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-amber-200/30 dark:border-amber-800/20">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Most active acquirers in this space</p>
              <div className="flex flex-wrap gap-2">
                {((data.thesis as Record<string, unknown>).likely_acquirers as { name: string; dealCount: number }[]).slice(0, 6).map((acq, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                    {acq.name} <span className="text-slate-400 dark:text-slate-500">({acq.dealCount})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trials */}
      {data.trials.length > 0 && (
        <div>
          <SectionHeader title={`Clinical Trials (${data.trials.length})`} />
          <div className="space-y-2">
            {data.trials.slice(0, 8).map((trial, i) => (
              <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-700/40 p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{String(trial.trial_title)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {String(trial.nct_id)} · {String(trial.phase || '—')} · {String(trial.status || '—')}
                    {trial.enrollment_count ? ` · ${(trial.enrollment_count as number).toLocaleString()} enrolled` : ''}
                  </p>
                </div>
                <a href={`https://clinicaltrials.gov/study/${trial.nct_id}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold" onClick={e => e.stopPropagation()}>CT.gov</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparable deals */}
      {data.comparableDeals.length > 0 && (
        <div>
          <SectionHeader title="Comparable Transactions" />
          <DealTable deals={data.comparableDeals} />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB: SIGNALS (L2 — 9-factor breakdown)
// ════════════════════════════════════════════════════════════════

function SignalsTab({ data }: { data: SignalData | null }) {
  if (!data || Object.keys(data.signals_by_type).length === 0) {
    return <EmptyState icon="📡" title="No signals detected" subtitle="This asset hasn't triggered any licensing signals yet" />;
  }

  const SIGNAL_WEIGHTS: Record<string, number> = {
    cash_runway: 18, regulatory_milestone: 16, competitor_failure: 14,
    management_commentary: 12, strategic_review: 11, patent_filing: 9,
    publication_velocity: 7, conference_activity: 7, bd_executive_hire: 6,
  };

  // Build factor list from signals, sorted by weight
  const factors = Object.entries(data.signals_by_type)
    .map(([type, signals]) => {
      const meta = SIGNAL_TYPE_META[type] || { label: type, icon: '•', color: 'text-slate-500' };
      const topSignal = signals[0] as Record<string, unknown>;
      return {
        type,
        meta,
        weight: SIGNAL_WEIGHTS[type] || 0,
        value: Number(topSignal?.signal_value || 0),
        confidence: Number(topSignal?.confidence || 0),
        direction: (topSignal?.direction as string) || 'neutral',
        evidence: (topSignal?.evidence_text as string) || '—',
        signalCount: signals.length,
      };
    })
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">9-Factor Licensing Signal Breakdown</p>
        {data.score_delta_30d !== 0 && (
          <span className={`text-xs font-semibold ${data.score_delta_30d > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {data.score_delta_30d > 0 ? '+' : ''}{data.score_delta_30d} pts (30d)
          </span>
        )}
      </div>
      {factors.map(f => (
        <div key={f.type} className="rounded-xl border border-slate-100 dark:border-slate-700/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{f.meta.icon}</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.meta.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">{f.weight}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                f.direction === 'bullish' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                f.direction === 'bearish' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>{f.direction}</span>
              <span className={`text-lg font-bold tabular-nums ${f.meta.color}`}>{f.value}</span>
            </div>
          </div>
          {/* Bar */}
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-700 ${
              f.value >= 60 ? 'bg-amber-500' : f.value >= 30 ? 'bg-slate-400' : 'bg-slate-300 dark:bg-slate-600'
            }`} style={{ width: `${Math.min(f.value, 100)}%` }} />
          </div>
          {/* Evidence */}
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{f.evidence}</p>
        </div>
      ))}

      {/* Trend sparkline (last 14 snapshots) */}
      {data.trend.length > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <SectionHeader title="Score History" />
          <div className="flex items-end gap-1 h-16 mt-2">
            {data.trend.slice(0, 14).reverse().map((snap, i) => {
              const score = Number((snap as Record<string, unknown>).licensing_intent_score || 0);
              const maxScore = Math.max(...data.trend.map(s => Number((s as Record<string, unknown>).licensing_intent_score || 0)), 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm bg-amber-500/20 relative" style={{ height: `${(score / maxScore) * 56}px` }}>
                    <div className="absolute inset-x-0 bottom-0 rounded-sm bg-amber-500" style={{ height: `${Math.min(100, (score / maxScore) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-slate-400">
            <span>{data.trend.length > 1 ? formatDate((data.trend[data.trend.length - 1] as Record<string, unknown>).snapshot_date) : ''}</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB: COMPETITION (L5)
// ════════════════════════════════════════════════════════════════

function CompetitionTab({ data }: { data: IntelData | null }) {
  if (!data || data.intel.length === 0) {
    return <EmptyState icon="🏟️" title="No competitive signals" subtitle="No competitors detected in this asset's space" />;
  }

  const intelTypes = Object.entries(data.by_type).sort(
    (a, b) => Math.max(...b[1].map(s => Number((s as Record<string, unknown>).intensity || 0))) -
              Math.max(...a[1].map(s => Number((s as Record<string, unknown>).intensity || 0)))
  );

  return (
    <div className="space-y-5">
      {/* Competitor badges */}
      {data.competitors.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Companies circling this space</p>
          <div className="flex flex-wrap gap-2">
            {data.competitors.slice(0, 12).map((c, i) => (
              <span key={i} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                c.intensity >= 60 ? 'border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-300' :
                c.intensity >= 30 ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300' :
                'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                {c.name}
                <span className="ml-1.5 opacity-60">{c.intensity}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Intel signals by type */}
      {intelTypes.map(([type, signals]) => {
        const meta = INTEL_TYPE_META[type] || { label: type, icon: '•' };
        return (
          <div key={type} className="rounded-xl border border-slate-100 dark:border-slate-700/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>{meta.icon}</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{meta.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{signals.length}</span>
            </div>
            <div className="space-y-2">
              {signals.slice(0, 5).map((sig, i) => {
                const s = sig as Record<string, unknown>;
                const intensity = Number(s.intensity || 0);
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${
                        intensity >= 60 ? 'bg-rose-500' : intensity >= 30 ? 'bg-amber-500' : 'bg-slate-400'
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{String(s.evidence_text)}</p>
                      {s.competitor_name ? (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{String(s.competitor_name)} · Intensity {intensity}/100</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB: ACQUIRERS (L6 — proposed deals)
// ════════════════════════════════════════════════════════════════

function AcquirersTab({ data }: { data: OpportunityData | null }) {
  if (!data || data.proposed_acquirers.length === 0) {
    return <EmptyState icon="🎯" title="No proposed acquirers" subtitle="The Deal Creation Engine hasn't matched this asset to an acquirer yet" />;
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
        AI-Proposed Transactions ({data.proposed_acquirers.length})
      </p>
      {data.proposed_acquirers.map((opp, i) => {
        const o = opp as Record<string, unknown>;
        const score = Number(o.opportunity_score || 0);
        const stratFit = Number(o.strategic_fit_score || 0);
        const timing = Number(o.timing_score || 0);
        return (
          <div key={i} className={`rounded-xl border p-5 ${
            score >= 60
              ? 'border-amber-200/60 dark:border-amber-700/30 bg-gradient-to-br from-amber-50/30 to-white dark:from-amber-900/5 dark:to-slate-900'
              : 'border-slate-200 dark:border-slate-700/40'
          }`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{String(o.acquirer_name)}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                  {(o.gap_type as string || '').replace(/_/g, ' ')}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold tabular-nums ${score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>{score}</p>
                <p className="text-[10px] text-slate-400">score</p>
              </div>
            </div>

            {/* Mini scores */}
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Fit {stratFit}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Timing {timing}</span>
              </div>
              {o.predicted_upfront_mid ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {formatCurrency(o.predicted_upfront_low)}–{formatCurrency(o.predicted_upfront_high)} upfront
                  </span>
                </div>
              ) : null}
            </div>

            {/* Rationale */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{String(o.rationale)}</p>

            {/* Drivers + risks */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {(o.strategic_drivers as string[])?.length > 0 ? (
                <div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-1">Drivers</p>
                  {(o.strategic_drivers as string[]).slice(0, 3).map((d, j) => (
                    <p key={j} className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">+ {d}</p>
                  ))}
                </div>
              ) : null}
              {(o.risk_factors as string[])?.length > 0 ? (
                <div>
                  <p className="text-[10px] text-red-500 dark:text-red-400 font-semibold uppercase tracking-wider mb-1">Risks</p>
                  {(o.risk_factors as string[]).slice(0, 3).map((r, j) => (
                    <p key={j} className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">– {r}</p>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Comp basis */}
            {Number(o.comp_count || 0) > 0 ? (
              <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/30">
                Based on {Number(o.comp_count)} comparable transactions · Confidence {Number(o.confidence)}/100
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${colors[color] || colors.slate}`}>{children}</span>;
}

function MiniScore({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, { text: string; bar: string }> = {
    amber: { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
    teal: { text: 'text-teal-600 dark:text-teal-400', bar: 'bg-teal-500' },
    rose: { text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' },
    blue: { text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },
  };
  const c = colorMap[color] || colorMap.amber;
  const v = Math.round(value || 0);
  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700/40 p-2.5">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${c.text}`}>{v || '—'}</p>
      <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 mt-1 overflow-hidden">
        <div className={`h-full rounded-full ${c.bar} transition-all duration-700`} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
    </div>
  );
}

function TermRange({ label, low, mid, high, unit }: { label: string; low: number | null; mid: number | null; high: number | null; unit: string }) {
  if (mid === null) return <div className="text-center"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="text-sm text-slate-400 mt-1">—</p></div>;
  const fmt = (n: number | null) => n === null ? '—' : unit === '%' ? `${n}%` : `$${n}M`;
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{fmt(mid)}</p>
      <p className="text-[11px] text-slate-400 tabular-nums">{fmt(low)} – {fmt(high)}</p>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h3>;
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="text-center py-12">
      <span className="text-3xl block mb-3">{icon}</span>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function DealTable({ deals }: { deals: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700/40">
            <th className="text-left py-2 pr-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Licensee</th>
            <th className="text-left py-2 pr-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Asset</th>
            <th className="text-right py-2 pr-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Upfront</th>
            <th className="text-right py-2 pr-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
            <th className="text-right py-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal, i) => (
            <tr key={i} className="border-b border-slate-50 dark:border-slate-800/40">
              <td className="py-2 pr-3 text-xs text-slate-700 dark:text-slate-300 font-medium">{deal.licensee_name as string || '—'}</td>
              <td className="py-2 pr-3 text-xs text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{deal.asset_name as string || '—'}</td>
              <td className="py-2 pr-3 text-right text-xs text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(deal.upfront_m)}</td>
              <td className="py-2 pr-3 text-right text-xs text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(deal.total_deal_value_m)}</td>
              <td className="py-2 text-right text-xs text-slate-500 dark:text-slate-400">{formatDate(deal.announcement_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
