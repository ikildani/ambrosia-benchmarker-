import { Metadata } from 'next';
import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { SiteFooter } from '@/components/seo/SiteFooter';

export const metadata: Metadata = {
  title: 'Summer 2026 Internship Cohort | Ambrosia Ventures',
  description: 'Apply for the Ambrosia Ventures Summer 2026 Internship. Work on real biopharma deals, build data platforms, and contribute from day one. New York & Detroit.',
  alternates: { canonical: 'https://calculator.ambrosiaventures.co/internship' },
  openGraph: {
    title: 'Summer 2026 Internship | Ambrosia Ventures',
    description: 'Hands-on internship at the intersection of life sciences advisory and data intelligence.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/internship',
    siteName: 'Ambrosia Ventures',
  },
};

const TRACKS = [
  { name: 'Deal Research & Intelligence', icon: '📊', desc: 'Source comparable transactions from SEC filings, build sector deep-dives, and expand the Deal Terms Calculator database with verified deal structures.' },
  { name: 'Platform & Technology', icon: '⚙️', desc: 'Ship real features across Terrain, Deal Terms Calculator, and AlaricAI. TypeScript, Next.js, Supabase — production code from week one.' },
  { name: 'BD & Growth', icon: '📈', desc: 'Run outreach campaigns, grow the calculator user base, and develop partnerships with pharma BD teams and biotech founders.' },
  { name: 'Client Delivery', icon: '📋', desc: 'Draft deal memos, build financial models, prepare M&A data rooms, and support live advisory engagements.' },
  { name: 'Marketing & Communications', icon: '✍️', desc: 'Create thought leadership content, launch campaigns, manage social presence, and position Ambrosia as the authority in deal intelligence.' },
  { name: 'Open Track', icon: '🔓', desc: 'Don\'t fit neatly into one box? Tell us where you think you\'d add the most value. We build roles around exceptional people.' },
];

const STATS = [
  { value: '3,500+', label: 'Deals in our database', sub: 'SEC filings, press releases, regulatory databases' },
  { value: '850+', label: 'Companies tracked', sub: 'Partner matching across every major pharma' },
  { value: '12', label: 'Therapeutic areas', sub: 'Full coverage from oncology to rare disease' },
];

export default function InternshipPage() {
  return (
    <>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        {/* Nav */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-700 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Hero */}
          <div className="py-16 sm:py-24 text-center max-w-3xl mx-auto">
            <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-4">
              Summer 2026 · New York & Detroit
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              Build the future of<br />
              <span className="text-teal-600 dark:text-teal-400">deal intelligence.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              We&apos;re building proprietary platforms that are changing how biopharma deals get done. This internship puts you at the center of it — real work, real impact, from day one.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/internship.html" className="inline-flex items-center justify-center px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors text-lg shadow-lg shadow-teal-600/20">
                Apply Now
              </a>
              <a href="#tracks" className="inline-flex items-center justify-center px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:border-teal-300 dark:hover:border-teal-600 transition-colors text-lg">
                View Tracks ↓
              </a>
            </div>
          </div>

          {/* What We Do */}
          <section className="py-12 sm:py-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">What is Ambrosia Ventures?</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                We&apos;re a life sciences advisory firm that builds data-driven platforms for biopharma deal intelligence. Our tools are used by BD teams, biotech founders, and investors to benchmark, model, and negotiate licensing deals.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {STATS.map(s => (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
                  <div className="text-3xl font-black text-teal-600 dark:text-teal-400">{s.value}</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{s.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* What You'll Do */}
          <section className="py-12 sm:py-16">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-8 sm:p-12 text-white">
              <h2 className="text-3xl font-bold mb-4">This is not a typical internship.</h2>
              <p className="text-slate-300 text-lg mb-8 max-w-2xl">
                We don&apos;t have interns fetch coffee or sit in on calls. You&apos;ll work on the same problems the full-time team works on — with real deadlines, real clients, and real ownership.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 text-teal-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Ship production code</div>
                    <div className="text-sm text-slate-400">Features you build go live to real users on real platforms</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 text-teal-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Work on live deals</div>
                    <div className="text-sm text-slate-400">Support actual advisory engagements and client deliverables</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 text-teal-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Own your outcomes</div>
                    <div className="text-sm text-slate-400">No hand-holding. You get a scope, resources, and trust to deliver</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0 text-teal-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Learn the industry</div>
                    <div className="text-sm text-slate-400">Biopharma deal structures, regulatory pathways, competitive intelligence</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tracks */}
          <section id="tracks" className="py-12 sm:py-16 scroll-mt-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Choose your track</h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                Six tracks, each with distinct responsibilities. Pick the one that matches your strengths — or tell us you want to do a bit of everything.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TRACKS.map(t => (
                <div key={t.name} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:border-teal-300 dark:hover:border-teal-600 transition-colors">
                  <div className="text-2xl mb-3">{t.icon}</div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{t.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Details */}
          <section className="py-12 sm:py-16">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Timeline
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li><strong>Applications open:</strong> Now</li>
                  <li><strong>Program start:</strong> June 2026</li>
                  <li><strong>Duration:</strong> 10–12 weeks</li>
                  <li><strong>Rolling admissions</strong> — early applicants reviewed first</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Location
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <li><strong>Primary:</strong> New York, NY & Detroit, MI</li>
                  <li><strong>Remote:</strong> Available for select tracks</li>
                  <li><strong>Availability:</strong> Full-time or part-time</li>
                  <li>Flexible scheduling around academic commitments</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Who We're Looking For */}
          <section className="py-12 sm:py-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6 text-center">Who we&apos;re looking for</h2>
            <div className="max-w-2xl mx-auto text-center text-lg text-slate-600 dark:text-slate-300 space-y-4">
              <p>
                You don&apos;t need a specific major or GPA. We care about how you think, not where you went to school.
              </p>
              <p>
                The strongest candidates are <strong className="text-slate-900 dark:text-white">curious</strong> (you ask good questions), <strong className="text-slate-900 dark:text-white">resourceful</strong> (you figure things out without being told how), and <strong className="text-slate-900 dark:text-white">rigorous</strong> (your work is precise and well-structured).
              </p>
              <p>
                If you&apos;ve built something, shipped something, or researched something you&apos;re proud of — we want to hear about it.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section className="py-12 sm:py-16">
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-2xl border border-teal-200/50 dark:border-teal-800/50 p-8 sm:p-12 text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Ready to apply?</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-lg mx-auto text-lg">
                The application takes about 10 minutes. We review every submission personally.
              </p>
              <a href="/internship.html" className="inline-flex items-center justify-center px-10 py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors text-lg shadow-lg shadow-teal-600/20">
                Start Your Application →
              </a>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                Questions? Email <a href="mailto:info@ambrosiaventures.co" className="text-teal-600 dark:text-teal-400 hover:underline">info@ambrosiaventures.co</a>
              </p>
            </div>
          </section>

        </div>
      </main>
      <SiteFooter />
    </>
  );
}
