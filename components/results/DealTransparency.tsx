'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DEAL_STATS } from '@/lib/config/constants';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { CalculationInput } from '@/lib/calculations';
import type { UserTier } from '@/types/tier';
import DealDetailModal from './DealDetailModal';

interface TransparencyDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  modality: string | null;
  deal_type: string | null;
  territory: string | null;
  therapeutic_area: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  milestones_development_usd?: number | null;
  milestones_regulatory_usd?: number | null;
  milestones_commercial_usd?: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  source_url: string | null;
  source_type: string | null;
  confidence_score: number | null;
  match_quality: 'exact' | 'strong' | 'partial';
  indication_specific?: string | null;
  indication_category?: string | null;
  raw_text_excerpt?: string | null;
}

interface Stats { min: number; p25: number; median: number; p75: number; max: number }

interface QuarterlyTrend { label: string; quarter: string; year: number; medianUpfront: number | null; dealCount: number }

interface ConfidenceData {
  medianConfidence: number | null;
  verifiedCount: number;
  bySource: Record<string, number>;
  newestDeal: string | null;
  oldestDeal: string | null;
  coverageLevel: string;
}

interface TransparencyResponse {
  success: boolean;
  tier: string;
  totalCount: number;
  exactCount: number;
  strongCount: number;
  withTermsCount: number;
  stats: { upfront: Stats | null; totalValue: Stats | null; royalty: Stats | null };
  confidence: ConfidenceData;
  quarterlyTrend: QuarterlyTrend[];
  deals: TransparencyDeal[];
  methodology: string;
}

interface Props {
  inputs: CalculationInput;
  tier: UserTier;
  onUpgrade?: () => void;
  calculationMedian?: number;
}

const PHASE_RANK: Record<string, number> = {
  discovery: 0, preclinical: 1, phase_1: 2, phase_1_2: 2.5,
  phase_2: 3, phase_2_3: 3.5, phase_3: 4, nda_filed: 5, approved: 6,
};

function fmtM(v: number | null | undefined): string {
  if (v == null) return 'Undisclosed';
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  if (v >= 1) return `$${Math.round(v)}M`;
  return `$${v.toFixed(1)}M`;
}

function fmtUsd(v: number | null): string {
  if (v == null) return 'Undisclosed';
  return fmtM(v / 1_000_000);
}

function fmtRoyalty(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'Undisclosed';
  const l = low != null ? (low * 100).toFixed(1) : '?';
  const h = high != null ? (high * 100).toFixed(1) : '?';
  return low === high ? `${l}%` : `${l}–${h}%`;
}

function fmtPhase(p: string | null): string {
  if (!p) return '—';
  return p.replace(/_/g, ' ').replace(/\bphase\b/i, 'Phase ').replace(/\bnda\b/i, 'NDA').trim();
}

