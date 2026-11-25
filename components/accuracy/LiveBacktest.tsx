import type { BacktestSummary, GroupStats } from '@/lib/backtest/terms-backtest-core';

const PHASE_ORDER = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3'];
const PHASE_LABEL: Record<string, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase1: 'Phase 1', phase1_2: 'Phase 1/2', phase2: 'Phase 2',
  phase2_3: 'Phase 2/3', phase3: 'Phase 3',
};
const TERRITORY_LABEL: Record<string, string> = {
  global: 'Worldwide rights', china: 'Greater China', japan: 'Japan', europe: 'Europe', us_only: 'United States',
  us_eu: 'US + Europe', ex_us: 'Outside the US', south_korea: 'South Korea', australia: 'Australia / NZ',
  latam: 'Latin America', mena: 'Middle East & North Africa', canada: 'Canada',
};
/** Groups smaller than this are shown but flagged: one or two deals say little. */
const SMALL = 10;

export const typicalMiss = (g: GroupStats) => Math.exp(g.mdaeLog);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const times = (x: number) => `${x.toFixed(1)}×`;

export function formatRunDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** Plain-English direction of the middle deal's calculator / paid ratio. */
function direction(ratio: number): string {
  if (ratio >= 1.15) return `runs ${Math.round((ratio - 1) * 100)}% high`;
  if (ratio <= 0.87) return `runs ${Math.round((1 - ratio) * 100)}% low`;
  return 'about level';
}

function BreakdownTable({ title, rows }: { title: string; rows: Array<[string, GroupStats]> }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-normal">Group</th>
              <th className="px-4 py-3 text-right font-normal">Deals</th>
              <th className="px-4 py-3 text-right font-normal">Within 2×</th>
              <th className="px-4 py-3 text-right font-normal">Typical miss</th>
              <th className="px-4 py-3 text-right font-normal">Middle deal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map(([label, g]) => (
              <tr key={label} className={g.n < SMALL ? 'text-slate-500' : 'text-slate-200'}>
                <td className="px-4 py-3">
                  {label}
                  {g.n < SMALL && <span className="ml-2 text-[11px] text-slate-600">small sample</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono">{g.n}</td>
                <td className="px-4 py-3 text-right font-mono">{pct(g.within2x)}</td>
                <td className="px-4 py-3 text-right font-mono">{times(typicalMiss(g))}</td>
                <td className="px-4 py-3 text-right font-mono">{g.medianRatio.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The live-deal backtest (data/backtest/terms-backtest-baseline.json, written by scripts/terms-backtest.ts from the
 * committed snapshot of verified deals). Numbers are shown as measured.
 */
export function LiveBacktest({ summary }: { summary: BacktestSummary }) {
  const o = summary.overall;
  const phases = PHASE_ORDER.filter((p) => summary.byPhase[p]).map((p) => [PHASE_LABEL[p] ?? p, summary.byPhase[p]] as [string, GroupStats]);
  const territories = Object.entries(summary.byTerritory)
    .sort(([, a], [, b]) => b.n - a.n)
    .map(([t, g]) => [TERRITORY_LABEL[t] ?? t, g] as [string, GroupStats]);
  const from = summary.window.from.slice(0, 7);
  const to = summary.window.to.slice(0, 7);

  return (
    <section id="live-backtest" className="border-b border-slate-800/60 bg-teal-500/5">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-semibold text-slate-100">How close the calculator gets to real upfronts</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          We priced {o.n} real licensing deals with the deal-terms calculator and compared each result with the upfront
          the licensee actually paid. Run {formatRunDate(summary.generatedAt)}, on verified deals announced {from} to {to}.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-teal-500/40 bg-teal-500/10 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-300">Share within 2× of the upfront actually paid</div>
            <div className="mt-2 font-mono text-4xl font-bold text-teal-200">{pct(o.within2x)}</div>
            <div className="mt-1 text-xs text-slate-400">
              {Math.round(o.within2x * o.n)} of {o.n} deals priced between half and double the real upfront
            </div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Typical miss</div>
            <div className="mt-2 font-mono text-4xl font-bold text-slate-100">{times(typicalMiss(o))}</div>
            <div className="mt-1 text-xs text-slate-400">half of deals land closer than this factor, half further, either direction</div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Middle deal</div>
            <div className="mt-2 font-mono text-4xl font-bold text-slate-100">{o.medianRatio.toFixed(2)}×</div>
            <div className="mt-1 text-xs text-slate-400">calculator ÷ upfront paid for the middle deal: the calculator {direction(o.medianRatio)}</div>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-sm text-slate-400">
          Read these as a floor, not a ceiling. The backtest gives the calculator only a deal&rsquo;s stage, therapeutic
          area, modality, territory and deal type; everything a user would add (indication, data quality, competition,
          line of therapy, designations) is left at its default. Upfronts for similar-looking assets genuinely differ by
          10× or more, so a single number will often miss; the range and the comparable deals on the results page are
          the better guide.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <BreakdownTable title="By stage at signing" rows={phases} />
          <BreakdownTable title="By territory licensed" rows={territories} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          &ldquo;Middle deal&rdquo; is the calculator&rsquo;s figure divided by the upfront paid, for the middle deal of
          each group: above 1 the calculator runs high, below 1 it runs low. Groups under {SMALL} deals are greyed out.
        </p>

        <div id="method" className="mt-10 rounded-lg border border-slate-800 bg-slate-900/30 p-6">
          <h3 className="text-base font-semibold text-slate-100">Method, in plain English</h3>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">
            <p>
              <span className="text-slate-200">Which deals.</span> Licenses, collaborations and options from our verified
              deal table announced {from} to {to} with a disclosed upfront payment, and only those backed by a primary
              source: a regulatory filing or the company&rsquo;s own press release. Duplicates, unverified and flagged
              rows are excluded. A deal is priced only when its stage, area, modality and territory map onto the
              calculator&rsquo;s options; carve-outs such as &ldquo;worldwide except China&rdquo; are left out rather
              than forced into the wrong territory.
            </p>
            <p>
              <span className="text-slate-200">How each deal is priced.</span> With today&rsquo;s benchmark tables,
              including the calibration from recent deals, and default values for every factor the deal record does not
              tell us. The calculator has not been tuned to these deals one by one.
            </p>
            <p>
              <span className="text-slate-200">What we report.</span> The share of deals the calculator priced within 2×
              of the upfront actually paid, the typical miss (the middle of all misses, measured as a factor so that
              double and half count the same), and the calculator-to-paid ratio of the middle deal.
            </p>
            <p>
              <span className="text-slate-200">How it is protected.</span> The deals and calibration used here are frozen
              in a snapshot in our code repository. Every proposed change to the calculator re-runs this backtest
              automatically and is blocked if the share within 2× falls by more than one percentage point or the
              typical miss widens by more than about 2%. The snapshot is refreshed monthly and every refresh is reviewed before it lands.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
