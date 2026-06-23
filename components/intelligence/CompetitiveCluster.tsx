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
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (hotTAs.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {hotTAs.map(([ta, count]) => (
        <div
          key={ta}
          className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs text-amber-400">
            !
          </span>
          <p className="text-sm text-amber-200/90">
            <span className="font-semibold text-amber-300">{count}</span>{' '}
            <span className="text-teal-400">{formatTA(ta)}</span> Phase 3 readouts in next 60 days
            — deal benchmarks in this space will likely reset.
          </p>
        </div>
      ))}
    </div>
  );
}
