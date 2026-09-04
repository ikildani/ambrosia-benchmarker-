import Link from 'next/link';

interface Props {
  isAuthenticated: boolean;
}

export function RadarUpgradeGate({ isAuthenticated }: Props) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/8 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-amber-500/5 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
            Pro &amp; Portfolio
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Asset Radar
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
            Clinical-stage assets indexed from ClinicalTrials.gov, cross-referenced against
            real deal comps. Partnership status, licensing intent signals, predicted deal
            terms, and competitive intelligence &mdash; before anyone else sees them.
          </p>

          {/* Feature cards */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                </svg>
              }
              title="Asset universe"
              body="15,000+ clinical-stage assets indexed daily. Every Phase 1-3 program with partnership status resolved against real deals."
            />
            <FeatureCard
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                </svg>
              }
              title="Licensing intent signals"
              body="9-factor scoring: cash runway, BD hires, regulatory milestones, competitor failures, management commentary, patents, publications."
            />
            <FeatureCard
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              }
              title="Predicted deal terms"
              body="For every unpartnered asset: predicted upfront, milestones, and royalties from 1,800+ comparable transactions. No one else has this."
            />
            <FeatureCard
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              }
              title="Personalized mandates"
              body="Define your search criteria — TA, modality, phase, geography — and get new unpartnered assets delivered daily."
            />
          </div>

          {/* Social proof line */}
          <p className="mt-8 text-sm text-slate-500">
            Powered by the same comp database behind Solidus deal benchmarks — the data moat no competitor can replicate.
          </p>

          {/* CTA */}
          <div className="mt-8 rounded-xl border border-slate-700/60 bg-slate-900/60 p-6 backdrop-blur">
            {isAuthenticated ? (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    Asset Radar is available on Pro and Portfolio plans.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Includes all 21 engines, 1,800+ deal comps, and unlimited benchmarks.
                  </p>
                </div>
                <Link
                  href="/pro"
                  className="shrink-0 rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-white hover:bg-amber-400 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
                >
                  Upgrade to Pro
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    Start a free Pro trial to explore Asset Radar.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    No credit card required. Full access for 7 days.
                  </p>
                </div>
                <Link
                  href="/auth/signin"
                  className="shrink-0 rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-white hover:bg-amber-400 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all"
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

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-5 backdrop-blur hover:border-slate-600/60 transition-colors group">
      <div className="flex items-center gap-3 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/15 transition-colors">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
