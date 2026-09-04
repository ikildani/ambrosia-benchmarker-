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

const PHASE_COLORS: Record<string, string> = {
  'Early Phase 1': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  'Phase 1': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Phase 1/Phase 2': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Phase 2': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Phase 2/Phase 3': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Phase 3': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Phase 4': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'Approved': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const PARTNERSHIP_LABELS: Record<string, { label: string; className: string }> = {
  unpartnered: { label: 'Unpartnered', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  partially_partnered: { label: 'Partial Rights', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  partnered: { label: 'Partnered', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
  unknown: { label: 'Unknown', className: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
};

function formatTA(ta: string): string {
  return ta.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatModality(m: string): string {
  const map: Record<string, string> = {
    small_molecule: 'Small Molecule',
    monoclonal_antibody: 'mAb',
    adc: 'ADC',
    bispecific: 'Bispecific',
    car_t: 'CAR-T',
    cell_therapy: 'Cell Therapy',
    gene_therapy: 'Gene Therapy',
    mrna: 'mRNA',
    peptide: 'Peptide',
    oligonucleotide: 'Oligo',
    vaccine: 'Vaccine',
    radiopharmaceutical: 'Radiopharma',
  };
  return map[m] || m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500 dark:text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-slate-600 dark:text-slate-300 w-8 text-right font-medium tabular-nums">
        {Math.round(value)}
      </span>
    </div>
  );
}

export function AssetCard({ asset, onClick }: Props) {
  const partnerInfo = PARTNERSHIP_LABELS[asset.partnership_status] || PARTNERSHIP_LABELS.unknown;
  const phaseColor = PHASE_COLORS[asset.phase || ''] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

  return (
    <button
      onClick={() => onClick(asset.id)}
      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 hover:border-amber-300 dark:hover:border-amber-600/50 hover:shadow-md transition-all duration-200 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {asset.asset_name}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {asset.company_name}
            {asset.originator_country && (
              <span className="text-slate-400 dark:text-slate-500"> · {asset.originator_country}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {asset.phase && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${phaseColor}`}>
              {asset.phase}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${partnerInfo.className}`}>
            {partnerInfo.label}
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {asset.therapeutic_area && (
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
            {formatTA(asset.therapeutic_area)}
          </span>
        )}
        {asset.modality && (
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
            {formatModality(asset.modality)}
          </span>
        )}
        {asset.indication_specific && (
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
            {asset.indication_specific.replace(/_/g, ' ')}
          </span>
        )}
        {asset.partner_company_name && (
          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
            Partner: {asset.partner_company_name}
          </span>
        )}
      </div>

      {/* Scores */}
      <div className="space-y-1.5">
        <ScoreBar value={asset.licensing_intent_score} label="Intent" color="bg-amber-500" />
        <ScoreBar value={asset.deal_readiness_score} label="Readiness" color="bg-teal-500" />
        <ScoreBar value={asset.competitive_heat} label="Heat" color="bg-rose-500" />
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/40 text-xs text-slate-400 dark:text-slate-500">
        <span>{asset.trial_count} trial{asset.trial_count !== 1 ? 's' : ''}</span>
        {asset.enrollment_total > 0 && (
          <span>{asset.enrollment_total.toLocaleString()} enrolled</span>
        )}
        {asset.territory_rights_available?.length > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {asset.territory_rights_available.join(', ')} available
          </span>
        )}
        {asset.last_update_date && (
          <span className="ml-auto">Updated {asset.last_update_date}</span>
        )}
      </div>
    </button>
  );
}
