import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { ENGINE_VERSION } from '@/lib/financial/calculation-version';
import { staticBenchmarks } from '@/lib/benchmarks';
import { recencyWeight } from '@/lib/financial/calibration';
import { COMP_MATCH_WEIGHTS, COMP_MAX_SCORE, MIN_POOL_BEFORE_RELAX } from '@/lib/comparable-scoring';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import type { RNPVInput } from '@/lib/financial/types';
import { getMethodologyStats, type MethodologyStats } from '@/lib/methodology-stats';
import { METHOD_COPY, DATA_LEVELS, VERIFICATION_LADDER, DATA_QUALITY_CHANGELOG } from '@/lib/financial/methodology-copy';
import type { CohortBlock } from '@/lib/financial/backtest/verified-cohort';

// Server component. Every count and every accuracy figure is computed from
// the database and the engine at request time (cached one hour), so the page
// cannot claim a number the product does not hold.
export const revalidate = 3600;

const BASE_URL = 'https://solidus.ambrosiaventures.co';

/**
 * Scenario weights are phase-dependent inside the Monte Carlo engine
 * (lib/financial/monte-carlo.ts, getScenarioConfigs). The function is not
 * exported, so we ask the engine directly with a minimal input at a tiny
 * iteration count and read the weights it reports back.
 */
function scenarioWeightsForPhase(phase: RNPVInput['phase']) {
  const rnpvInput: RNPVInput = {
    phase,
    therapeuticArea: 'oncology',
    modality: 'smallMolecule',
    indication: 'nsclc',
    territory: 'global',
    peakSalesEstimate: { low: 500, median: 1000, high: 1500 },
    competitivePosition: 'differentiated',
    dataQuality: 'standard',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  };
  const result = runMonteCarlo({ rnpvInput, iterations: 50 });
  const b = result.scenario_breakdown;
  return b ? { bear: b.bear.weight, base: b.base.weight, bull: b.bull.weight } : null;
}

const SCENARIO_STAGES: { label: string; phases: string; phase: RNPVInput['phase'] }[] = [
  { label: 'Early stage', phases: 'Discovery, preclinical, Phase 1', phase: 'preclinical' },
  { label: 'Mid stage', phases: 'Phase 1/2, Phase 2, Phase 2/3', phase: 'phase2' },
  { label: 'Late stage', phases: 'Phase 3, NDA/BLA filed, approved', phase: 'phase3' },
];

const pctLabel = (x: number) => `${Math.round(x * 100)}%`;
const pct0 = (x: number) => `${Math.round(x * 100)}%`;
const signed = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
const money = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);
const dateLabel = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
};

function SectionIcon({ path, tone }: { path: string; tone: string }) {
  return (
    <div className={`w-10 h-10 rounded-xl ${tone} flex items-center justify-center`}>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </div>
  );
}

function AccuracyRow({ label, note, block, testId }: { label: string; note?: string; block: CohortBlock; testId: string }) {
  const u = block.upfront;
  const t = block.totalDeal;
  const empty = block.n === 0;
  return (
    <tr className="border-t border-slate-200 dark:border-slate-700" data-testid={testId}>
      <td className="py-2.5 pr-4">
        <div className="font-medium text-slate-800 dark:text-slate-200">{label}</div>
        {note && <div className="text-xs text-slate-500 dark:text-slate-400">{note}</div>}
      </td>
      <td className="py-2.5 pr-4 text-right font-mono" data-testid={`${testId}-n`}>{block.n}</td>
      <td className="py-2.5 pr-4 text-right font-mono">{empty ? '0%' : pct0(u.medianAbsErrorPct)}</td>
      <td className="py-2.5 pr-4 text-right font-mono">{empty ? '0%' : signed(u.medianSignedErrorPct)}</td>
      <td className="py-2.5 pr-4 text-right font-mono">{empty ? '0%' : pct0(u.within35)}</td>
      <td className="py-2.5 pr-4 text-right font-mono">{empty ? '0%' : pct0(u.within50)}</td>
      <td className="py-2.5 pr-4 text-right font-mono">{t.n === 0 ? '0%' : pct0(t.medianAbsErrorPct)}</td>
      <td className="py-2.5 pr-4 text-right font-mono">{t.n === 0 ? '0%' : pct0(t.within35)}</td>
      <td className="py-2.5 pr-0 text-right font-mono">{t.n === 0 ? '0%' : pct0(t.within50)}</td>
    </tr>
  );
}

