import Link from 'next/link';
import { LIVE_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

interface Props {
  isAuthenticated: boolean;
  /** An activated backtest stands behind the live score; the copy only claims it when true. */
  backtested?: boolean;
  /** Opens the sign-up modal in place; without it the CTA links to the sign-in page. */
  onSignUp?: () => void;
}

/**
 * Shown to signed-out and free-tier visitors. Illustrative rows only: the
 * feed API is Pro-gated, so the rows below are layout examples, not live
 * assets, and the copy says so. Scores are hidden rather than invented.
 */
const SAMPLE_ROWS: { asset: string; owner: string; country: string; phase: string; modality: string; area: string; rights: string }[] = [
  { asset: 'Example asset', owner: 'Originator company', country: 'US', phase: 'P2', modality: 'ADC', area: 'Oncology · HER2-low breast', rights: 'Global' },
  { asset: 'Example asset', owner: 'Originator company', country: 'KR', phase: 'P1/2', modality: 'Bispecific', area: 'Oncology · NSCLC', rights: 'Ex-Asia' },
  { asset: 'Example asset', owner: 'Academic centre', country: 'CH', phase: 'P2', modality: 'Small molecule', area: "Neurology · Parkinson's", rights: 'Global' },
  { asset: 'Example asset', owner: 'Originator company', country: 'JP', phase: 'P3', modality: 'mAb', area: 'Immunology · atopic dermatitis', rights: 'Ex-Japan' },
  { asset: 'Example asset', owner: 'Originator company', country: 'GB', phase: 'P2', modality: 'Gene therapy', area: 'Rare disease', rights: 'Global' },
  { asset: 'Example asset', owner: 'Originator company', country: 'DE', phase: 'P1', modality: 'Peptide', area: 'Metabolic · obesity', rights: 'Ex-EU' },
];

const CTA =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950';

export function RadarUpgradeGate({ isAuthenticated, backtested = false, onSignUp }: Props) {
  const deals = formatDealCount(LIVE_DEAL_COUNT);
  const scoreBody = backtested
    ? 'Nine factors, each with the source it came from and a confidence figure, shown as a percentile within the asset\'s peers. Backtested against announced deals; the methodology page shows the numbers.'
    : 'Nine factors, each with the source it came from and a confidence figure, shown as a percentile within the asset\'s peers. The backtest is in progress; the methodology page shows current results.';
  return (
    <main className="min-h-screen bg-neutral-50 pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Pro and Portfolio
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Asset Radar</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          A ranked list of clinical-stage programs that look likely to change hands. Built from trial registries in the
          US, Europe, China, Japan and Korea, resolved to the owning company, and scored on the evidence we can actually
          find: cash position, hiring, filings, management language, trial status. Predicted terms come from the same{' '}
          {deals} verified deals behind the Solidus benchmarks, with the comps shown.
        </p>

        {/* Sample table */}
        <div className="mt-8 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-4 py-2 text-[11px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
            Illustrative rows. Live assets, scores and 30-day movement show after upgrade.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  <th scope="col" className="px-4 py-2">Score</th>
                  <th scope="col" className="px-4 py-2">Asset</th>
                  <th scope="col" className="px-4 py-2">Owner</th>
                  <th scope="col" className="px-4 py-2">Phase</th>
                  <th scope="col" className="px-4 py-2">Modality</th>
                  <th scope="col" className="px-4 py-2">Area</th>
                  <th scope="col" className="px-4 py-2">Rights</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ROWS.map((r, i) => (
                  <tr
                    key={`${r.country}-${r.modality}-${i}`}
                    aria-hidden={i >= 3 || undefined}
                    className={`border-t border-neutral-100 dark:border-neutral-800 ${i >= 3 ? 'select-none blur-[3px]' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-neutral-500">••</td>
                    <td className="px-4 py-3 font-medium">{r.asset}</td>
                    <td className="px-4 py-3">
                      {r.owner}{' '}
                      <span className="rounded border border-neutral-300 px-1 font-mono text-[11px] text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">{r.country}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.phase}</td>
                    <td className="px-4 py-3 text-xs">{r.modality}</td>
                    <td className="px-4 py-3 text-xs">{r.area}</td>
                    <td className="px-4 py-3 text-xs">{r.rights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* What you get */}
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <Item title="Mandate-first feed" body="Save what you are looking for once. The feed becomes that mandate's ranked matches and flags new ones." />
          <Item title="Licensing intent score, with its evidence" body={scoreBody} />
          <Item title="Predicted terms with comps" body={`Upfront, total and royalty ranges for each asset, from ${deals} verified transactions. When there are too few comps, it says so instead of guessing.`} />
          <Item title="Facets, compare, export" body="Region, country, phase, modality, target, owner type and partnership status with counts. Compare up to five side by side." />
        </dl>

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium">
              {isAuthenticated ? 'Asset Radar is included in Pro and Portfolio plans.' : 'Start a Pro trial to open the feed.'}
            </p>
            <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {isAuthenticated
                ? `Pro also covers every engine and all ${deals} deal comps.`
                : 'Sign up and you get seven days of Pro. No card.'}
            </p>
          </div>
          {isAuthenticated ? (
            <Link href="/pro" className={CTA}>Upgrade to Pro</Link>
          ) : onSignUp ? (
            <button type="button" onClick={onSignUp} className={CTA}>Start free trial</button>
          ) : (
            <Link href="/auth/signin" className={CTA}>Start free trial</Link>
          )}
        </div>
      </section>
    </main>
  );
}

function Item({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <dt className="text-sm font-semibold">{title}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{body}</dd>
    </div>
  );
}
