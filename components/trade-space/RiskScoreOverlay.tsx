'use client';

/**
 * Risk dots overlay for trade-space deal structure cards.
 *
 * Three risk axes per deal type: Governance, Integration, Timeline.
 * Each renders as a small colored dot with a tooltip label.
 */

type RiskLevel = 'low' | 'medium' | 'high';

interface RiskAxis {
  label: string;
  level: RiskLevel;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-400',
  medium: 'bg-yellow-400',
  high: 'bg-amber-500',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
};

function getRiskAxes(dealType: string): RiskAxis[] {
  // Governance risk
  const governance: RiskLevel =
    dealType === 'codevelopment'
      ? 'high'
      : dealType === 'collaboration'
        ? 'medium'
        : 'low';

  // Integration risk
  const integration: RiskLevel =
    dealType === 'acquisition'
      ? 'high'
      : dealType === 'codevelopment'
        ? 'medium'
        : 'low';

  // Timeline risk
  const timeline: RiskLevel =
    dealType === 'option'
      ? 'high'
      : dealType === 'collaboration'
        ? 'medium'
        : 'low';

  return [
    { label: 'Governance', level: governance },
    { label: 'Integration', level: integration },
    { label: 'Timeline', level: timeline },
  ];
}

export function RiskScoreOverlay({ dealType }: { dealType: string }) {
  const axes = getRiskAxes(dealType);

  return (
    <div className="flex items-center gap-2.5">
      {axes.map((axis) => (
        <div key={axis.label} className="group relative flex items-center gap-1">
          <span
            className={`inline-block h-2 w-2 rounded-full ${RISK_COLORS[axis.level]}`}
          />
          <span className="text-[10px] text-slate-500">{axis.label}</span>
          {/* Tooltip */}
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {axis.label}: {RISK_LABELS[axis.level]}
          </span>
        </div>
      ))}
    </div>
  );
}
