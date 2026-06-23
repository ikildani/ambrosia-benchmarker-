'use client';

interface Props {
  byTherapeuticArea: Record<string, { premium: number; n: number }>;
  companyName: string;
}

function barColor(premium: number): string {
  if (premium >= 1.1) return 'bg-teal-500';
  if (premium >= 0.9) return 'bg-amber-500';
  return 'bg-red-500';
}

function labelColor(premium: number): string {
  if (premium >= 1.1) return 'text-teal-400';
  if (premium >= 0.9) return 'text-amber-400';
  return 'text-red-400';
}

export function PremiumTrendChart({ byTherapeuticArea, companyName }: Props) {
  const entries = Object.entries(byTherapeuticArea)
    .sort((a, b) => b[1].premium - a[1].premium);

  if (entries.length === 0) {
    return null;
  }

  // Find max premium for scaling bars
  const maxPremium = Math.max(...entries.map(([, v]) => v.premium), 1.0);

  return (
    <section className="border-b border-slate-800/60">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-xl font-semibold text-slate-100">
          Premium by therapeutic area
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          How {companyName} pays relative to peer medians in each TA
        </p>

        <div className="space-y-3">
          {entries.map(([ta, v]) => {
            const widthPct = Math.max((v.premium / maxPremium) * 100, 4);
            return (
              <div key={ta} className="group">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm capitalize text-slate-300">
                    {ta.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs text-slate-500">
                      {v.n} deal{v.n !== 1 ? 's' : ''}
                    </span>
                    <span className={`font-mono text-sm font-medium ${labelColor(v.premium)}`}>
                      {v.premium.toFixed(2)}x
                    </span>
                  </div>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800/60">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(v.premium)}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Reference line legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-500" />
            Above market (&ge;1.10x)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            At market (0.90 &ndash; 1.10x)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Below market (&lt;0.90x)
          </span>
        </div>
      </div>
    </section>
  );
}
