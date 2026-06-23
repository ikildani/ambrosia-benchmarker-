interface UserCalc {
  therapeutic_area: string;
  indication: string;
}

interface Readout {
  therapeuticArea: string;
  conditions: string[];
  title: string;
  sponsor: string;
  daysToReadout: number;
}

interface Props {
  userCalculations: UserCalc[];
  readouts: Readout[];
}

function fmtDays(d: number): string {
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 30) return `${d}d`;
  if (d < 90) return `${Math.round(d / 7)}w`;
  return `${Math.round(d / 30)}mo`;
}

function formatTA(ta: string): string {
  return ta
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function DealImpactSection({ userCalculations, readouts }: Props) {
  if (!userCalculations.length) return null;

  // Build set of TAs the user has calculated
  const userTAs = new Set(userCalculations.map((c) => c.therapeutic_area));

  // Find readouts matching user's TAs
  const matched = readouts.filter((r) => r.therapeuticArea && userTAs.has(r.therapeuticArea));
  if (matched.length === 0) return null;

  // De-dup and limit
  const seen = new Set<string>();
  const unique = matched.filter((r) => {
    const key = `${r.sponsor}-${r.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);

  return (
    <section className="mb-8">
      <div className="rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-500/5 to-slate-900/40 px-5 py-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-300">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20 text-xs">
            *
          </span>
          Relevant to Your Deals
        </h3>
        <p className="mb-4 text-xs text-slate-400">
          These upcoming readouts are in TAs you have active calculations for.
          A positive or negative result may shift your deal benchmarks.
        </p>
        <div className="space-y-2">
          {unique.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-slate-200">{r.sponsor}</span>
                <span className="mx-1.5 text-slate-600">|</span>
                <span className="text-slate-400 truncate">{r.conditions[0] || r.title}</span>
              </div>
              <div className="ml-3 flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-slate-400">
                  {formatTA(r.therapeuticArea)}
                </span>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 font-medium',
                    r.daysToReadout <= 30
                      ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border border-slate-700 bg-slate-800/60 text-slate-400',
                  ].join(' ')}
                >
                  {fmtDays(r.daysToReadout)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
