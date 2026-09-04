'use client';

interface ClinicalAsset {
  id: string;
  company_name: string;
  asset_name: string;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  trial_status: string | null;
  trial_count: number;
  enrollment_total: number;
  partnership_status: string;
  partner_company_name: string | null;
  licensing_intent_score: number;
  competitive_heat: number;
  deal_readiness_score: number;
  confidence_score: number;
  originator_country: string | null;
  originator_region: string | null;
  first_posted_date: string | null;
  last_update_date: string | null;
  nct_ids: string[];
  territory_rights_available: string[];
}

interface Props {
  asset: ClinicalAsset;
  onClick: (id: string) => void;
}

const PHASE_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  'Early Phase 1': { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-300', glow: '' },
  'Phase 1':       { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-300', glow: '' },
  'Phase 1/Phase 2': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-300', glow: '' },
  'Phase 2':       { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-300', glow: '' },
  'Phase 2/Phase 3': { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-300', glow: '' },
  'Phase 3':       { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-300', glow: 'ring-1 ring-amber-500/20' },
  'Phase 4':       { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-300', glow: '' },
  'Approved':      { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-300', glow: 'ring-1 ring-green-500/20' },
};

const PARTNERSHIP_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  unpartnered:         { label: 'Unpartnered', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  partially_partnered: { label: 'Partial Rights', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  partnered:           { label: 'Partnered', dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
  unknown:             { label: 'Unknown', dot: 'bg-slate-300', text: 'text-slate-400 dark:text-slate-500' },
};

function formatTA(ta: string): string {
  return ta.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatModality(m: string): string {
  const map: Record<string, string> = {
    small_molecule: 'Small Molecule', monoclonal_antibody: 'mAb', adc: 'ADC',
    bispecific: 'Bispecific', car_t: 'CAR-T', cell_therapy: 'Cell Therapy',
    gene_therapy: 'Gene Therapy', mrna: 'mRNA', peptide: 'Peptide',
    oligonucleotide: 'Oligo', vaccine: 'Vaccine', radiopharmaceutical: 'Radiopharma',
  };
  return map[m] || m.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ScoreGauge({ value, label, color, glowColor }: { value: number; label: string; color: string; glowColor: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-11 h-11">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3"
            className="stroke-slate-100 dark:stroke-slate-700" />
          <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3"
            strokeLinecap="round"
            className={color}
            style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums ${glowColor}`}>
          {Math.round(pct)}
        </span>
      </div>
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function formatPhase(raw: string): string {
  const map: Record<string, string> = {
    phase_1: 'Phase 1', phase_2: 'Phase 2', phase_3: 'Phase 3', phase_4: 'Phase 4',
    phase1: 'Phase 1', phase2: 'Phase 2', phase3: 'Phase 3', phase4: 'Phase 4',
    early_phase1: 'Early Phase 1', phase_1_2: 'Phase 1/Phase 2', phase_2_3: 'Phase 2/Phase 3',
    phase1_phase2: 'Phase 1/Phase 2', phase2_phase3: 'Phase 2/Phase 3',
    approved: 'Approved', preclinical: 'Preclinical', discovery: 'Discovery',
  };
  return map[raw.toLowerCase()] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function AssetCard({ asset, onClick }: Props) {
  const partner = PARTNERSHIP_CONFIG[asset.partnership_status] || PARTNERSHIP_CONFIG.unknown;
  const phaseLabel = asset.phase ? formatPhase(asset.phase) : '';
  const phaseStyle = PHASE_COLORS[phaseLabel] || { bg: 'bg-slate-500/10', text: 'text-slate-500 dark:text-slate-400', glow: '' };
  const isHighIntent = asset.licensing_intent_score >= 60;

  return (
    <button
      onClick={() => onClick(asset.id)}
      className={`w-full text-left rounded-xl border bg-white dark:bg-slate-800/60 p-5 transition-all duration-200 group relative overflow-hidden ${
        isHighIntent
          ? 'border-amber-200/60 dark:border-amber-700/30 hover:border-amber-300 dark:hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-500/5'
          : 'border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
      }`}
    >
      {/* High-intent shimmer accent */}
      {isHighIntent && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      )}

      {/* Row 1: Name + Phase + Partnership */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-tight">
            {asset.asset_name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {asset.company_name}
            </span>
            {asset.originator_country && (
              <>
                <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{asset.originator_country}</span>
              </>
            )}
          </div>
        </div>

        {/* Partnership indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${partner.dot}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${partner.text}`}>
            {partner.label}
          </span>
        </div>
      </div>

      {/* Row 2: Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {phaseLabel && (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${phaseStyle.bg} ${phaseStyle.text} ${phaseStyle.glow}`}>
            {phaseLabel}
          </span>
        )}
        {asset.therapeutic_area && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
            {formatTA(asset.therapeutic_area)}
          </span>
        )}
        {asset.modality && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
            {formatModality(asset.modality)}
          </span>
        )}
        {asset.partner_company_name && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200/40 dark:ring-amber-700/30">
            {asset.partner_company_name}
          </span>
        )}
      </div>

      {/* Row 3: Score gauges */}
      <div className="flex items-center justify-between px-2">
        <ScoreGauge
          value={asset.licensing_intent_score}
          label="Intent"
          color="stroke-amber-500"
          glowColor="text-amber-600 dark:text-amber-400"
        />
        <ScoreGauge
          value={asset.deal_readiness_score}
          label="Ready"
          color="stroke-teal-500"
          glowColor="text-teal-600 dark:text-teal-400"
        />
        <ScoreGauge
          value={asset.competitive_heat}
          label="Heat"
          color="stroke-rose-500"
          glowColor="text-rose-600 dark:text-rose-400"
        />
        <ScoreGauge
          value={asset.confidence_score}
          label="Data"
          color="stroke-blue-500"
          glowColor="text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Row 4: Footer meta */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/30 text-[11px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {asset.trial_count} trial{asset.trial_count !== 1 ? 's' : ''}
        </span>
        {asset.enrollment_total > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {asset.enrollment_total.toLocaleString()}
          </span>
        )}
        {asset.territory_rights_available?.length > 0 && (
          <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 font-semibold">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
            {asset.territory_rights_available.map(t => t === 'global' ? 'Global' : t.replace(/_/g, ' ').toUpperCase()).join(', ')}
          </span>
        )}
        {asset.last_update_date && (
          <span className="ml-auto tabular-nums">{asset.last_update_date}</span>
        )}
      </div>
    </button>
  );
}