function jsonLd(stats: MethodologyStats | null) {
  const c = stats?.counts;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Dataset',
        '@id': `${BASE_URL}/methodology#dataset`,
        name: 'Solidus biopharma licensing and M&A transaction database',
        description: c
          ? `${c.tracked} biopharma licensing, acquisition, collaboration, option and co-development transactions${c.firstYear && c.lastYear ? ` from ${c.firstYear} to ${c.lastYear}` : ''}, ${c.sourced} with a clickable citation and ${c.verifiedCited} verified by a person against that citation.`
          : 'Biopharma licensing and M&A transactions with disclosed terms, sourced from SEC filings, press releases and regulatory databases.',
        url: `${BASE_URL}/methodology`,
        creator: { '@type': 'Organization', name: 'Ambrosia Ventures', url: 'https://ambrosiaventures.co' },
        publisher: { '@type': 'Organization', name: 'Solidus', url: BASE_URL },
        license: `${BASE_URL}/terms`,
        isAccessibleForFree: false,
        keywords: ['biopharma licensing deals', 'pharma M&A', 'upfront payments', 'milestone payments', 'royalty rates', 'deal benchmarks'],
        temporalCoverage: c?.firstYear && c?.lastYear ? `${c.firstYear}/${c.lastYear}` : undefined,
        measurementTechnique: 'SEC 8-K and 10-K filing extraction, FTC premerger filings, press-release parsing, regulatory database ingestion, human verification against the cited source',
        variableMeasured: ['upfront payment', 'development milestones', 'regulatory milestones', 'commercial milestones', 'royalty rate', 'total deal value', 'phase at signing', 'territory'],
        dateModified: stats?.measuredAt?.slice(0, 10),
      },
      {
        '@type': 'WebPage',
        '@id': `${BASE_URL}/methodology`,
        name: 'Methodology and Accuracy',
        url: `${BASE_URL}/methodology`,
        isPartOf: { '@id': `${BASE_URL}/#website` },
        about: { '@id': `${BASE_URL}/methodology#dataset` },
        dateModified: stats?.measuredAt?.slice(0, 10),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Methodology and Accuracy', item: `${BASE_URL}/methodology` },
        ],
      },
    ],
  };
}

