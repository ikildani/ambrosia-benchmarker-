'use client';

import { useEffect, useState } from 'react';

interface AssetDetail {
  asset: Record<string, unknown>;
  linkedDeals: Record<string, unknown>[];
  comparableDeals: Record<string, unknown>[];
  trials: Record<string, unknown>[];
  thesis: Record<string, unknown> | null;
}

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

export function AssetDetailModal({ assetId, onClose }: Props) {
  const [data, setData] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/radar/assets/${assetId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load asset');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!assetId) return null;

  const asset = data?.asset as Record<string, unknown> | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-amber-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {asset && (
          <div className="p-6 sm:p-8">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {asset.asset_name as string}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {asset.company_name as string}
                {asset.originator_country && ` · ${asset.originator_country}`}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {asset.phase && (
                  <span className="px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    {asset.phase as string}
                  </span>
                )}
                {asset.therapeutic_area && (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {(asset.therapeutic_area as string).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                )}
                {asset.modality && (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {asset.modality as string}
                  </span>
                )}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  asset.partnership_status === 'unpartnered'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : asset.partnership_status === 'partially_partnered'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {asset.partnership_status === 'unpartnered' ? 'Unpartnered' :
                   asset.partnership_status === 'partially_partnered' ? 'Partial Rights' : 'Partnered'}
                </span>
              </div>
            </div>

            {/* Scores grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <ScoreCard label="Licensing Intent" value={asset.licensing_intent_score as number} color="text-amber-600 dark:text-amber-400" />
              <ScoreCard label="Deal Readiness" value={asset.deal_readiness_score as number} color="text-teal-600 dark:text-teal-400" />
              <ScoreCard label="Competitive Heat" value={asset.competitive_heat as number} color="text-rose-600 dark:text-rose-400" />
            </div>

            {/* Predicted Deal Terms (from thesis) */}
            {data!.thesis && (
              <Section title="Predicted Deal Terms">
                <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3">
                    Based on {(data!.thesis as Record<string, unknown>).comp_count as number} comparable transactions
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <TermRange
                      label="Upfront ($M)"
                      low={(data!.thesis as Record<string, unknown>).predicted_upfront_low as number | null}
                      mid={(data!.thesis as Record<string, unknown>).predicted_upfront_mid as number | null}
                      high={(data!.thesis as Record<string, unknown>).predicted_upfront_high as number | null}
                    />
                    <TermRange
                      label="Total Value ($M)"
                      low={(data!.thesis as Record<string, unknown>).predicted_total_low as number | null}
                      mid={(data!.thesis as Record<string, unknown>).predicted_total_mid as number | null}
                      high={(data!.thesis as Record<string, unknown>).predicted_total_high as number | null}
                    />
                    <TermRange
                      label="Royalty (%)"
                      low={(data!.thesis as Record<string, unknown>).predicted_royalty_low as number | null}
                      mid={(data!.thesis as Record<string, unknown>).predicted_royalty_mid as number | null}
                      high={(data!.thesis as Record<string, unknown>).predicted_royalty_high as number | null}
                    />
                  </div>
                  {/* Likely acquirers */}
                  {((data!.thesis as Record<string, unknown>).likely_acquirers as { name: string; dealCount: number }[])?.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Most active acquirers in this space:</p>
                      <div className="flex flex-wrap gap-2">
                        {((data!.thesis as Record<string, unknown>).likely_acquirers as { name: string; dealCount: number }[]).slice(0, 5).map((acq, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {acq.name} ({acq.dealCount} deals)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Trial details */}
            {data!.trials.length > 0 && (
              <Section title={`Clinical Trials (${data!.trials.length})`}>
                <div className="space-y-3">
                  {data!.trials.slice(0, 10).map((trial, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-700/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                            {trial.trial_title as string}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {trial.nct_id as string} · {trial.phase as string || 'Phase unknown'} · {trial.status as string || 'Status unknown'}
                          </p>
                        </div>
                        <a
                          href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          CT.gov
                        </a>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        {trial.enrollment_count && <span>{(trial.enrollment_count as number).toLocaleString()} enrolled</span>}
                        {trial.start_date && <span>Started {formatDate(trial.start_date)}</span>}
                        {trial.is_collaboration && <span className="text-amber-500">Collaboration</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Linked deals */}
            {data!.linkedDeals.length > 0 && (
              <Section title="Existing Deals">
                <DealTable deals={data!.linkedDeals} />
              </Section>
            )}

            {/* Comparable deals */}
            {data!.comparableDeals.length > 0 && (
              <Section title="Comparable Transactions">
                <DealTable deals={data!.comparableDeals} />
              </Section>
            )}

            {/* Meta */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-400">
              <span>Confidence: {asset.confidence_score}/100</span>
              <span>{(asset.nct_ids as string[])?.length || 0} NCT IDs</span>
              {asset.last_update_date && <span>Last updated: {formatDate(asset.last_update_date)}</span>}
              {asset.last_enriched_at && <span>Enriched: {formatDate(asset.last_enriched_at)}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700/40 p-3 text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>
        {value ? Math.round(value) : '—'}
      </p>
    </div>
  );
}

function TermRange({ label, low, mid, high }: { label: string; low: number | null; mid: number | null; high: number | null }) {
  if (mid === null) {
    return (
      <div className="text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm text-slate-400 mt-1">—</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
        {label.includes('%') ? `${mid}%` : `$${mid}M`}
      </p>
      <p className="text-xs text-slate-400">
        {label.includes('%') ? `${low}% – ${high}%` : `$${low}M – $${high}M`}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DealTable({ deals }: { deals: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-700/40">
            <th className="text-left py-2 pr-3 text-xs font-medium text-slate-500 dark:text-slate-400">Licensee</th>
            <th className="text-left py-2 pr-3 text-xs font-medium text-slate-500 dark:text-slate-400">Asset</th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-slate-500 dark:text-slate-400">Upfront</th>
            <th className="text-right py-2 pr-3 text-xs font-medium text-slate-500 dark:text-slate-400">Total</th>
            <th className="text-right py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Date</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal, i) => (
            <tr key={i} className="border-b border-slate-50 dark:border-slate-800/40">
              <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{deal.licensee_name as string || '—'}</td>
              <td className="py-2 pr-3 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{deal.asset_name as string || '—'}</td>
              <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(deal.upfront_m)}</td>
              <td className="py-2 pr-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(deal.total_deal_value_m)}</td>
              <td className="py-2 text-right text-slate-500 dark:text-slate-400">{formatDate(deal.announcement_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
