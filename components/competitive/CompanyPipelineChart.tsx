'use client';

interface CompanyPipelineChartProps {
  pipeline: Record<string, number>;
}

const phaseOrder = ['phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4'];
const phaseLabels: Record<string, string> = {
  early_phase_1: 'Early P1', phase_1: 'Phase 1', phase_1_2: 'Phase 1/2',
  phase_2: 'Phase 2', phase_2_3: 'Phase 2/3', phase_3: 'Phase 3', phase_4: 'Phase 4',
};

const phaseColors: Record<string, string> = {
  phase_1: 'from-blue-400 to-blue-500', phase_1_2: 'from-blue-400 to-cyan-500',
  phase_2: 'from-blue-400 to-blue-500', phase_2_3: 'from-blue-500 to-blue-600',
  phase_3: 'from-blue-400 to-emerald-500', phase_4: 'from-emerald-400 to-green-500',
  early_phase_1: 'from-indigo-400 to-blue-500',
};

export default function CompanyPipelineChart({ pipeline }: CompanyPipelineChartProps) {
  const phases = Object.entries(pipeline)
    .filter(([phase]) => phaseOrder.includes(phase) || phase === 'early_phase_1')
    .sort((a, b) => {
      const aIdx = phaseOrder.indexOf(a[0]);
      const bIdx = phaseOrder.indexOf(b[0]);
      return (aIdx === -1 ? -1 : aIdx) - (bIdx === -1 ? -1 : bIdx);
    });

  const maxCount = Math.max(1, ...phases.map(([, count]) => count));

  if (phases.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Pipeline</h2>
        <p className="text-sm text-slate-400">No active trials data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Pipeline by Phase</h2>
      <div className="space-y-3">
        {phases.map(([phase, count]) => {
          const barWidth = Math.max(12, (count / maxCount) * 100);
          const colors = phaseColors[phase] || 'from-slate-400 to-slate-500';

          return (
            <div key={phase} className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-16 shrink-0 text-right">
                {phaseLabels[phase] || phase}
              </span>
              <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${colors} rounded-lg flex items-center justify-end pr-2 transition-all duration-500`}
                  style={{ width: `${barWidth}%` }}
                >
                  <span className="text-xs font-bold text-white drop-shadow-sm">{count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
