import { Metadata } from 'next';
import Link from 'next/link';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { IntelligenceEmailCapture } from '@/components/intelligence/IntelligenceEmailCapture';
import { LiveAccuracyDashboard } from '@/components/methodology/LiveAccuracyDashboard';
import { FailureCaseExplorer } from '@/components/methodology/FailureCaseExplorer';
import { DimensionExplorer } from '@/components/methodology/DimensionExplorer';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Engine Methodology | Ambrosia Benchmarker',
  description:
    'Technical methodology for the Ambrosia rNPV engine — 14 modeling dimensions, calibration framework, held-out validation, honest limitations. For BD professionals and buy-side analysts who need a defensible model.',
  alternates: { canonical: `${BASE_URL}/methodology/engine` },
  openGraph: {
    title: 'Engine Methodology | Ambrosia Benchmarker',
    description: '14 modeling dimensions, Option B rigor, held-out validation, honest limitations.',
    type: 'article',
    url: `${BASE_URL}/methodology/engine`,
    siteName: 'Ambrosia Benchmarker',
    images: [
      {
        url: '/api/og?title=Engine%20Methodology&subtitle=Finance-grade%20technical%20doc',
        width: 1200,
        height: 630,
        alt: 'Ambrosia engine methodology',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Engine Methodology | Ambrosia Benchmarker',
    description: '14 dimensions, Option B rigor, held-out validation, honest limitations.',
  },
};

function SectionAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="group mt-10 scroll-mt-20 text-xl font-semibold text-slate-100">
      <Link href={`#${id}`} className="no-underline">
        {children}
        <span className="ml-2 text-slate-700 opacity-0 transition-opacity group-hover:opacity-100">
          #
        </span>
      </Link>
    </h2>
  );
}

