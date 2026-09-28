'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { hasProAccess } from '@/types/tier';
import { RadarPageFrame } from '@/components/radar/RadarPageFrame';

interface Faq { question: string; answer: string }

const CTA =
  'inline-flex shrink-0 items-center justify-center rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/20 hover:bg-teal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950';
const CTA_SECONDARY =
  'inline-flex shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-2.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:ring-offset-neutral-950';

const STEPS = [
  { n: '1', title: 'Say what you buy', body: 'A mandate is your criteria: therapeutic areas, modalities, phase range, geography, partnership status, minimum scores. Start from a template (mid-cap oncology in-licensing, Japanese pharma seeking ex-Asia rights, China-forward buyer) or from a filter set you like.' },
  { n: '2', title: 'Read the ranked list', body: 'Every program shows its owner, phase, indication, the licensing-intent score as a percentile within its peers, and the two or three factors that put it there, each with its source. "No partner found" lists what was checked.' },
  { n: '3', title: 'Open the brief', body: 'Trials with registry links, the ownership and partnership evidence, the score waterfall, predicted upfront, total and royalty ranges with the comparables listed, and the company\'s financial pressure. Export to Excel or a PDF brief.' },
  { n: '4', title: 'Let it watch for you', body: 'Watch the asset, set alert rules (score crossings, partnership changes, catalysts) and get new mandate matches as a daily or weekly digest by email, Slack or in-app.' },
];

const COVERAGE = [
  { k: '45,000+', v: 'unpartnered or partially partnered industry programs, preclinical to Phase 3' },
  { k: '100', v: 'countries of origin, resolved from public trial registries and company filings' },
  { k: '12', v: 'therapeutic areas and 560+ indications, with target and mechanism where classified' },
];

/**
 * Public page for the module. Signed-in Pro users get a straight link into
 * the feed; everyone else gets the sign-up path. Copy states floors, not
 * live counts, so it never overclaims between crons.
 */
export function SearchEvaluationLanding({ backtested, faqs, dealCount }: { backtested: boolean; faqs: Faq[]; dealCount: string }) {
  const { isAuthenticated, tier, openAuthModal } = useAuth();
  const pro = hasProAccess(tier);

  return (
    <RadarPageFrame>
      <main className="min-h-screen bg-white pt-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 sm:pt-20">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
          <span className="inline-flex items-center rounded-full border border-teal-500/40 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
            Included in Pro
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Search &amp; Evaluation</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
            A ranked list of clinical-stage programs that look likely to change hands. Built from trial registries in
            100 countries and company filings, resolved to the owning company, and scored on evidence we can cite:
            cash position, hiring, filings, management language, trial status. Predicted terms come from the same{' '}
            {dealCount} verified deals behind the Solidus benchmarks, with the comparables shown.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {pro ? (
              <Link href="/radar" className={CTA}>Open the feed</Link>
            ) : isAuthenticated ? (
              <Link href="/pro" className={CTA}>Upgrade to Pro</Link>
            ) : (
              <button type="button" onClick={() => openAuthModal('signup')} className={CTA}>Start with Pro</button>
            )}
            <Link href="/radar/methodology" className={CTA_SECONDARY}>Read the methodology</Link>
          </div>
          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {COVERAGE.map(c => (
              <div key={c.k} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <dt className="font-mono text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{c.k}</dt>
                <dd className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{c.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Floors, not live counts. Academic sponsors, approved products and comparator arms are excluded from the default view and reachable through filters.
          </p>
        </section>

        {/* How it works */}
        <section className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40" aria-labelledby="how">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h2 id="how" className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-2">
              {STEPS.map(s => (
                <li key={s.n} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 font-mono text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">{s.n}</span>
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The score */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6" aria-labelledby="score">
          <h2 id="score" className="text-2xl font-semibold tracking-tight">A score you can argue with</h2>
          <div className="mt-4 grid gap-8 md:grid-cols-2">
            <p className="text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
              The licensing-intent score is the model&apos;s probability that a program is announced as licensed, optioned
              or acquired within twelve months. A raw probability is a small number for almost every asset, so the feed
              shows it as a percentile within the asset&apos;s phase and therapeutic-area peers, with the base rate for
              that peer group next to it.{' '}
              {backtested
                ? 'The active model has an out-of-sample backtest against announced deals; the methodology page shows ROC-AUC, precision at 50 and 100, lift and calibration for every retrain.'
                : 'A retrain is in progress; the methodology page shows the current backtest and will update when a model is activated.'}
            </p>
            <ul className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
              {[
                'Every factor names its source: a filing, a registry record, a press release, a hiring post.',
                'Confidence is shown separately from the score, and low-confidence classifications are flagged.',
                'Ownership is derived per asset: originator, licensee, co-developer, comparator, marketed elsewhere.',
                '"Unpartnered" means no evidence found after checking deals, trial collaborators, drug ownership and press.',
                'Preclinical programs come only from company filings, with the disclosing sentence quoted.',
              ].map(t => (
                <li key={t} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />{t}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Who it is for */}
        <section className="border-t border-neutral-200 dark:border-neutral-800" aria-labelledby="who">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h2 id="who" className="text-2xl font-semibold tracking-tight">Built for the search side of BD</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {[
                { t: 'In-licensing teams', d: 'Run a mandate per therapeutic area, get the digest, open only the briefs that matter.' },
                { t: 'Regional pharma seeking rights', d: 'Filter by rights available and origin; templates for Japan, Korea and China-forward buyers.' },
                { t: 'Investors and advisors', d: 'Use the acquirer view to see which programs fit a buyer before the buyer does.' },
              ].map(c => (
                <div key={c.t} className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
                  <h3 className="font-semibold">{c.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40" aria-labelledby="faq">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
            <h2 id="faq" className="text-2xl font-semibold tracking-tight">Questions</h2>
            <div className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
              {faqs.map(f => (
                <details key={f.question} className="group py-4">
                  <summary className="cursor-pointer list-none text-base font-medium marker:content-none">{f.question}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{f.answer}</p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              {pro ? (
                <Link href="/radar" className={CTA}>Open the feed</Link>
              ) : (
                <Link href="/pro" className={CTA}>See Pro pricing</Link>
              )}
              <Link href="/compare/cortellis" className={CTA_SECONDARY}>Compare with Cortellis</Link>
            </div>
          </div>
        </section>
      </main>
    </RadarPageFrame>
  );
}
