function formatTA(ta: string): string {
  return ta
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();
}

interface Props {
  readoutsByTA: Record<string, number>;
}

export function CompetitiveCluster({ readoutsByTA }: Props) {
  const hotTAs = Object.entries(readoutsByTA)
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1]);

  if (hotTAs.length === 0) return null;

  const totalReadouts = hotTAs.reduce((sum, [, count]) => sum + count, 0);
  const topTAs = hotTAs.slice(0, 3);

  return (
    <div className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-400">
          !
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-200 mb-1">
            Heavy readout period ahead — {totalReadouts} Phase 3 readouts across {hotTAs.length} therapeutic areas in the next 60 days
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Deal benchmarks in these spaces will likely reset. Factor readout timing into your negotiation strategy.
          </p>
          <div className="flex flex-wrap gap-2">
            {topTAs.map(([ta, count]) => (
              <span key={ta} className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs">
                <span className="font-semibold text-teal-400">{formatTA(ta)}</span>
                <span className="text-slate-500">{count} readouts</span>
              </span>
            ))}
            {hotTAs.length > 3 && (
              <span className="inline-flex items-center rounded-md bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs text-slate-500">
                +{hotTAs.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
