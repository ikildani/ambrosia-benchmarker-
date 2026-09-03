'use client';

interface DealData {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  modality: string | null;
  deal_type: string | null;
  territory: string | null;
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

interface Props {
  deal: DealData;
  userPhase: string;
  onClose: () => void;
}

const PHASE_RANK: Record<string, number> = {
  discovery: 0, preclinical: 1, phase_1: 2, phase_1_2: 2.5,
  phase_2: 3, phase_2_3: 3.5, phase_3: 4, nda_filed: 5, approved: 6,
};

function fmtM(v: number | null | undefined): string {
  if (v == null) return 'Undisclosed';
  const m = v / 1_000_000;
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  if (m >= 1) return `$${Math.round(m)}M`;
  return `$${m.toFixed(1)}M`;
}

function fmtPhase(p: string | null): string {
  if (!p) return 'Unknown';
  return p.replace(/_/g, ' ').replace(/\bphase\b/i, 'Phase ').replace(/\bnda\b/i, 'NDA').trim();
}

function sourceBadge(t: string | null): { label: string; cls: string } {
  if (t === 'sec_8k') return { label: 'SEC 8-K', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  if (t === 'sec_10k') return { label: 'SEC 10-K', cls: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
  if (t === 'press_release') return { label: 'Press Release', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  if (t === 'manual') return { label: 'Verified', cls: 'bg-teal-500/20 text-teal-400 border-teal-500/30' };
  return { label: 'Other', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
}

export default function DealDetailModal({ deal, userPhase, onClose }: Props) {
  const totalStr = deal.total_deal_value_usd != null
    ? fmtM(deal.total_deal_value_usd)
    : deal.upfront_usd != null ? fmtM(deal.upfront_usd) : '';
  const dealTypeLabel = (deal.deal_type || 'license').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const year = deal.announced_date?.substring(0, 4) || '';
  const src = sourceBadge(deal.source_type);

  const userRank = PHASE_RANK[userPhase] ?? 3;
  const compRank = PHASE_RANK[deal.phase_at_signing || ''] ?? 3;
  const phaseDelta = userRank - compRank;
  const phaseAdjPct = phaseDelta * -15;
  const adjustedUpfront = deal.upfront_usd != null
    ? deal.upfront_usd * (1 + phaseAdjPct / 100)
    : null;

  const terms = [
    { label: 'Upfront Payment', value: fmtM(deal.upfront_usd) },
    { label: 'Development Milestones', value: fmtM(deal.milestones_development_usd) },
    { label: 'Regulatory Milestones', value: fmtM(deal.milestones_regulatory_usd) },
    { label: 'Commercial Milestones', value: fmtM(deal.milestones_commercial_usd) },
    { label: 'Total Deal Value', value: fmtM(deal.total_deal_value_usd) },
    {
      label: 'Royalty Rate',
      value: deal.royalty_low_pct != null
        ? `${(deal.royalty_low_pct * 100).toFixed(1)}%${deal.royalty_high_pct != null && deal.royalty_high_pct !== deal.royalty_low_pct ? ` – ${(deal.royalty_high_pct * 100).toFixed(1)}%` : ''}`
        : 'Undisclosed',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">
              {deal.licensor_name || '?'} / {deal.licensee_name || '?'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {totalStr && `${totalStr} `}{dealTypeLabel}{year && ` (${year})`}
            </p>
            {deal.asset_name && (
              <p className="text-xs text-teal-400 mt-1 font-medium">{deal.asset_name}</p>
            )}
          </div>

          {/* Financial Terms */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {terms.map(t => (
              <div key={t.label} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t.label}</p>
                <p className={`text-sm font-mono font-semibold ${t.value === 'Undisclosed' ? 'text-slate-600' : 'text-white'}`}>
                  {t.value}
                </p>
              </div>
            ))}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { label: fmtPhase(deal.phase_at_signing) },
              { label: deal.modality || 'Unknown modality' },
              { label: deal.territory || 'Global' },
              { label: dealTypeLabel },
            ].map((m, i) => (
              <span key={i} className="px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-md">
                {m.label}
              </span>
            ))}
            {deal.indication_specific && (
              <span className="px-2.5 py-1 text-[11px] font-medium text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md">
                {deal.indication_specific}
              </span>
            )}
          </div>

          {/* Source */}
          <div className="flex items-center gap-3 mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border ${src.cls}`}>
              {src.label}
            </span>
            {deal.confidence_score != null && (
              <span className="text-[11px] text-slate-400">
                Confidence: <span className={`font-mono font-semibold ${deal.confidence_score >= 85 ? 'text-emerald-400' : deal.confidence_score >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{deal.confidence_score}/100</span>
              </span>
            )}
            {deal.source_url && (
              <a
                href={deal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-[11px] text-teal-400 hover:text-teal-300 underline underline-offset-2"
              >
                View source filing
              </a>
            )}
          </div>

          {/* Raw Text Excerpt */}
          {deal.raw_text_excerpt && (
            <div className="mb-6">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Source Excerpt</p>
              <blockquote className="text-xs text-slate-400 leading-relaxed p-3 bg-slate-950/50 border-l-2 border-teal-500/30 rounded-r-lg italic">
                &ldquo;{deal.raw_text_excerpt}&rdquo;
              </blockquote>
            </div>
          )}

          {/* Phase Adjustment — "Compared to your asset" */}
          {phaseDelta !== 0 && (
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <p className="text-xs font-semibold text-slate-300 mb-2">Compared to your asset</p>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1">
                  <p className="text-slate-400">
                    This deal was at <span className="text-white font-medium">{fmtPhase(deal.phase_at_signing)}</span>, your asset is at <span className="text-white font-medium">{fmtPhase(userPhase)}</span>
                    {' — '}{Math.abs(phaseDelta)} phase{Math.abs(phaseDelta) > 1 ? 's' : ''} {phaseDelta < 0 ? 'earlier' : 'later'}.
                  </p>
                  <p className="text-slate-500 mt-1">
                    Industry benchmark: ~15% value adjustment per phase transition.
                  </p>
                </div>
                {adjustedUpfront != null && deal.upfront_usd != null && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase">Phase-adjusted upfront</p>
                    <p className="font-mono font-bold text-teal-400">{fmtM(adjustedUpfront)}</p>
                    <p className={`text-[10px] font-mono ${phaseAdjPct >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {phaseAdjPct >= 0 ? '+' : ''}{phaseAdjPct}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
