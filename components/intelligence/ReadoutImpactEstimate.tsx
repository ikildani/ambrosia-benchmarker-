import { getImpactEstimate } from '@/lib/market-intelligence/readout-impact';

function formatTA(ta: string): string {
  return ta
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

interface Props {
  therapeuticArea: string;
}

export function ReadoutImpactEstimate({ therapeuticArea }: Props) {
  const impact = getImpactEstimate(therapeuticArea);
  if (!impact) return null;

  const taName = formatTA(therapeuticArea);

  return (
    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs leading-relaxed text-slate-400">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="text-slate-300">Historical:</span> positive Phase 3 readout in{' '}
      <span className="font-medium text-slate-200">{taName}</span> → deal values rise{' '}
      <span className="text-emerald-400">{impact.positive[0]}-{impact.positive[1]}%</span> within 30d.{' '}
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
      Negative →{' '}
      <span className="text-amber-400">{impact.negative[0]} to {impact.negative[1]}%</span>.
    </div>
  );
}
