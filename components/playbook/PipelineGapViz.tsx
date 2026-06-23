'use client';

const ALL_TAS = [
  'oncology',
  'neurology',
  'immunology',
  'metabolic',
  'cardiovascular',
  'infectiousDisease',
  'ophthalmology',
  'womensHealth',
  'rareDisease',
  'hematology',
  'dermatology',
  'gastroenterology',
] as const;

function formatTA(ta: string): string {
  // Handle camelCase (e.g. infectiousDisease -> Infectious Disease)
  const spaced = ta.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Handle snake_case
  return spaced.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  byTherapeuticArea: Record<string, { premium: number; n: number }>;
  companyName: string;
}

export function PipelineGapViz({ byTherapeuticArea, companyName }: Props) {
  // Normalize the keys for matching: try both camelCase and snake_case
  const normalizedMap = new Map<string, { premium: number; n: number }>();
  for (const [key, val] of Object.entries(byTherapeuticArea)) {
    normalizedMap.set(key.toLowerCase().replace(/[_\s]/g, ''), val);
  }

  const coveredCount = ALL_TAS.filter(ta => {
    const norm = ta.toLowerCase().replace(/[_\s]/g, '');
    return normalizedMap.has(norm);
  }).length;

  return (
    <section className="border-b border-slate-800/60">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-xl font-semibold text-slate-100">
          Pipeline coverage &amp; gaps
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          {companyName} has disclosed activity in {coveredCount} of {ALL_TAS.length} tracked therapeutic areas.
          Gaps may represent whitespace opportunities for licensors.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_TAS.map(ta => {
            const norm = ta.toLowerCase().replace(/[_\s]/g, '');
            const data = normalizedMap.get(norm);
            const hasCoverage = !!data;

            return (
              <div
                key={ta}
                className={`rounded-xl border p-4 transition-colors ${
                  hasCoverage
                    ? 'border-teal-500/30 bg-teal-950/30'
                    : 'border-red-500/20 bg-red-950/20'
                }`}
              >
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                  {formatTA(ta)}
                </div>
                {hasCoverage ? (
                  <>
                    <div className="font-mono text-lg font-semibold text-teal-400">
                      {data.premium.toFixed(2)}x
                    </div>
                    <div className="text-xs text-slate-500">
                      {data.n} deal{data.n !== 1 ? 's' : ''}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-lg font-semibold text-amber-400/80">
                      Gap
                    </div>
                    <div className="text-xs text-red-400/60">
                      No disclosed deals
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
