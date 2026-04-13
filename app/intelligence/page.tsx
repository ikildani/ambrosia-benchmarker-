import { Metadata } from 'next';
import Link from 'next/link';
import { fetchUpcomingReadouts, getSupportedTAs } from '@/lib/market-intelligence/ct-gov-events';
import { MarketIntelligenceSidebar } from '@/components/intelligence/MarketIntelligenceSidebar';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Live Market Intelligence | Ambrosia Benchmarker',
  description:
    'Upcoming Phase 3 readouts that will move your deal pricing. Live from ClinicalTrials.gov, sliced by therapeutic area.',
  alternates: { canonical: `${BASE_URL}/intelligence` },
  openGraph: {
    title: 'Live Market Intelligence | Ambrosia Benchmarker',
    description: 'Upcoming Phase 3 readouts that will move your deal pricing. Live from ClinicalTrials.gov.',
    type: 'website',
    url: `${BASE_URL}/intelligence`,
    siteName: 'Ambrosia Benchmarker',
    images: [{
      url: '/api/og?title=Live%20Intelligence&subtitle=Upcoming%20readouts%20that%20move%20deal%20pricing',
      width: 1200,
      height: 630,
      alt: 'Live market intelligence',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Market Intelligence | Ambrosia Benchmarker',
    description: 'Upcoming Phase 3 readouts. Live from ClinicalTrials.gov.',
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1h cache — readout dates don't shift hourly

interface Props {
  searchParams: Promise<{ ta?: string }>;
}

export default async function IntelligencePage({ searchParams }: Props) {
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

  // Optionally filter to one TA via query param
  const visibleSections = selectedTA
    ? allReadouts.filter(s => s.ta === selectedTA)
    : allReadouts;

  const totalReadouts = allReadouts.reduce((sum, s) => sum + s.readouts.length, 0);
  const imminent = allReadouts.flatMap(s => s.readouts).filter(r => r.daysToReadout <= 30).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <InstitutionalNav activePath="/intelligence" />

      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Live Market Intelligence
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Phase 3 readouts that will move your deal pricing.{' '}
            <span className="text-slate-200">{totalReadouts} upcoming events</span>{' '}
            across six therapeutic areas in the next 90 days
            {imminent > 0 && (
              <>
                {' '}&mdash;{' '}
                <span className="text-amber-400">{imminent} imminent</span> (within 30 days).
              </>
            )}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Live from <a href="https://clinicaltrials.gov/data-api/api" target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:text-cyan-300">ClinicalTrials.gov v2 API</a>.
            Cached 1 hour. When a readout drops, comparable-deal pricing in the affected
            indication moves 30-60% within weeks.
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

      {/* Grid of TA sections, each with a MarketIntelligenceSidebar */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-10">
          {visibleSections.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No data for this TA right now.</p>
          ) : (
            <div className={selectedTA ? '' : 'grid gap-5 md:grid-cols-2 lg:grid-cols-3'}>
              {visibleSections.map(({ ta, readouts }) => (
                <MarketIntelligenceSidebar
                  key={ta}
                  readouts={readouts}
                  title={`${ta.replace(/([A-Z])/g, ' $1').trim()}`}
                  taLabel={ta}
                />
              ))}
            </div>
          )}
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
