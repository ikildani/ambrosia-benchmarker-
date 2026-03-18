'use client';

interface Deal {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  modality: string;
  phase_at_signing: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
  therapeutic_area: string | null;
}

interface DealActivityFeedProps {
  deals: Deal[];
  totalDeals: number;
  isPro: boolean;
  onUpgrade: () => void;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    discovery: 'Discovery', preclinical: 'Preclinical', phase_1: 'Phase 1',
    phase_2: 'Phase 2', phase_3: 'Phase 3', approved: 'Approved', unknown: 'Unknown',
  };
  return map[phase] || phase;
}

function formatModality(modality: string): string {
  const short: Record<string, string> = {
    adc: 'ADC', car_t: 'CAR-T', bispecific_antibody: 'Bispecific', small_molecule: 'SM',
    gene_therapy: 'Gene Tx', cell_therapy: 'Cell Tx', mrna: 'mRNA', radiopharmaceutical: 'Radiopharm',
    monoclonal_antibody: 'mAb', rnai: 'RNAi', antisense_oligonucleotide: 'ASO', peptide: 'Peptide',
    protein_degrader: 'Degrader', gene_editing: 'Gene Edit', oncolytic_virus: 'OV',
    antibody_fragment: 'Ab Frag', vaccine: 'Vaccine',
  };
  return short[modality] || modality.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const taColors: Record<string, string> = {
  oncology: 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  neurology: 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  immunology: 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  metabolic: 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  cardiovascular: 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  infectiousDisease: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  ophthalmology: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  womensHealth: 'bg-pink-50 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
};

function formatTA(ta: string): string {
  const names: Record<string, string> = {
    oncology: 'Onc', neurology: 'Neuro', immunology: 'Immuno', metabolic: 'Metab',
    cardiovascular: 'CV', infectiousDisease: 'ID', ophthalmology: 'Ophth', womensHealth: "Women's",
  };
  return names[ta] || ta.charAt(0).toUpperCase() + ta.slice(1);
}

const phaseColors: Record<string, string> = {
  discovery: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  preclinical: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  phase_1: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  phase_2: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  phase_3: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
};

export default function DealActivityFeed({ deals, totalDeals, isPro, onUpgrade }: DealActivityFeedProps) {
  const visibleDeals = isPro ? deals : deals.slice(0, 2);
  const hiddenCount = isPro ? 0 : Math.max(0, totalDeals - 2);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">This Week's Deals</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{totalDeals} deal{totalDeals !== 1 ? 's' : ''} announced</p>
        </div>
      </div>

      {visibleDeals.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
          No deals announced this week yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {visibleDeals.map((deal) => (
            <div key={deal.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      {formatModality(deal.modality)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${phaseColors[deal.phase_at_signing] || 'bg-slate-100 text-slate-600'}`}>
                      {formatPhase(deal.phase_at_signing)}
                    </span>
                    {deal.therapeutic_area && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${taColors[deal.therapeutic_area] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {formatTA(deal.therapeutic_area)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {deal.licensor_name} <span className="text-slate-500 dark:text-slate-400 font-normal">&rarr;</span> {deal.licensee_name}
                  </p>
                  {deal.asset_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{deal.asset_name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {isPro ? formatUsd(deal.upfront_usd) : (
                      <span className="text-slate-300 dark:text-slate-600 blur-sm select-none">$XXM</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(deal.announced_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Blurred overlay for free users */}
      {hiddenCount > 0 && (
        <div className="relative">
          <div className="px-6 py-4 opacity-30 blur-sm pointer-events-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-500">ADC</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-500">Phase 2</span>
                </div>
                <p className="text-sm font-semibold text-slate-400">Company A &rarr; Company B</p>
              </div>
              <div className="text-sm font-bold text-slate-400">$XXM</div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-[1px]">
            <button
              onClick={onUpgrade}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Unlock {hiddenCount} more deal{hiddenCount !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
