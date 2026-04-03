import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import SharedCalculationView from '@/components/SharedCalculationView';

const ShareViewTracker = dynamic(() => import('@/components/insights/ShareViewTracker').then(m => ({ default: m.ShareViewTracker })));

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
  const ogImageUrl = `${baseUrl}/api/og/share/${token}`;

  let title = 'Deal Analysis | Ambrosia Ventures';
  let description = 'Biotech licensing deal analysis — upfronts, milestones, royalties, benchmarked across 2,500+ transactions.';

  try {
    const response = await fetch(`${baseUrl}/api/share/${token}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data.labels) {
        title = `${data.labels.modality} ${data.labels.indication} Deal Analysis | Ambrosia Ventures`;
        description = `${data.labels.phase} ${data.labels.modality} deal benchmarks for ${data.labels.indication}. Upfronts, milestones, royalties from 2,500+ transactions.`;
      }
    }
  } catch { /* generic metadata fallback */ }

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Ambrosia Ventures Deal Analysis' }] },
    twitter: { card: 'summary_large_image', title, description, images: [ogImageUrl] },
    robots: { index: false, follow: false },
  };
}

async function getSharedCalculation(token: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
    const response = await fetch(`${baseUrl}/api/share/${token}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  } catch { return null; }
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const data = await getSharedCalculation(token);
  if (!data) notFound();

  const modality = data.labels?.modality || 'Deal';
  const indication = data.labels?.indication || '';
  const phase = data.labels?.phase || '';

  return (
    <main className="min-h-screen bg-[#0c1220]">
      <ShareViewTracker
        token={token}
        company={data.recipientCompany || data.labels?.company}
        modality={data.labels?.modality}
        indication={data.labels?.indication}
        phase={data.labels?.phase}
      />
      {/* Nav */}
      <nav className="border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <a href="/">
            <Image src="/logo-white.png" alt="Ambrosia Ventures" width={140} height={28} className="h-5 w-auto opacity-70" />
          </a>
          <a href="/calculator" className="text-xs font-semibold text-slate-600 hover:text-teal-400 transition-colors tracking-wide uppercase">
            Try the Calculator
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-12 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/[0.06] border border-teal-500/[0.1] mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse"></div>
            <span className="text-[11px] font-bold text-teal-400/80 tracking-[0.15em] uppercase">Deal Intelligence Report</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-[1.05] text-white mb-4">
            {modality}<br />
            <span className="text-slate-600">{indication}</span>
          </h1>

          <div className="flex items-center gap-3 text-sm text-slate-600 mt-2">
            <span className="px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-xs font-semibold text-slate-500">{phase}</span>
            <span className="text-slate-700">&bull;</span>
            <span className="text-xs text-slate-600">Based on 2,500+ biopharma transactions</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <SharedCalculationView results={data.results} labels={data.labels} />
      </div>

      {/* Report Purchase CTA */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          {/* Glows */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none translate-y-1/2"></div>

          <div className="relative z-10 p-8 sm:p-14">
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-[11px] font-bold text-teal-400/70 tracking-[0.15em] uppercase mb-6">Full Deal Intelligence Report</p>

              <h3 className="text-3xl sm:text-4xl font-black text-white tracking-[-0.02em] mb-4">
                Get the complete analysis<br />
                <span className="text-teal-400">for {modality}.</span>
              </h3>

              <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
                Everything above, plus comparable transactions, sensitivity analysis, partner matching, and a negotiation playbook — in a board-ready PDF.
              </p>

              {/* What's included */}
              <div className="grid sm:grid-cols-2 gap-3 text-left max-w-md mx-auto mb-10">
                {[
                  'Comparable deal transactions',
                  'rNPV & deal valuation',
                  'Buyer-specific valuation',
                  'Partner matching + Pharma Intent Score',
                  'Monte Carlo sensitivity analysis',
                  'Negotiation playbook',
                  'Competitive landscape',
                  'PDF + Excel export',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-slate-400">
                    <svg className="w-4 h-4 text-teal-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>

              {/* Primary CTA — report page */}
              <a
                href="/report"
                className="inline-flex items-center gap-3 px-10 py-4 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-400 transition-all text-lg shadow-lg shadow-teal-500/15"
              >
                See Full Report Features
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>

              {/* Secondary */}
              <div className="mt-6 flex flex-col items-center gap-3">
                <a href="/calculator" className="text-sm font-medium text-slate-600 hover:text-teal-400 transition-colors">
                  or try the calculator free &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-white.png" alt="Ambrosia Ventures" width={120} height={24} className="h-4 w-auto opacity-30" />
            <span className="text-[11px] text-slate-600">Data-driven deal intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-600">
            <a href="/methodology" className="hover:text-slate-400 transition-colors">Methodology</a>
            <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-slate-400 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
