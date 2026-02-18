'use client';

interface PipelineByIndicationProps {
  data: Record<string, { count: number; phases: Record<string, number> }>;
  isPro: boolean;
}

const phaseKeys = ['phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3'] as const;

const phaseLabels: Record<string, string> = {
  phase_1: 'P1',
  phase_1_2: 'P1/2',
  phase_2: 'P2',
  phase_2_3: 'P2/3',
  phase_3: 'P3',
};

const indicationLabels: Record<string, string> = {
  solid_tumor: 'Solid Tumors',
  cns: 'CNS',
  hematological: 'Hematologic',
  autoimmune: 'Autoimmune',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  infectious_disease: 'Infectious Disease',
  respiratory: 'Respiratory',
  dermatology: 'Dermatology',
  ophthalmology: 'Ophthalmology',
  rare_disease: 'Rare Disease',
  oncology: 'Oncology',
  gastroenterology: 'Gastroenterology',
  nephrology: 'Nephrology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  endocrinology: 'Endocrinology',
  hepatology: 'Hepatology',
  pain: 'Pain',
  psychiatry: 'Psychiatry',
  fibrosis: 'Fibrosis',
  inflammation: 'Inflammation',
};

function formatIndication(key: string): string {
  return (
    indicationLabels[key] ||
    key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function getCellIntensity(count: number, maxCount: number): string {
  if (count === 0) return 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500';
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300';
  if (ratio <= 0.5) return 'bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-200';
  if (ratio <= 0.75) return 'bg-teal-200 dark:bg-teal-500/30 text-teal-900 dark:text-teal-100';
  return 'bg-teal-400 dark:bg-teal-500/50 text-white dark:text-white font-bold';
}

function LockIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-slate-300 dark:text-slate-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function PipelineByIndication({ data, isPro }: PipelineByIndicationProps) {
  const indications = Object.entries(data).sort((a, b) => b[1].count - a[1].count);

  if (indications.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          Pipeline by Indication
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Active clinical trials by therapeutic area and development phase
        </p>
        <div className="flex flex-col items-center justify-center py-12">
          <svg
            className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
            />
          </svg>
          <p className="text-sm text-slate-400 dark:text-slate-500">No active pipeline data</p>
        </div>
      </div>
    );
  }

  // Compute the max cell count across all cells for intensity scaling
  let maxCellCount = 1;
  for (const [, { phases }] of indications) {
    for (const phaseKey of phaseKeys) {
      const val = phases[phaseKey] || 0;
      if (val > maxCellCount) maxCellCount = val;
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        Pipeline by Indication
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Active clinical trials by therapeutic area and development phase
      </p>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 pb-3 pr-4 pl-1 whitespace-nowrap">
                Indication
              </th>
              {phaseKeys.map((key) => (
                <th
                  key={key}
                  className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 pb-3 px-1 whitespace-nowrap"
                >
                  {phaseLabels[key]}
                </th>
              ))}
              <th className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 pb-3 pl-3 whitespace-nowrap">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {indications.map(([key, { count, phases }], idx) => (
              <tr
                key={key}
                className={
                  idx % 2 === 0
                    ? ''
                    : 'bg-slate-50 dark:bg-slate-800/50'
                }
              >
                <td className="py-2 pr-4 pl-1 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {formatIndication(key)}
                </td>
                {phaseKeys.map((phaseKey) => {
                  const cellCount = phases[phaseKey] || 0;
                  return (
                    <td key={phaseKey} className="py-2 px-1">
                      <div
                        className={`flex items-center justify-center h-9 w-full min-w-[3rem] rounded-lg text-xs font-semibold transition-colors ${
                          isPro
                            ? getCellIntensity(cellCount, maxCellCount)
                            : 'bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        {isPro ? (
                          cellCount > 0 ? cellCount : <span className="text-slate-300 dark:text-slate-600">&mdash;</span>
                        ) : (
                          <LockIcon />
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="py-2 pl-3">
                  <div className="flex items-center justify-center h-9 min-w-[3rem] rounded-lg text-xs font-bold bg-navy-50 dark:bg-slate-700 text-slate-900 dark:text-white">
                    {isPro ? count : <LockIcon />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
