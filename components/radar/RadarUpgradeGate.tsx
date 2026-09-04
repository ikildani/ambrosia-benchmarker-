import Link from 'next/link';

interface Props {
  isAuthenticated: boolean;
}

export function RadarUpgradeGate({ isAuthenticated }: Props) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
            Pro &amp; Portfolio
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Asset Radar
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            Clinical-stage assets indexed from ClinicalTrials.gov, cross-referenced against
            real deal comps. Know which assets are unpartnered, who&rsquo;s licensing,
            and what the predicted terms would be &mdash; before anyone else.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <TeaserCard
              title="Asset universe (live)"
              body="15,000+ clinical-stage assets indexed daily. Every Phase 1-3 program with partnership status resolved against real deals."
            />
            <TeaserCard
              title="Licensing intent signals"
              body="9-factor scoring: cash runway, BD hires, regulatory milestones, competitor failures, management commentary, patents, publications."
            />
            <TeaserCard
              title="Predicted deal terms"
              body="For every unpartnered asset, predicted upfront, milestones, and royalties from 1,800+ comparable transactions."
            />
            <TeaserCard
              title="Personalized mandates"
              body="Define your search criteria — TA, modality, phase, geography — and get new matches delivered daily."
            />
          </div>

          <div className="mt-10 rounded-lg border border-slate-700/60 bg-slate-900/60 p-6 backdrop-blur">
            {isAuthenticated ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <p className="text-slate-300 text-sm">
                  Asset Radar is available on Pro and Portfolio plans.
                </p>
                <Link
                  href="/pro"
                  className="shrink-0 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
                >
                  Upgrade to Pro
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <p className="text-slate-300 text-sm">
                  Sign in or start a free trial to explore Asset Radar.
                </p>
                <Link
                  href="/auth/signin"
                  className="shrink-0 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
                >
                  Start Free Trial
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function TeaserCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-800/40 p-4 backdrop-blur">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
