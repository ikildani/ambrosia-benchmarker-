'use client';

import { formatModality } from '@/lib/config/modality-display';

interface ModalityHeatMapProps {
  snapshot: any;
  isPro: boolean;
}

const TOP_MODALITIES = ['adc', 'bispecific_antibody', 'car_t', 'small_molecule', 'radiopharmaceutical', 'gene_therapy', 'monoclonal_antibody', 'rnai'];


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

  // Sort by deal count descending so the most active modalities appear first
  activeModalities.sort((a, b) => (modalityData[b]?.count || 0) - (modalityData[a]?.count || 0));

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
            const barWidth = Math.max(4, (data.count / maxCount) * 100);

            return (
              <div key={modality} className="group flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-20 shrink-0 truncate">
                  {formatModality(modality)}
                </span>
                <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-500 dark:to-blue-400 rounded-lg transition-all duration-300 flex items-center justify-end pr-2 group-hover:from-blue-600 group-hover:to-blue-700 dark:group-hover:from-blue-400 dark:group-hover:to-blue-300"
                    style={{ width: `${barWidth}%` }}
                  >
                    {isPro ? (
                      <span className="text-xs font-bold text-white drop-shadow-sm">{data.count}</span>
                    ) : (
                      <span className="text-xs font-bold text-white/0 group-hover:text-white/90 transition-colors duration-200 drop-shadow-sm">{data.count}</span>
                    )}
                  </div>
                  {/* Hover tooltip for exact count */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+6px)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                    <span className="px-2 py-1 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-md whitespace-nowrap shadow-lg">
                      {data.count} deal{data.count !== 1 ? 's' : ''}
                    </span>
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
            <div className="w-4 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/10" />
            <div className="w-4 h-3 rounded-sm bg-blue-200 dark:bg-blue-900/20" />
            <div className="w-4 h-3 rounded-sm bg-blue-300 dark:bg-blue-900/30" />
            <div className="w-4 h-3 rounded-sm bg-blue-400 dark:bg-blue-900/40" />
          </div>
          <span>More active</span>
        </div>
      </div>
    </div>
  );
}
