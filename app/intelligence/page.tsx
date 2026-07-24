import { Metadata } from 'next';
import Link from 'next/link';
import { fetchUpcomingReadouts, getSupportedTAs } from '@/lib/market-intelligence/ct-gov-events';
import { getAdCommCalendar } from '@/lib/market-intelligence/fda-adcomm';
import { MarketIntelligenceSidebar } from '@/components/intelligence/MarketIntelligenceSidebar';
import { AdCommCalendar } from '@/components/intelligence/AdCommCalendar';
import { DigestSignup } from '@/components/intelligence/DigestSignup';
import { IntelligenceUpgradeGate } from '@/components/intelligence/IntelligenceUpgradeGate';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { SiteFooter } from '@/components/seo/SiteFooter';
import { ReadoutImpactEstimate } from '@/components/intelligence/ReadoutImpactEstimate';
import { CompetitiveCluster } from '@/components/intelligence/CompetitiveCluster';
import { DealImpactSection } from '@/components/intelligence/DealImpactSection';
import { createServerClient } from '@/lib/supabase/server';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Live Market Intelligence | Solidus',
  description:
    'Upcoming Phase 3 readouts that will move your deal pricing. Live from ClinicalTrials.gov, sliced by therapeutic area.',
  alternates: { canonical: `${BASE_URL}/intelligence` },
  openGraph: {
    title: 'Live Market Intelligence | Solidus',
    description: 'Upcoming Phase 3 readouts that will move your deal pricing. Live from ClinicalTrials.gov.',
    type: 'website',
    url: `${BASE_URL}/intelligence`,
    siteName: 'Solidus',
    images: [{
      url: '/api/og?title=Live%20Intelligence&subtitle=Upcoming%20readouts%20that%20move%20deal%20pricing',
      width: 1200,
      height: 630,
      alt: 'Live market intelligence',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Market Intelligence | Solidus',
    description: 'Upcoming Phase 3 readouts. Live from ClinicalTrials.gov.',
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1h cache — readout dates don't shift hourly

interface Props {
  searchParams: Promise<{ ta?: string }>;
}

export default async function IntelligencePage({ searchParams }: Props) {
  // Tier gate — /intelligence is Pro + Portfolio only.
  // Server-side check pulls tier directly from user_profiles; can't be
  // spoofed by stale client cookies. Internal PRO_EMAILS allowlist
  // also short-circuits.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return <IntelligenceUpgradeGate isAuthenticated={auth.isAuthenticated} />;
  }

  const params = await searchParams;
  const supportedTAs = getSupportedTAs();
  const selectedTA = supportedTAs.includes(params.ta || '') ? params.ta : undefined;

  // Fetch readouts for ALL six TAs in parallel (cached at edge for 1h).
  const allReadouts = await Promise.all(
    supportedTAs.map(async (ta) => ({
      ta,
      readouts: await fetchUpcomingReadouts({ ta, phase: 'PHASE3', limit: 6, daysAhead: 90 }),
    })),
  );

  // ── User calculations for personalized readout matching ──────────────
  let userCalculations: Array<{ therapeutic_area: string; indication: string }> = [];
  if (auth.userId) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from('calculations')
        .select('therapeutic_area, indication_category')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
        .limit(5);
      userCalculations = (data || []).map((d: { therapeutic_area: string; indication_category: string }) => ({
        therapeutic_area: d.therapeutic_area,
        indication: d.indication_category,
      }));
    } catch {} // non-blocking — personalization is best-effort
  }

  // ── Readouts by TA for competitive cluster alerts ───────────────────
  const readoutsByTA: Record<string, number> = {};
  const allFlat = allReadouts.flatMap((s) => s.readouts);
  for (const r of allFlat) {
    if (r.therapeuticArea && r.daysToReadout <= 60) {
      readoutsByTA[r.therapeuticArea] = (readoutsByTA[r.therapeuticArea] || 0) + 1;
    }
  }

  // Flatten readouts for DealImpactSection
  const flatReadouts = allFlat.map((r) => ({
    therapeuticArea: r.therapeuticArea || '',
    conditions: r.conditions,
    title: r.title,
    sponsor: r.sponsor,
    daysToReadout: r.daysToReadout,
  }));

  // FDA AdComm calendar — curated static, fast + reliable
  const adCommAll = getAdCommCalendar({ ta: selectedTA });
  const adCommByTA = supportedTAs.map((ta) => ({
    ta,
    meetings: getAdCommCalendar({ ta }),
  }));

  // Optionally filter to one TA via query param
  const visibleSections = selectedTA
    ? allReadouts.filter(s => s.ta === selectedTA)
    : allReadouts;

  const totalReadouts = allReadouts.reduce((sum, s) => sum + s.readouts.length, 0);
  const imminent = allReadouts.flatMap(s => s.readouts).filter(r => r.daysToReadout <= 30).length;
  const upcomingAdComms = adCommAll.filter(m => m.daysFromToday >= 0).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/intelligence" />

      <section className="relative overflow-hidden border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none translate-y-1/2" />
        <div className="mx-auto max-w-6xl px-6 pt-32 sm:pt-36 lg:pt-40 pb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Live Market Intelligence
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Two pipelines that reset deal pricing: Phase 3 trial readouts ({totalReadouts} upcoming
            {imminent > 0 && <>, <span className="text-amber-400">{imminent} imminent</span></>}) and
            FDA Advisory Committee meetings ({upcomingAdComms} upcoming). Negotiations anchor on
            what&rsquo;s about to happen, not what already happened.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Readouts live from <a href="https://clinicaltrials.gov/data-api/api" target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:text-cyan-300">ClinicalTrials.gov v2 API</a>
            (cached 1h). AdComm calendar curated monthly from <a href="https://www.fda.gov/advisory-committees/advisory-committee-calendar" target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:text-cyan-300">fda.gov</a>.
            Both surface ±30-day comparable-deal-comp shifts.
          </p>

          {/* TA filter pills */}
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Link
              href="/intelligence"
              className={[
                'rounded-full border px-3 py-1.5 transition-colors',
                !selectedTA
                  ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                  : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:bg-slate-900',
              ].join(' ')}
            >
              All TAs
            </Link>
            {supportedTAs.map((ta) => (
              <Link
                key={ta}
                href={`/intelligence?ta=${ta}`}
                className={[
                  'rounded-full border px-3 py-1.5 capitalize transition-colors',
                  selectedTA === ta
                    ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                    : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:bg-slate-900',
                ].join(' ')}
              >
                {ta.replace(/([A-Z])/g, ' $1').trim()}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Personalized deal impact section ── */}
      {userCalculations.length > 0 && (
        <section>
          <div className="mx-auto max-w-6xl px-6 pt-10 pb-2">
            <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-900/60 via-slate-950/40 to-slate-900/60 p-6 border-l-2 border-l-teal-500/40">
              <DealImpactSection userCalculations={userCalculations} readouts={flatReadouts} />
            </div>
          </div>
        </section>
      )}

      {/* ── Competitive cluster alerts ── */}
      <section>
        <div className="mx-auto max-w-6xl px-6 pt-6 pb-4">
          <CompetitiveCluster readoutsByTA={readoutsByTA} />
        </div>
      </section>

      {/* Phase 3 readouts */}
      <section>
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Phase 3 trial readouts (live · CT.gov)
          </h2>
          {visibleSections.length === 0 ? (
            <p className="py-8 text-center text-slate-500">No readouts for this TA right now.</p>
          ) : (
            <div className={selectedTA ? '' : 'grid gap-5 md:grid-cols-2 lg:grid-cols-3'}>
              {visibleSections.map(({ ta, readouts }) => (
                <div key={ta}>
                  <MarketIntelligenceSidebar
                    readouts={readouts}
                    title={`${ta.replace(/([A-Z])/g, ' $1').trim()}`}
                    taLabel={ta}
                  />
                  <ReadoutImpactEstimate therapeuticArea={ta} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FDA AdComm calendar */}
      <section className="border-t border-slate-800/60">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              FDA Advisory Committees (curated)
            </h2>
            <span className="text-xs text-slate-500">
              {upcomingAdComms} upcoming · {adCommAll.length - upcomingAdComms} recent
            </span>
          </div>
          {selectedTA ? (
            adCommAll.length > 0 ? (
              <AdCommCalendar meetings={adCommAll} taLabel={selectedTA} />
            ) : (
              <p className="py-8 text-center text-slate-500">No AdComm meetings for this TA in the current window.</p>
            )
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {adCommByTA
                .filter(({ meetings }) => meetings.length > 0)
                .map(({ ta, meetings }) => (
                  <AdCommCalendar
                    key={ta}
                    meetings={meetings}
                    title={`${ta.replace(/([A-Z])/g, ' $1').trim()}`}
                    taLabel={ta}
                  />
                ))}
            </div>
          )}
          {!selectedTA && adCommByTA.every(({ meetings }) => meetings.length === 0) && (
            <p className="py-8 text-center text-slate-500">
              No AdComm meetings in the current window.
            </p>
          )}
        </div>
      </section>

      {/* Monthly digest signup */}
      <section className="border-t border-slate-800/60">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <DigestSignup />
        </div>
      </section>

      {/* Methodology */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Why this is on the page</h2>
          <p className="text-sm leading-relaxed text-slate-400">
            Deal pricing is path-dependent. A Phase 3 readout in your indication next quarter
            isn&rsquo;t a forecast &mdash; it&rsquo;s a structural break that will reset the comparable-
            deal anchors the engine uses. We surface the calendar so the conversation
            anchors on what&rsquo;s actually about to happen, not what&rsquo;s already happened.
            This is the first of several intelligence pipelines &mdash; FDA AdComm calendar,
            insider trading signals, and KOL sentiment are queued up next.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
