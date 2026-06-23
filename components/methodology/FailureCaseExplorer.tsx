const FAILURE_CASES = [
  {
    deal: 'AbbVie / ImmunoGen',
    year: 2024,
    ta: 'Oncology',
    type: 'Acquisition',
    actualM: 10100,
    predictedM: 5800,
    errorPct: 74,
    reason: 'Competitive ADC bidding war drove premium beyond single-asset fundamentals.',
  },
  {
    deal: 'Pfizer / Seagen',
    year: 2023,
    ta: 'Oncology',
    type: 'Acquisition',
    actualM: 43000,
    predictedM: 28000,
    errorPct: 54,
    reason: 'Platform premium across 3 approved + 4 clinical ADCs cannot be captured by single-asset rNPV.',
  },
  {
    deal: 'Merck / Prometheus',
    year: 2023,
    ta: 'Immunology',
    type: 'Acquisition',
    actualM: 10800,
    predictedM: 6200,
    errorPct: 74,
    reason: 'Phase 2 asset priced on Humira-successor thesis; engine underweights blockbuster replacement narratives.',
  },
  {
    deal: 'Roche / Carmot',
    year: 2024,
    ta: 'Metabolic',
    type: 'Acquisition',
    actualM: 2700,
    predictedM: 1500,
    errorPct: 80,
    reason: 'GLP-1 platform frenzy: Novo/Lilly duopoly created scarcity premium for credible third entrants.',
  },
  {
    deal: 'BMS / Mirati',
    year: 2024,
    ta: 'Oncology',
    type: 'Acquisition',
    actualM: 4800,
    predictedM: 3200,
    errorPct: 50,
    reason: 'KRAS franchise valued on pipeline breadth beyond lead asset; single-indication model undershoots.',
  },
  {
    deal: 'Biogen / Reata',
    year: 2023,
    ta: 'Rare Disease',
    type: 'Acquisition',
    actualM: 7300,
    predictedM: 4100,
    errorPct: 78,
    reason: 'Approved rare disease drug with minimal competition; peak sales ceiling too conservative in engine.',
  },
];

function formatDollar(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${m}M`;
}

export function FailureCaseExplorer() {
  return (
    <div className="my-8">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Representative Failure Cases
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Deals where the engine prediction fell outside the &plusmn;35% tolerance band. Included for transparency — these illustrate structural limits of single-asset rNPV.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="pb-2 pr-4 font-medium">Deal</th>
              <th className="pb-2 pr-4 font-medium">Year</th>
              <th className="pb-2 pr-4 font-medium">TA</th>
              <th className="pb-2 pr-4 font-medium">Type</th>
              <th className="pb-2 pr-4 text-right font-medium">Actual</th>
              <th className="pb-2 pr-4 text-right font-medium">Predicted</th>
              <th className="pb-2 text-right font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {FAILURE_CASES.map((c) => {
              const isHigh = Math.abs(c.errorPct) >= 70;
              return (
                <tr
                  key={c.deal}
                  className={[
                    'border-b border-slate-800/60',
                    isHigh ? 'bg-amber-500/[0.03]' : '',
                  ].join(' ')}
                >
                  <td className="py-2.5 pr-4 font-medium text-slate-200">{c.deal}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{c.year}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{c.ta}</td>
                  <td className="py-2.5 pr-4 text-slate-400">{c.type}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-slate-200">
                    {formatDollar(c.actualM)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-slate-400">
                    {formatDollar(c.predictedM)}
                  </td>
                  <td
                    className={[
                      'py-2.5 text-right tabular-nums font-medium',
                      isHigh ? 'text-amber-400' : 'text-amber-400/70',
                    ].join(' ')}
                  >
                    +{c.errorPct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-case explanations */}
      <div className="mt-4 space-y-2">
        {FAILURE_CASES.map((c) => (
          <div key={c.deal} className="flex gap-2 text-xs">
            <span className="shrink-0 font-medium text-slate-400">{c.deal}:</span>
            <span className="text-slate-500">{c.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
