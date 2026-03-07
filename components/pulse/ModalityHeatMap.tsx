'use client';

interface ModalityHeatMapProps {
  snapshot: any;
  isPro: boolean;
}

const TOP_MODALITIES = ['adc', 'bispecific_antibody', 'car_t', 'small_molecule', 'radiopharmaceutical', 'gene_therapy', 'monoclonal_antibody', 'rnai'];

function formatModality(modality: string): string {
  const names: Record<string, string> = {
    adc: 'ADC', bispecific_antibody: 'Bispecific', car_t: 'CAR-T', small_molecule: 'SM',
    radiopharmaceutical: 'Radiopharm', gene_therapy: 'Gene Tx', monoclonal_antibody: 'mAb',
    rnai: 'RNAi', antisense_oligonucleotide: 'ASO', peptide: 'Peptide',
  };
  return names[modality] || modality.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}


export default function ModalityHeatMap({ snapshot, isPro }: ModalityHeatMapProps) {
  // Build a cross-tab from the snapshot data
  // Since our snapshot only has modality_breakdown and therapeutic_area_breakdown separately,
  // we show modality breakdown counts in a simplified heat map
  const modalityData = snapshot.modality_breakdown || {};

  // Find modalities that actually have deals this week
  const activeModalities = TOP_MODALITIES.filter((m) => modalityData[m]?.count > 0);
  if (activeModalities.length === 0 && Object.keys(modalityData).length > 0) {
    // Use whatever modalities are present
    activeModalities.push(...Object.keys(modalityData).slice(0, 8));
  }

  const maxCount = Math.max(1, ...Object.values(modalityData).map((d: any) => d.count || 0));

  const ariaLabel = activeModalities.length > 0
    ? `Deal activity heat map showing ${activeModalities.length} modalities. Top: ${activeModalities.slice(0, 3).map(m => `${formatModality(m)} (${modalityData[m]?.count || 0})`).join(', ')}`
    : 'Deal activity heat map: no deal activity this week';

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white" aria-hidden="true">Deal Activity</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400" aria-hidden="true">By modality this week</p>
      </div>

      {activeModalities.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No deal activity this week.</p>
      ) : (
        <div className="space-y-2">
          {activeModalities.map((modality) => {
            const data = modalityData[modality] || { count: 0 };
            const barWidth = Math.max(8, (data.count / maxCount) * 100);

            return (
              <div key={modality} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-20 shrink-0 truncate">
                  {formatModality(modality)}
                </span>
                <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-teal-500 dark:from-teal-500 dark:to-teal-400 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                    style={{ width: `${barWidth}%` }}
                  >
                    {isPro ? (
                      <span className="text-xs font-bold text-white drop-shadow-sm">{data.count}</span>
                    ) : (
                      <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible data table for screen readers */}
      <table className="sr-only">
        <caption>Deal activity by modality this week</caption>
        <thead>
          <tr><th scope="col">Modality</th><th scope="col">Deals</th></tr>
        </thead>
        <tbody>
          {activeModalities.map((modality) => (
            <tr key={`sr-${modality}`}>
              <td>{formatModality(modality)}</td>
              <td>{modalityData[modality]?.count || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Less active</span>
          <div className="flex gap-1">
            <div className="w-4 h-3 rounded-sm bg-teal-100 dark:bg-teal-500/10" />
            <div className="w-4 h-3 rounded-sm bg-teal-200 dark:bg-teal-500/20" />
            <div className="w-4 h-3 rounded-sm bg-teal-300 dark:bg-teal-500/30" />
            <div className="w-4 h-3 rounded-sm bg-teal-400 dark:bg-teal-500/40" />
          </div>
          <span>More active</span>
        </div>
      </div>
    </div>
  );
}