export default async function MethodologyPage() {
  let stats: MethodologyStats | null = null;
  try {
    stats = await getMethodologyStats();
  } catch {
    stats = null;
  }

  const scenarioTable = SCENARIO_STAGES.map(s => ({ ...s, weights: scenarioWeightsForPhase(s.phase) }));
  const w24 = recencyWeight(2024, 2026);
  const w60 = recencyWeight(2021, 2026);
  const { version: benchmarksVersion, lastUpdated: benchmarksUpdated } = staticBenchmarks.metadata;

  const counts = stats?.counts;
  const acc = stats?.accuracy;
  const levelValue: Record<string, number | null> = {
    tracked: counts?.tracked ?? null,
    sourced: counts?.sourced ?? null,
    verified: counts?.verifiedCited ?? null,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(stats)) }} />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-18">
              <Link href="/" className="flex items-center">
                <AmbrosiaLogo variant="auto" height={40} />
              </Link>
              <Link href="/" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-2 rounded-lg">
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          {/* Page header */}
          <div className="mb-10 sm:mb-14">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3">How the numbers are made</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-4">Methodology and accuracy</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl">
              Where every deal comes from, what it takes for a row to count, how many rows sit at each level today, how the four valuation methods work, and how far the engine&apos;s estimates land from what verified deals actually paid. The counts and the accuracy figures below are computed from the database when this page is served, not typed in.
            </p>
            <div className="mt-5 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">
              <span>Engine <span className="font-mono text-slate-900 dark:text-white">v{ENGINE_VERSION}</span></span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>Benchmarks <span className="font-mono text-slate-900 dark:text-white">v{benchmarksVersion}</span>, updated <span className="font-mono text-slate-900 dark:text-white">{benchmarksUpdated}</span></span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>Figures measured <span className="font-mono text-slate-900 dark:text-white" data-testid="measured-at">{stats ? dateLabel(stats.measuredAt) : 'unavailable'}</span></span>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">

            {/* 1. What is in the database */}
            <section id="data">
              <div className="flex items-center gap-3 mb-4">
                <SectionIcon tone="bg-teal-50 dark:bg-teal-900/30 text-blue-700 dark:text-blue-400" path="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">What is in the database</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Three numbers describe the database honestly, and they are not the same number. Each one is defined below in one sentence, and each is counted with the same filter the product uses on that surface.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 not-prose mt-6">
                {DATA_LEVELS.map(level => (
                  <div key={level.key} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-400 font-mono" data-testid={`stat-${level.key}`}>
                      {levelValue[level.key] !== null ? levelValue[level.key]!.toLocaleString() : 'unavailable'}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{level.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{level.definition}</div>
                  </div>
                ))}
              </div>
              {counts && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                  Tracked deals span {counts.firstYear ?? '—'} to {counts.lastYear ?? '—'} across <span data-testid="stat-companies">{counts.companies.toLocaleString()}</span> distinct companies. A further <span data-testid="stat-quarantined">{counts.quarantined.toLocaleString()}</span> rows are held in quarantine or were rejected in review and appear nowhere on the site, in any benchmark, or in these counts.
                </p>
              )}

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">Where deals come from</h3>
              <p className="text-slate-600 dark:text-slate-300">Seven pipelines feed the database. Each is listed with what it is good for and what it cannot do.</p>
              <ul className="text-slate-600 dark:text-slate-300">
                <li><strong>SEC 8-K and 10-K filings.</strong> Material definitive agreements and the exhibits behind them. The most reliable source for terms, and the only one that discloses royalty tiers with any regularity. US-listed counterparties only.</li>
                <li><strong>FTC premerger notifications.</strong> Hart-Scott-Rodino filings and merger actions for transactions above the reporting threshold. Confirms that a deal closed; rarely discloses terms.</li>
                <li><strong>Press releases.</strong> Company and wire announcements, parsed for parties, asset, stage and headline economics. Fast and broad; milestone totals are often rolled up and royalties are usually undisclosed.</li>
                <li><strong>FDA and EMA records.</strong> Approvals, designations and the Orange Book. Used to date stages and confirm assets, not as a source of deal terms.</li>
                <li><strong>Clinical trial registries.</strong> Sponsor and collaborator changes on ClinicalTrials.gov that reveal partnerships before or without an announcement.</li>
                <li><strong>Web monitoring.</strong> A search-and-extract pass over conference disclosures, investor presentations and non-US announcements. Every extraction runs through a validator that rejects fabricated-looking asset names and impossible term structures before a row is written.</li>
                <li><strong>Manual curation.</strong> Landmark and historical deals entered by hand from the primary document, with the citation attached.</li>
              </ul>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">How a row earns its place</h3>
              <div className="not-prose mt-3 space-y-2">
                {VERIFICATION_LADDER.map((step, i) => (
                  <div key={step.stage} className="flex gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.stage}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">{step.meaning}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-4">
                Two rules sit underneath the ladder. A row cannot be marked verified without a citation, enforced in the database. And amended or re-announced deals are grouped, with one canonical row per transaction, so a deal that was announced, expanded and then restated counts once.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">Data-quality record</h3>
              <p className="text-slate-600 dark:text-slate-300">What we found, when, and what changed. Kept here so a reader can judge the process, not just the current count.</p>
              <div className="not-prose mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-4 font-medium whitespace-nowrap">Date</th>
                      <th className="py-2 pr-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {DATA_QUALITY_CHANGELOG.map(e => (
                      <tr key={e.date} className="border-t border-slate-200 dark:border-slate-700 align-top">
                        <td className="py-2.5 pr-4 font-mono whitespace-nowrap">{e.date}</td>
                        <td className="py-2.5 pr-4"><span className="font-medium text-slate-800 dark:text-slate-200">{e.title}.</span> {e.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 2. How the number is produced */}
            <section id="methods">
              <div className="flex items-center gap-3 mb-4">
                <SectionIcon tone="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" path="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">How a number is produced</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Four methods, each with a job it is good at and a job it is bad at. Fair value on every share page means total deal value: upfront plus milestones plus the value of the royalty stream. The share page shows the comparable range for that total as the headline, with upfront broken out, and the other methods beside it, so a reader can see where they agree and where they do not.
              </p>
              <div className="not-prose mt-6 space-y-4">
                {METHOD_COPY.map(m => (
                  <div key={m.key} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5" data-testid={`method-${m.key}`}>
                    <div className="text-base font-semibold text-slate-900 dark:text-white">{m.name}</div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{m.what}</p>
                    <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
                      <div><div className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-1">Good at</div><div className="text-slate-600 dark:text-slate-300">{m.goodAt}</div></div>
                      <div><div className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-1">Weak at</div><div className="text-slate-600 dark:text-slate-300">{m.weakAt}</div></div>
                      <div><div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">When it leads</div><div className="text-slate-600 dark:text-slate-300">{m.whenItLeads}</div></div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">Comparable matching, exactly</h3>
              <p className="text-slate-600 dark:text-slate-300">
                Comparable transactions are ranked with an additive match score. Each candidate earns points for every dimension it shares with your asset, and the top-scoring deals become the set. The weights below are read from the scoring code at render time.
              </p>
              <div className="not-prose mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-4 font-medium">Dimension</th>
                      <th className="py-2 pr-4 text-right font-medium">Points</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {[
                      ['Same therapeutic area', COMP_MATCH_WEIGHTS.ta],
                      ['Same clinical phase', COMP_MATCH_WEIGHTS.phase],
                      ['Adjacent phase (±1 step)', COMP_MATCH_WEIGHTS.adjacentPhase],
                      ['Same modality', COMP_MATCH_WEIGHTS.modality],
                      ['Same indication', COMP_MATCH_WEIGHTS.indication],
                      ['Same deal structure', COMP_MATCH_WEIGHTS.dealType],
                      ['Recency (current year full points, prior year half)', COMP_MATCH_WEIGHTS.recency],
                      ['Verified against a primary source', COMP_MATCH_WEIGHTS.verified],
                    ].map(([label, pts]) => (
                      <tr key={String(label)} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-2 pr-4">{label}</td>
                        <td className="py-2 pr-4 text-right font-mono">{pts}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-300 dark:border-slate-600 font-semibold">
                      <td className="py-2 pr-4">Maximum score</td>
                      <td className="py-2 pr-4 text-right font-mono">{COMP_MAX_SCORE}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                A deal must share your therapeutic area and at least one of phase, adjacent phase, or indication to qualify. If fewer than {MIN_POOL_BEFORE_RELAX} deals qualify, the filter relaxes to therapeutic area plus modality, then therapeutic area alone, and the panel says which rung was used. Statistics are recency-weighted: each deal&apos;s weight is 0.5 raised to (years since signing ÷ 2.5), so a deal signed 24 months ago carries {w24.toFixed(2)}× the weight of one signed this year and a deal from five years ago carries {w60.toFixed(2)}×.
              </p>

              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">Monte Carlo scenario weights</h3>
              <p className="text-slate-600 dark:text-slate-300">
                Each of the 10,000 runs first draws a bear, base or bull scenario and then samples around it. The weights depend on stage and are read from the engine at render time.
              </p>
              <div className="not-prose mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-4 font-medium">Stage</th>
                      <th className="py-2 pr-4 text-right font-medium">Bear</th>
                      <th className="py-2 pr-4 text-right font-medium">Base</th>
                      <th className="py-2 pr-4 text-right font-medium">Bull</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 dark:text-slate-300">
                    {scenarioTable.map(row => (
                      <tr key={row.label} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{row.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{row.phases}</div>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono">{row.weights ? pctLabel(row.weights.bear) : '0%'}</td>
                        <td className="py-2 pr-4 text-right font-mono">{row.weights ? pctLabel(row.weights.base) : '0%'}</td>
                        <td className="py-2 pr-4 text-right font-mono">{row.weights ? pctLabel(row.weights.bull) : '0%'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. How accurate it is */}
            <section id="accuracy">
              <div className="flex items-center gap-3 mb-4">
                <SectionIcon tone="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">How accurate it is</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                The engine is run against every verified deal with a citation, using only what a user would know before the deal: therapeutic area, indication, stage, modality, structure and territory. Its median upfront and total deal value are compared to what was actually paid. A hit means the estimate landed within the band of the actual number. Figures are unweighted, there is no held-out split, and small groups are shown as small groups.
              </p>
              {acc ? (
                <>
                  <div className="not-prose mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                    <span>Cohort: <span className="font-semibold text-slate-800 dark:text-slate-200">verified with a citation</span></span>
                    <span>Eligible: <span className="font-mono" data-testid="acc-eligible">{acc.eligible}</span></span>
                    <span>Scored: <span className="font-mono" data-testid="acc-scored">{acc.scored}</span></span>
                    <span>Engine: <span className="font-mono">v{acc.engineVersion}</span></span>
                    <span>Measured: <span className="font-mono">{dateLabel(acc.runAt)}</span></span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Eligible rows that are not scored have a stage or structure the engine does not model, an undisclosed total, or an upfront under $20M, which the backtest excludes because percentage error on very small upfronts is not informative.
                  </p>
                  <div className="not-prose mt-4 overflow-x-auto">
                    <table className="w-full text-sm" data-testid="accuracy-table">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-4 font-medium">Group</th>
                          <th className="py-2 pr-4 text-right font-medium">n</th>
                          <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Upfront median |error|</th>
                          <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Upfront median bias</th>
                          <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Upfront within ±35%</th>
                          <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Upfront within ±50%</th>
                          <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Total median |error|</th>
                          <th className="py-2 pr-4 text-right font-medium whitespace-nowrap">Total within ±35%</th>
                          <th className="py-2 pr-0 text-right font-medium whitespace-nowrap">Total within ±50%</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AccuracyRow label="All scored deals" block={acc.all} testId="acc-all" />
                        <AccuracyRow label="Core scope" note="Phase 2, 2/3 and 3 licensing and co-development, where the rNPV method is designed to work" block={acc.coreScope} testId="acc-core" />
                        <AccuracyRow label="Early stage" note="Discovery, preclinical, Phase 1, Phase 1/2" block={acc.byPhaseBucket.early} testId="acc-early" />
                        <AccuracyRow label="Mid stage" note="Phase 2, Phase 2/3" block={acc.byPhaseBucket.mid} testId="acc-mid" />
                        <AccuracyRow label="Late stage" note="Phase 3, filed, approved" block={acc.byPhaseBucket.late} testId="acc-late" />
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Bias is the median signed error: positive means the engine estimated high, negative means low.
                  </p>

                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">What these figures mean</h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    Read plainly: on this cohort the rNPV-derived point estimate for upfront is not reliable on its own. It runs low on early-stage deals, where buyers pay for optionality the method does not see, and high on some late-stage ones. That is why the comparable range for total deal value is the headline on every share page and the rNPV figure sits beside it as one method among four, and why the early-stage rNPV is floored at the comparable range. The figures above will move as the verified cohort grows and as the engine changes, and they are recomputed every time this page is served, so a lower number here is a finding, not a typo.
                  </p>
                  {acc.worst.length > 0 && (
                    <>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8">Largest misses on upfront</h3>
                      <p className="text-slate-600 dark:text-slate-300">The five deals the engine got most wrong, shown because they say more about the method&apos;s limits than the averages do.</p>
                      <div className="not-prose mt-3 overflow-x-auto">
                        <table className="w-full text-sm" data-testid="worst-table">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              <th className="py-2 pr-4 font-medium">Deal</th>
                              <th className="py-2 pr-4 font-medium">Stage</th>
                              <th className="py-2 pr-4 text-right font-medium">Actual upfront</th>
                              <th className="py-2 pr-4 text-right font-medium">Engine</th>
                              <th className="py-2 pr-0 text-right font-medium">Error</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-700 dark:text-slate-300">
                            {acc.worst.map(w => (
                              <tr key={w.id} className="border-t border-slate-200 dark:border-slate-700">
                                <td className="py-2 pr-4">{w.licensor} to {w.licensee} <span className="text-slate-400">({w.year})</span></td>
                                <td className="py-2 pr-4 font-mono text-xs">{w.phase}</td>
                                <td className="py-2 pr-4 text-right font-mono">{money(w.actualUpfront_M)}</td>
                                <td className="py-2 pr-4 text-right font-mono">{money(w.predictedUpfront_M)}</td>
                                <td className="py-2 pr-0 text-right font-mono">{signed(w.errorPct)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                    A broader diagnostic against a larger snapshot that includes high-confidence pending rows, with a held-out split and calibration history, is on <Link href="/accuracy" className="underline">/accuracy</Link>. The figures there are not comparable to the table above because that snapshot is not limited to verified rows. The raw figures on this page are available as JSON at <code className="text-xs">/api/methodology/stats</code>.
                  </p>
                </>
              ) : (
                <p className="text-slate-600 dark:text-slate-300" data-testid="accuracy-unavailable">
                  The live accuracy figures could not be computed when this page was served. They are available at <code className="text-xs">/api/methodology/stats</code> once the database is reachable.
                </p>
              )}
            </section>

            {/* 4. Reproduce it */}
            <section id="reproduce">
              <div className="flex items-center gap-3 mb-4">
                <SectionIcon tone="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white !mt-0 !mb-0">Reproduce any number</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Every shared calculation carries a provenance strip: the engine version, a fingerprint of the inputs, the benchmark data version and date, and the size and date of the calibration it ran on. Two people running the same inputs on the same engine version get the same fingerprint and the same numbers. When the engine or the data change, the version on the strip changes with them, so an old share page says which engine produced it.
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Ranges are ranges. They describe where similar deals have landed, not what any one negotiation will produce. For a term sheet, pair them with the counterparty, the clinical data and the IP, which is the work the advisory side of Ambrosia exists to do.
              </p>
            </section>
          </div>

          <div className="mt-16 text-center">
            <Link href="/calculator" className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg">
              Run a benchmark
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