function matchBadge(q: string): { label: string; cls: string } {
  if (q === 'exact') return { label: 'Exact', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  if (q === 'strong') return { label: 'Strong', cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30' };
  return { label: 'Related', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
}

function valueColor(v: number | null, median: number | null): string {
  if (v == null || median == null) return 'text-slate-500';
  const m = v / 1_000_000;
  if (m >= median * 1.15) return 'text-emerald-400';
  if (m <= median * 0.85) return 'text-amber-400';
  return 'text-slate-200';
}

function StatBar({ label, stats }: { label: string; stats: Stats | null }) {
  if (!stats) return null;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-slate-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-1 font-mono">
        <span className="text-slate-500">{fmtM(stats.min)}</span>
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full relative mx-1">
          <div
            className="absolute h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full"
            style={{
              left: `${stats.max > stats.min ? ((stats.p25 - stats.min) / (stats.max - stats.min)) * 100 : 0}%`,
              width: `${stats.max > stats.min ? ((stats.p75 - stats.p25) / (stats.max - stats.min)) * 100 : 100}%`,
            }}
          />
          <div
            className="absolute w-0.5 h-3 -top-[3px] bg-white rounded-full"
            style={{ left: `${stats.max > stats.min ? ((stats.median - stats.min) / (stats.max - stats.min)) * 100 : 50}%` }}
          />
        </div>
        <span className="text-slate-500">{fmtM(stats.max)}</span>
      </div>
      <span className="text-teal-400 font-semibold font-mono w-16 text-right">{fmtM(stats.median)}</span>
    </div>
  );
}

function phaseAdjust(dealUpfront: number | null, dealPhase: string | null, userPhase: string): { adjusted: number | null; pct: number } {
  if (dealUpfront == null || !dealPhase) return { adjusted: null, pct: 0 };
  const userRank = PHASE_RANK[userPhase] ?? 3;
  const compRank = PHASE_RANK[dealPhase] ?? 3;
  const delta = userRank - compRank;
  const pct = delta * -15;
  return { adjusted: dealUpfront * (1 + pct / 100), pct };
}

export default function DealTransparency({ inputs, tier, onUpgrade, calculationMedian }: Props) {
  const { user } = useAuth();
  const hasPro = tier === 'pro' || tier === 'portfolio' || tier === 'report';
  const [data, setData] = useState<TransparencyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<TransparencyDeal | null>(null);
  const [yearFilter, setYearFilter] = useState<'all' | '3y' | '5y'>('all');
  const [matchFilter, setMatchFilter] = useState<'all' | 'exact' | 'strong'>('all');
  const [sortKey, setSortKey] = useState<'relevance' | 'year' | 'upfront' | 'total'>('relevance');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ta: inputs.therapeuticArea || '', phase: inputs.phase || '', modality: inputs.modality || '' });
      if (inputs.dealType) params.set('dealType', inputs.dealType);
      if (inputs.territory) params.set('territory', inputs.territory);
      if (user?.email) params.set('email', user.email);
      const res = await fetch(`/api/deals/transparency?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      setData(await res.json());
    } catch { setError('Unable to load deal data'); }
    finally { setLoading(false); }
  }, [inputs, user?.email]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredDeals = useMemo(() => {
    if (!data?.deals) return [];
    let deals = [...data.deals];
    const currentYear = new Date().getFullYear();
    if (yearFilter === '3y') deals = deals.filter(d => d.announced_date && parseInt(d.announced_date.substring(0, 4)) >= currentYear - 3);
    if (yearFilter === '5y') deals = deals.filter(d => d.announced_date && parseInt(d.announced_date.substring(0, 4)) >= currentYear - 5);
    if (matchFilter === 'exact') deals = deals.filter(d => d.match_quality === 'exact');
    if (matchFilter === 'strong') deals = deals.filter(d => d.match_quality !== 'partial');
    if (sortKey === 'year') deals.sort((a, b) => (b.announced_date || '').localeCompare(a.announced_date || ''));
    if (sortKey === 'upfront') deals.sort((a, b) => (b.upfront_usd ?? 0) - (a.upfront_usd ?? 0));
    if (sortKey === 'total') deals.sort((a, b) => (b.total_deal_value_usd ?? 0) - (a.total_deal_value_usd ?? 0));
    return deals;
  }, [data, yearFilter, matchFilter, sortKey]);

  const handleExportCSV = useCallback(() => {
    if (!filteredDeals.length) return;
    const headers = ['Year', 'Licensor', 'Licensee', 'Asset', 'Phase', 'Modality', 'Deal Type', 'Territory', 'Upfront ($M)', 'Adjusted Upfront ($M)', 'Total Value ($M)', 'Royalty Low %', 'Royalty High %', 'Match', 'Source URL'];
    const rows = filteredDeals.map(d => {
      const adj = phaseAdjust(d.upfront_usd, d.phase_at_signing, inputs.phase);
      return [
        d.announced_date?.substring(0, 4) || '', d.licensor_name || '', d.licensee_name || '', d.asset_name || '',
        d.phase_at_signing || '', d.modality || '', d.deal_type || '', d.territory || '',
        d.upfront_usd != null ? (d.upfront_usd / 1e6).toFixed(1) : '',
        adj.adjusted != null ? (adj.adjusted / 1e6).toFixed(1) : '',
        d.total_deal_value_usd != null ? (d.total_deal_value_usd / 1e6).toFixed(1) : '',
        d.royalty_low_pct != null ? (d.royalty_low_pct * 100).toFixed(1) : '',
        d.royalty_high_pct != null ? (d.royalty_high_pct * 100).toFixed(1) : '',
        d.match_quality, d.source_url || '',
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `solidus-comparable-deals-${inputs.therapeuticArea}-${inputs.phase}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filteredDeals, inputs]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading comparable transactions from {DEAL_STATS.TOTAL_DEALS} deals...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 mb-6">
        <p className="text-sm text-slate-400">{error || 'No data available'}</p>
      </div>
    );
  }

  const conf = data.confidence;
  const secCount = (conf.bySource['sec_8k'] || 0) + (conf.bySource['sec_10k'] || 0);
  const prCount = conf.bySource['press_release'] || 0;
  const otherCount = data.totalCount - secCount - prCount;
  const coverageColor = conf.coverageLevel === 'strong' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : conf.coverageLevel === 'moderate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-slate-400 bg-slate-500/10 border-slate-500/20';

  const rawMedian = data.stats.upfront?.median ?? null;
  const calcM = calculationMedian != null ? calculationMedian : null;
  const deltaAbs = rawMedian != null && calcM != null ? calcM - rawMedian : null;
  const deltaPct = rawMedian != null && calcM != null && rawMedian > 0 ? ((calcM - rawMedian) / rawMedian) * 100 : null;

  const trendData = (data.quarterlyTrend || []).filter(t => t.medianUpfront != null);
  const trendChange = trendData.length >= 2
    ? ((trendData[trendData.length - 1].medianUpfront! - trendData[0].medianUpfront!) / trendData[0].medianUpfront!) * 100
    : null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Your estimate is based on {data.totalCount} comparable transactions
              </h3>
              <p className="text-xs text-slate-400">
                {data.exactCount} exact · {data.strongCount} strong · {data.withTermsCount} with disclosed terms
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border ${coverageColor} capitalize`}>
              {conf.coverageLevel}
            </span>
            {hasPro && filteredDeals.length > 0 && (
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV
              </button>
            )}
          </div>
        </div>

        {/* Feature 2: Methodology Confidence */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-3">
          <span>{data.totalCount} deals</span>
          <span>{conf.verifiedCount} verified</span>
          {conf.medianConfidence != null && (
            <span>Median confidence: <span className="text-slate-300 font-mono">{conf.medianConfidence}/100</span></span>
          )}
          <span className="text-slate-600">|</span>
          {secCount > 0 && <span>{secCount} SEC filings</span>}
          {prCount > 0 && <span>{prCount} press releases</span>}
          {otherCount > 0 && <span>{otherCount} other</span>}
          {conf.newestDeal && <span className="text-slate-600">|</span>}
          {conf.newestDeal && <span>Latest: {conf.newestDeal.substring(0, 7)}</span>}
          {conf.oldestDeal && <span>Earliest: {conf.oldestDeal.substring(0, 7)}</span>}
        </div>

        {/* Feature 3: Estimate vs. Actuals */}
        {rawMedian != null && calcM != null && (
          <div className="flex items-center gap-4 text-xs mb-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50">
            <div>
              <span className="text-slate-500">Calculator estimate: </span>
              <span className="text-white font-mono font-semibold">{fmtM(calcM)}</span>
            </div>
            <div className="text-slate-600">vs</div>
            <div>
              <span className="text-slate-500">Raw data median: </span>
              <span className="text-white font-mono font-semibold">{fmtM(rawMedian)}</span>
            </div>
            {deltaPct != null && (
              <div className={`ml-auto font-mono font-semibold ${Math.abs(deltaPct) <= 15 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(0)}%
                {Math.abs(deltaPct) > 15 && (
                  <span className="text-[10px] text-slate-500 font-normal ml-2">Adjusted for modality/competitive position</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Statistical Summary */}
        <div className="space-y-2 mt-3">
          <StatBar label="Upfront" stats={data.stats.upfront} />
          <StatBar label="Total Value" stats={data.stats.totalValue} />
          <StatBar label="Royalty %" stats={data.stats.royalty} />
        </div>
      </div>

      {/* Feature 5: Time-Series Sparkline */}
      {hasPro && trendData.length >= 3 && (
        <div className="px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-slate-500">Median upfront trend — {inputs.therapeuticArea} {fmtPhase(inputs.phase)}</p>
            {trendChange != null && (
              <p className={`text-[11px] font-mono font-semibold ${trendChange >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {trendChange >= 0 ? '+' : ''}{trendChange.toFixed(0)}% since {trendData[0].label}
              </p>
            )}
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5A5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0EA5A5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number) => [`$${Math.round(v)}M`, 'Median Upfront']}
              />
              <Area type="monotone" dataKey="medianUpfront" stroke="#0EA5A5" strokeWidth={2} fill="url(#trendFill)" dot={{ r: 2, fill: '#0EA5A5' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pro gate */}
      {!hasPro ? (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-400 mb-4">
            Start a Pro trial to see all {data.totalCount} individual transactions with company names, financial terms, and source URLs.
          </p>
          <button onClick={onUpgrade} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all">
            Start Free Trial — See All Deals
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="px-5 py-3 border-b border-slate-700/50 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(['all', '3y', '5y'] as const).map(f => (
                <button key={f} onClick={() => setYearFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${yearFilter === f ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
                  {f === 'all' ? 'All Years' : f === '3y' ? 'Last 3Y' : 'Last 5Y'}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex gap-1">
              {(['all', 'exact', 'strong'] as const).map(f => (
                <button key={f} onClick={() => setMatchFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${matchFilter === f ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}>
                  {f === 'all' ? 'All Matches' : f === 'exact' ? 'Exact Only' : 'Strong+'}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <select value={sortKey} onChange={e => setSortKey(e.target.value as typeof sortKey)}
              className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 rounded-md px-2 py-1 focus:outline-none focus:border-teal-500">
              <option value="relevance">Sort: Relevance</option>
              <option value="year">Sort: Most Recent</option>
              <option value="upfront">Sort: Highest Upfront</option>
              <option value="total">Sort: Highest Total</option>
            </select>
          </div>

          {/* Deal Table — Feature 4: includes Adjusted column */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-2.5 font-medium sticky left-0 bg-slate-800/95 z-10">Year</th>
                  <th className="text-left px-3 py-2.5 font-medium min-w-[200px]">Parties</th>
                  <th className="text-left px-3 py-2.5 font-medium">Asset</th>
                  <th className="text-left px-3 py-2.5 font-medium">Phase</th>
                  <th className="text-right px-3 py-2.5 font-medium">Upfront</th>
                  <th className="text-right px-3 py-2.5 font-medium">Adjusted</th>
                  <th className="text-right px-3 py-2.5 font-medium">Total Value</th>
                  <th className="text-right px-3 py-2.5 font-medium">Royalty</th>
                  <th className="text-center px-3 py-2.5 font-medium">Match</th>
                  <th className="text-center px-3 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.length === 0 ? (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-slate-500">No deals match these filters.</td></tr>
                ) : filteredDeals.map(deal => {
                  const badge = matchBadge(deal.match_quality);
                  const adj = phaseAdjust(deal.upfront_usd, deal.phase_at_signing, inputs.phase);
                  return (
                    <tr key={deal.id} onClick={() => setSelectedDeal(deal)}
                      className="border-b border-slate-800/50 hover:bg-slate-700/30 cursor-pointer transition-colors">
                      <td className="px-5 py-3 text-slate-400 font-mono sticky left-0 bg-slate-800/95 z-10">
                        {deal.announced_date?.substring(0, 4) || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-200 font-medium">{deal.licensor_name || '?'}</span>
                        <span className="text-slate-600 mx-1">{'→'}</span>
                        <span className="text-slate-300">{deal.licensee_name || '?'}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-400 max-w-[150px] truncate">{deal.asset_name || '—'}</td>
                      <td className="px-3 py-3 text-slate-400">{fmtPhase(deal.phase_at_signing)}</td>
                      <td className={`px-3 py-3 text-right font-mono font-medium ${valueColor(deal.upfront_usd, data.stats.upfront?.median ?? null)}`}>
                        {fmtUsd(deal.upfront_usd)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        {adj.adjusted != null ? (
                          <span className="text-teal-400">{fmtUsd(adj.adjusted)}
                            {adj.pct !== 0 && <span className={`ml-1 text-[10px] ${adj.pct >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>({adj.pct >= 0 ? '+' : ''}{adj.pct}%)</span>}
                          </span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className={`px-3 py-3 text-right font-mono font-medium ${valueColor(deal.total_deal_value_usd, data.stats.totalValue?.median ?? null)}`}>
                        {fmtUsd(deal.total_deal_value_usd)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-400">{fmtRoyalty(deal.royalty_low_pct, deal.royalty_high_pct)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {deal.source_url ? (
                          <a href={deal.source_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="text-teal-400 hover:text-teal-300 underline underline-offset-2">
                            {deal.source_type === 'sec_8k' ? 'SEC' : deal.source_type === 'sec_10k' ? '10-K' : deal.source_type === 'press_release' ? 'PR' : 'Link'}
                          </a>
                        ) : <span className="text-slate-600 text-[10px]">Internal</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {filteredDeals.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between">
              <p className="text-[11px] text-slate-500">
                Showing {filteredDeals.length} of {data.totalCount} deals
              </p>
              <p className="text-[11px] text-slate-600">
                Median upfront: <span className="text-teal-400 font-mono">{data.stats.upfront ? fmtM(data.stats.upfront.median) : '—'}</span>
                {' · '}Median total: <span className="text-teal-400 font-mono">{data.stats.totalValue ? fmtM(data.stats.totalValue.median) : '—'}</span>
              </p>
            </div>
          )}
        </>
      )}

      {/* Feature 1: Deal Detail Modal */}
      {selectedDeal && (
        <DealDetailModal deal={selectedDeal} userPhase={inputs.phase} onClose={() => setSelectedDeal(null)} />
      )}

      <p className="px-5 py-2 text-[10px] text-slate-600 border-t border-slate-700/50">
        {data.methodology}
      </p>
    </div>
  );
}
