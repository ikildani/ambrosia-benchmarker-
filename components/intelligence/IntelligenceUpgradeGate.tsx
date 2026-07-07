import Link from 'next/link';

interface Props {
  isAuthenticated: boolean;
}

export function IntelligenceUpgradeGate({ isAuthenticated }: Props) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-teal-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-teal-300">
            Pro &amp; Portfolio
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Live market intelligence
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            Phase 3 readouts that will move deal comps, FDA Advisory Committee calendar, and
            the monthly intelligence digest. Two pipelines that reset biopharma deal pricing
            within days &mdash; and the only way to anchor a negotiation on what&rsquo;s about
            to happen.
          </p>

          {/* Teaser bullets */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <TeaserCard
              title="Phase 3 readouts (live)"
              body="Next 90 days of trial readouts across six TAs, cached from ClinicalTrials.gov v2 API. Negotiation anchors on what's coming."
            />
            <TeaserCard
              title="FDA AdComm calendar"
              body="Curated advisory committee meetings — binary events that reset deal comps 20-60% in days."
            />
            <TeaserCard
              title="Monthly intelligence digest"
              body="One email a month summarizing calibration progress, upcoming events, counterparty premium shifts. No marketing."
            />
            <TeaserCard
              title="Pipeline depth (coming)"
              body="PDUFA tracker, insider 13D/13G signals, KOL sentiment — all surfaced alongside the two existing pipelines."
            />
          </div>

          {/* CTA */}
          <div className="mt-10 rounded-lg border border-slate-700/60 bg-slate-900/60 p-6 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {isAuthenticated ? 'Included in Pro + Portfolio' : 'Sign in to continue'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {isAuthenticated
                    ? 'Upgrade to Pro for self-serve access, or contact us for the Portfolio License.'
                    : 'Live market intelligence is included in Pro and Portfolio tiers.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={isAuthenticated ? '/pro' : '/calculator?auth=signin'}
                  className="rounded-md bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400"
                >
                  {isAuthenticated ? 'Upgrade to Pro →' : 'Sign in →'}
                </Link>
                <Link
                  href="/portfolio"
                  className="rounded-md border border-slate-600 bg-slate-950/50 px-5 py-2.5 text-sm text-slate-200 transition-colors hover:bg-slate-900"
                >
                  Portfolio License
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Already Pro? Make sure you&rsquo;re signed in with the same email as your subscription.
            Having trouble? <a href="mailto:hello@ambrosiaventures.co" className="text-cyan-400 hover:text-cyan-300">hello@ambrosiaventures.co</a>
          </p>
        </div>
      </section>
    </main>
  );
}

function TeaserCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