export default function EngineMethodology() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/methodology/engine" />
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Engine Methodology
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            A finance-grade walkthrough of the Ambrosia rNPV engine: how it values assets, how
            calibration works, and where the model is honestly not ready. Written for BD teams,
            buy-side analysts, and pharma finance professionals who need a model they can stand up
            to their investment committee.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <Link
              href="/playbook"
              className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900"
            >
              Counterparty playbooks →
            </Link>
            <Link
              href="/trade-space"
              className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-slate-300 hover:bg-slate-900"
            >
              Deal-structure trade space →
            </Link>
          </div>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-6 py-12 text-base leading-relaxed text-slate-300">

        <SectionAnchor id="overview">1. What the engine computes</SectionAnchor>
        <p className="mt-4">
          The engine takes a pharmaceutical asset profile and produces a risk-adjusted net
          present value (rNPV) plus an implied deal value decomposition (upfront, milestones,
          royalties). It is calibrated to Phase 2 / Phase 3 licensing and co-development deals
          — the segment where intrinsic-value modeling matches how real negotiations anchor.
          Early-stage strategic upfronts, acquisitions, and approved-asset commercialization
          handoffs are explicitly out of scope (see{' '}
          <Link href="#limitations" className="text-cyan-400 hover:text-cyan-300">limitations</Link>).
        </p>

        <SectionAnchor id="dimensions">2. Fourteen modeling dimensions</SectionAnchor>
        <p className="mt-4">
          Modern biopharma deal valuation cannot be reduced to a single rNPV number. The
          Ambrosia engine composes fourteen independently-calibrated dimensions, each one a
          distinct correction to the simplistic &ldquo;peak sales &times; PoS &times; discount
          rate&rdquo; frame:
        </p>
        <ol className="mt-4 space-y-2 pl-5 [&_li]:list-decimal [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li><strong className="text-slate-200">rNPV core.</strong> Phase-transition probabilities &times; peak sales &times; discount rate &times; market-access delay, summed over projected cash flows.</li>
          <li><strong className="text-slate-200">Monte Carlo.</strong> 10,000-path simulation with phase-dependent correlation matrix, conditional floors, and fat-tailed peak sales distribution.</li>
          <li><strong className="text-slate-200">Real options.</strong> CRR binomial-lattice overlay for early-stage assets where compound options dominate intrinsic NPV.</li>
          <li><strong className="text-slate-200">Ensemble valuation.</strong> Inverse-variance blend of rNPV, comparable-transaction median, and real-options value — headline number robust to method-specific bias.</li>
          <li><strong className="text-slate-200">Deal structure optimizer.</strong> Runs all five deal types (licensing, acquisition, codev, option, collaboration), ranks by total value to licensor, surfaces a recommendation only when &ge;20% better than current.</li>
          <li><strong className="text-slate-200">Counterparty premiums.</strong> Per-buyer historical premium vs. peer medians across 39 large buyers (quarterly refresh from disclosed deals).</li>
          <li><strong className="text-slate-200">RWE auto-tuning.</strong> Weekly backtest against 164 approved-drug trajectories produces bounded (&plusmn;15%) delta proposals for key calibration parameters.</li>
          <li><strong className="text-slate-200">Risk decomposition.</strong> 4-bucket attribution (clinical, commercial, manufacturing, regulatory) via counterfactual re-runs with each risk source neutralized.</li>
          <li><strong className="text-slate-200">Macro factors.</strong> Live 10Y Treasury yield, biotech beta, equity risk premium (daily FRED refresh), clamped so final WACC stays in [5%, 25%].</li>
          <li><strong className="text-slate-200">Subpopulation modeling.</strong> Mutation status, demographic, severity — 31 evidence-cited entries (FDA labels, IQVIA 2024-2025).</li>
          <li><strong className="text-slate-200">Patent cliff timing.</strong> Per-indication market-leader LOE + biosimilar dates, mapped to the asset&rsquo;s projected launch year.</li>
          <li><strong className="text-slate-200">Combination therapy.</strong> Effective revenue multiplier when the asset is used in a combo regimen (comboFraction &times; revenueShare, floored at 0.25).</li>
          <li><strong className="text-slate-200">Geographic decomposition.</strong> US / EU5 / Japan / China / RoW revenue curves with per-geo launch delay, ramp, and pricing multiplier.</li>
          <li><strong className="text-slate-200">Time-windowed PoS.</strong> Rolling cohort phase-transition rates (2014-2024, 2019-2024, 2021-2024) for indications where PoS has shifted materially (Alzheimer&rsquo;s, NASH, obesity).</li>
        </ol>
        <p className="mt-4">
          Dimensions 1-4 always run. Dimensions 5-14 are opt-in via calculator inputs or feature
          flags — default off until backtest validates each one individually.
        </p>

        <DimensionExplorer />

        <SectionAnchor id="calibration">3. Calibration framework (Option B rigor)</SectionAnchor>
        <p className="mt-4">
          Most engines publish source citations and call it rigor. Ours does both that AND
          measures accuracy empirically. The discipline we follow:
        </p>
        <ul className="mt-4 space-y-2 pl-5 [&_li]:list-disc [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li>
            <strong className="text-slate-200">Empirical filter first.</strong> A change ships only if it improves
            measured accuracy against real disclosed deals. Source citations justify the direction; the backtest
            validates the magnitude.
          </li>
          <li>
            <strong className="text-slate-200">One-sided corrections beat symmetric scaling.</strong> Our failed
            rounds taught us that per-indication scaling that can go both up and down tends to
            increase dispersion. Floor-only and ceiling-only corrections, applied to specific
            failure modes, work.
          </li>
          <li>
            <strong className="text-slate-200">Held-out validation split.</strong> 80% of the corpus is used to
            tune; 20% is held out as a test set the engine never sees during calibration. Deterministic hash on
            deal id means the split is stable across runs.
          </li>
          <li>
            <strong className="text-slate-200">Every change cited.</strong> FDA CDER approval reports, Wong/Siah/Lo
            2019 biostatistics paper, Nature Reviews Drug Discovery 2024-2025, DealForma deal database, company
            10-K filings. When a calibration value can&rsquo;t be sourced externally, we cite the backtest itself
            as empirical source.
          </li>
          <li>
            <strong className="text-slate-200">Regression discipline.</strong> The full golden master test suite
            (110 baselines across therapeutic areas &times; phases &times; modalities) must stay green or be
            intentionally re-baselined with documentation. Silent drift is treated as a bug.
          </li>
        </ul>

        <SectionAnchor id="accuracy">4. Accuracy measurement</SectionAnchor>
        <p className="mt-4">
          We score the engine&rsquo;s predicted implied deal value against real disclosed terms
          from 251 biopharma licensing, co-development, acquisition, and collaboration deals
          (2017&ndash;2026). For each deal, the engine is fed the asset profile known at deal
          date and computes an implied upfront. The hit rate is the share of deals where the
          absolute error falls within a tolerance band.
        </p>
        <p className="mt-4">
          <strong className="text-slate-200">Core scope</strong> (Phase 2 / 3 licensing + codev,
          n=69) is the primary calibration target &mdash; the segment where intrinsic-value
          modeling maps onto market clearing price. <strong className="text-slate-200">Full
          scope</strong> (all 251) is reported for transparency but includes segments (early-
          stage option value, approved commercialization) where single-asset rNPV is structurally
          the wrong frame.
        </p>
        <p className="mt-4">
          Accuracy is measured on every calibration round against the held-out test set. We track
          failed rounds alongside wins in the internal iteration log &mdash; the calibration
          journey itself is part of the model&rsquo;s methodology.
        </p>

        <LiveAccuracyDashboard />
        <FailureCaseExplorer />

        <SectionAnchor id="limitations">5. Honest limitations</SectionAnchor>
        <p className="mt-4">The model is not ready for:</p>
        <ul className="mt-4 space-y-3 pl-5 [&_li]:list-disc [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li>
            <strong className="text-slate-200">Early-stage strategic upfronts.</strong> Phase 1 / preclinical
            licensing prices on option value, not expected NPV. The engine&rsquo;s intrinsic-value output
            will be too low; we apply empirical floors at the backtest level, but the underlying rNPV math
            isn&rsquo;t the right frame. Use for anchoring only, not as a primary number.
          </li>
          <li>
            <strong className="text-slate-200">Acquisitions in competitive bidding.</strong> M&amp;A premiums
            are auction-driven. Carmot/Roche, Inversago/Novo, Pandion/Merck priced at 10&ndash;30&times; NPV.
            The engine can&rsquo;t predict auction dynamics.
          </li>
          <li>
            <strong className="text-slate-200">Post-approval commercialization handoffs.</strong> Approved-asset
            licenses to territorial partners (Pharming&rarr;CSPC China, Epizyme&rarr;Ipsen ex-US) load most
            value into royalties + milestones, not upfront. The backtest applies a territorial dampener but
            the engine&rsquo;s upfront formula is structurally biased for this segment.
          </li>
          <li>
            <strong className="text-slate-200">Platform / multi-asset deals.</strong> Single-asset rNPV cannot
            price a bundle with a platform premium. Upcoming portfolio-rNPV extension will address this.
          </li>
          <li>
            <strong className="text-slate-200">Non-cash consideration.</strong> Equity, warrants, and future
            contingent consideration (CVRs) are not modeled. These appear as disclosed deal value in the
            backtest but the engine&rsquo;s predicted value is cash-upfront equivalent.
          </li>
          <li>
            <strong className="text-slate-200">Unusual therapeutic areas.</strong> Rare diseases with fewer than
            3 comparable deals in our corpus, or deals in emerging modalities (ADCs pre-2020, PROTACs through
            2023), have thin priors. Confidence bands widen accordingly.
          </li>
        </ul>

        <SectionAnchor id="architecture">6. Software architecture</SectionAnchor>
        <p className="mt-4">
          The engine has a five-layer bug-detection system designed to prevent silent drift:
        </p>
        <ul className="mt-4 space-y-2 pl-5 [&_li]:list-disc [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li><strong className="text-slate-200">Layer 1 &mdash; Mathematical invariants.</strong> Assertions that NPV cannot exceed unadjusted NPV, cumulative PoS stays in [0, 1], etc. Violations log to Sentry but never throw (production safe).</li>
          <li><strong className="text-slate-200">Layer 2 &mdash; Cross-engine consistency.</strong> rNPV median vs. Monte Carlo p50 vs. ensemble headline must agree within documented tolerances. Divergence generates a surfaced warning.</li>
          <li><strong className="text-slate-200">Layer 3 &mdash; Indication regression tests.</strong> 36 curated test cases anchor each therapeutic area &times; phase &times; modality combination to an expected output range.</li>
          <li><strong className="text-slate-200">Layer 4 &mdash; Data-quality guardrails.</strong> Peak sales exceeding 80% of total addressable market triggers a hard cap; competitive density exceeding market-leader peak triggers a warning.</li>
          <li><strong className="text-slate-200">Layer 5 &mdash; Golden masters.</strong> 110 canonical reference calculations with tolerance-based assertions. Any intentional change requires explicit re-baselining with a documented rationale.</li>
        </ul>

        <SectionAnchor id="reproducing">7. Reproducing the backtest</SectionAnchor>
        <p className="mt-4">
          The full backtest is reproducible in the open-source repo:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          <code>{`# Clone and install
git clone github.com/ikildani/ambrosia-benchmarker-
cd ambrosia-benchmarker && npm install

# Run baseline
npx tsx scripts/run-deal-backtest.ts

# A/B test individual flags
TIER4_MACRO=on npx tsx scripts/run-deal-backtest.ts
TIER4_SUBPOP=on npx tsx scripts/run-deal-backtest.ts

# Per-round calibration diff
git diff __tests__/backtest/baseline-errors.json`}</code>
        </pre>
        <p className="mt-4">
          Every commit to <code className="rounded bg-slate-800 px-1 py-0.5 text-sm">__tests__/backtest/baseline-errors.json</code> is
          the live accuracy state read by the internal accuracy tracking system.
        </p>

        <SectionAnchor id="governance">8. Model governance</SectionAnchor>
        <p className="mt-4">
          For regulated users (banks, asset managers subject to SR 11-7), we treat the model like a model:
        </p>
        <ul className="mt-4 space-y-2 pl-5 [&_li]:list-disc [&_li]:text-slate-400 [&_li::marker]:text-slate-600">
          <li>Every calibration round is a discrete, auditable commit in the git history with before/after numbers in the commit message.</li>
          <li>Failed rounds are preserved in the git history and internal iteration log rather than rewritten out.</li>
          <li>The iteration log at <code className="rounded bg-slate-800 px-1 py-0.5 text-sm">docs/calibration-iteration-log.md</code> captures the rationale, source citations, and deltas for every change.</li>
          <li>Golden master regressions require explicit re-baselining with documentation &mdash; silent drift is caught by the test suite.</li>
        </ul>

        <div className="mt-12 rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
          <p className="text-slate-200">Questions, critique, or your own backtest?</p>
          <p className="mt-2">
            We welcome rigorous challenge. Email <code className="rounded bg-slate-800 px-1 py-0.5">issa@ambrosiaventures.co</code> with
            a deal you think we got wrong, and we&rsquo;ll include it in the next calibration round with the reason documented
            in the iteration log.
          </p>
        </div>
      </article>

      <div className="mx-auto max-w-4xl px-6 pb-12">
        <IntelligenceEmailCapture context="methodology" />
      </div>

      <SiteFooter />
    </main>
  );
}
