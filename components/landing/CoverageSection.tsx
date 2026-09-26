// Server component: the coverage panel used to fetch /api/deals/stats after
// hydration and render nothing until then. The numbers now arrive in the HTML.
import type { DealCoverageStats } from '@/lib/deal-coverage';

const TA_DISPLAY_NAMES: Record<string, string> = {
  oncology: 'Oncology', neurology: 'Neurology', immunology: 'Immunology',
  rareDisease: 'Rare Disease', cardiovascular: 'Cardiovascular', metabolic: 'Metabolic',
  infectiousDisease: 'Infectious Disease', ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology', womensHealth: "Women's Health",
  gastroenterology: 'Gastroenterology', hematology: 'Hematology',
};

const COMPANY_TYPE_DISPLAY: Array<{ key: string; label: string }> = [
  { key: 'large_pharma', label: 'Large pharma' }, { key: 'mid_pharma', label: 'Mid-sized pharma' }, { key: 'large_biotech', label: 'Large biotech' },
  { key: 'mid_biotech', label: 'Mid-sized biotech' }, { key: 'specialty', label: 'Specialty' }, { key: 'academic', label: 'Academic' },
  { key: 'government', label: 'Government' }, { key: 'nonprofit', label: 'Non-profit' }, { key: 'cro_cdmo', label: 'CRO / CDMO' },
];

const PHASE_DISPLAY: Array<{ key: string; label: string }> = [
  { key: 'discovery', label: 'Discovery' }, { key: 'preclinical', label: 'Preclinical' }, { key: 'phase_1', label: 'Phase 1' },
  { key: 'phase_2', label: 'Phase 2' }, { key: 'phase_3', label: 'Phase 3' }, { key: 'approved', label: 'Approved' },
];


function CoverageBars({ items, max }: { items: Array<{ key: string; label: string; value: number; sub?: string }>; max: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
      {items.map(item => (
        <div key={item.key} className="flex flex-col">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-100 truncate">{item.label}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-300 ml-2 tabular-nums">
              {item.value.toLocaleString()}{item.sub ? <span className="text-slate-400 dark:text-slate-400"> · {item.sub}</span> : null}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700/80 rounded-full overflow-hidden">
            <div className="h-full bg-slate-700 dark:bg-blue-400 rounded-full transition-all duration-1000" style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CoverageSection({ stats }: { stats: DealCoverageStats | null }) {
  if (!stats || stats.primary <= 0) return null;

  const taItems = Object.entries(stats.byTA)
    .filter(([ta]) => ta !== 'other' && !ta.startsWith('_') && TA_DISPLAY_NAMES[ta])
    .sort(([, a], [, b]) => b - a)
    .map(([ta, n]) => ({ key: ta, label: TA_DISPLAY_NAMES[ta], value: n }));
  const taMax = taItems[0]?.value || 1;

  const phaseItems = PHASE_DISPLAY.map(p => ({ key: p.key, label: p.label, value: stats.byPhase[p.key] ?? 0 }));
  const phaseMax = Math.max(...phaseItems.map(p => p.value), 1);

  const typeItems = COMPANY_TYPE_DISPLAY.map(t => ({ key: t.key, label: t.label, value: stats.byCompanyType?.[t.key] ?? 0 })).filter(t => t.value > 0);
  const typeMax = Math.max(...typeItems.map(t => t.value), 1);

  const years = Object.keys(stats.byYear).map(Number).filter(Number.isFinite).sort();
  const yearSpan = years.length ? `${years[0]}–${years[years.length - 1]}` : '2017–2026';
  const dealTypes = Object.keys(stats.byType).filter(t => t !== 'other' && t !== 'unknown').length;
  const headline = `${(Math.floor(stats.primary / 100) * 100).toLocaleString()}+`;

  return (
    <section className="py-8 sm:py-10 px-4 xl:px-6 bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Database Coverage</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {headline} primary-sourced transactions across {taItems.length} therapeutic areas
            </p>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
            Updated continuously from SEC EDGAR, HKEX, TDnet, ASX, SSE/SZSE, issuer wires &amp; regulatory databases
          </div>
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">By therapeutic area</div>
        <CoverageBars items={taItems} max={taMax} />

        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-6 mb-2">
          By phase at signing
        </div>
        <CoverageBars items={phaseItems} max={phaseMax} />

        {typeItems.length > 0 ? (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-6 mb-2">
              Counterparties by type · {stats.companies.toLocaleString()} organisations
            </div>
            <CoverageBars items={typeItems} max={typeMax} />
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          {[
            { label: 'Primary-Sourced Deals', value: headline },
            { label: 'Years', value: yearSpan },
            { label: 'Deal Types', value: String(dealTypes) },
            { label: 'Primary Sources', value: String(stats.sourceTypes) },
            { label: 'Organisations', value: stats.companies.toLocaleString() },
            { label: 'Countries', value: String(stats.countries) },
            { label: 'Updated', value: 'Daily' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

