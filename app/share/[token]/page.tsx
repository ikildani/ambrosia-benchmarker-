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
  let description = 'Biotech licensing deal analysis — upfronts, milestones, royalties, benchmarked across 1,900+ transactions.';

  try {
    const response = await fetch(`${baseUrl}/api/share/${token}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data.labels) {
        title = `${data.labels.modality} ${data.labels.indication} Deal Analysis | Ambrosia Ventures`;
        description = `${data.labels.phase} ${data.labels.modality} deal benchmarks for ${data.labels.indication}. Upfronts, milestones, royalties from 1,900+ transactions.`;
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
          <a href="/calculator" className="text-xs font-semibold text-slate-400 hover:text-teal-400 transition-colors tracking-wide uppercase">
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
            <span className="text-slate-400">{indication}</span>
          </h1>

          <div className="flex items-center gap-3 text-sm text-slate-400 mt-2">
            <span className="px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-slate-300">{phase}</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-xs text-slate-400">Based on 2,700+ biopharma transactions</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <SharedCalculationView
          results={data.results}
          labels={data.labels}
          financialSummary={data.results?.financialSummary}
        />
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

              <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
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

              {/* Pricing tiers */}
              <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-6">
                {/* Report — one-time */}
                <div className="p-5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-teal-500/20 transition-colors">
                  <p className="text-[10px] font-bold text-teal-400/70 uppercase tracking-wider mb-2">One-Time Report</p>
                  <p className="text-3xl font-black text-white tracking-tight">$499</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Board-ready PDF + Excel</p>
                  <a
                    href="/report"
                    className="block w-full text-center px-4 py-2.5 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-400 transition-all text-sm shadow-lg shadow-teal-500/15"
                  >
                    Get Full Report
                  </a>
                </div>
                {/* Pro — subscription */}
                <div className="p-5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-emerald-500/20 transition-colors">
                  <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-2">Pro Subscription</p>
                  <p className="text-3xl font-black text-white tracking-tight">$299<span className="text-lg text-slate-400">/mo</span></p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">All 14 engines, unlimited assets</p>
                  <a
                    href="/calculator"
                    className="block w-full text-center px-4 py-2.5 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-400 transition-all text-sm shadow-lg shadow-emerald-500/15"
                  >
                    Start Pro Trial
                  </a>
                </div>
              </div>
              <p className="text-xs text-slate-500">Annual billing available at $199/mo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-white.png" alt="Ambrosia Ventures" width={120} height={24} className="h-4 w-auto opacity-30" />
            <span className="text-[11px] text-slate-500">Data-driven deal intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-slate-500">
            <a href="/methodology" className="hover:text-slate-300 transition-colors">Methodology</a>
            <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-slate-300 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

      {/* Sticky branding bar — lead gen from shared links */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0d1b]/95 backdrop-blur-md border-t border-teal-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/logo-white.png" alt="Ambrosia Ventures" width={100} height={20} className="h-4 w-auto flex-shrink-0" />
            <span className="text-[12px] text-slate-400 hidden sm:inline truncate">Deal intelligence for biopharma dealmakers</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href="/insights/q1-2026-deal-benchmarks"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-slate-300 border border-slate-600 rounded-lg hover:border-teal-500/40 hover:text-teal-300 transition-all"
            >
              Free Q1 Benchmarks
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </a>
            <a
              href="/calculator"
              className="inline-flex items-center gap-2 px-5 py-2 bg-teal-500 text-white text-[13px] font-semibold rounded-lg hover:bg-teal-400 hover:-translate-y-0.5 transition-all shadow-lg shadow-teal-500/20"
            >
              Run your own analysis
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
