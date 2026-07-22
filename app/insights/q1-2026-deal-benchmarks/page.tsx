'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, ArrowRight, Check, Download,
  FileText, Shield, Building2, Zap, ChevronRight,
} from 'lucide-react';
import { InsightEmailCapture } from '@/components/insights/InsightEmailCapture';
import { DEAL_STATS } from '@/lib/config/constants';

export default function Q1BenchmarksReport() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/report-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, name, company, title,
          report_slug: 'q1-2026-deal-benchmarks',
        }),
      });
      const data = await res.json();
      if (res.ok && data.download_url) {
        setDownloadUrl(data.download_url);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a]">
      {/* Hero */}
      <section className="relative pt-24 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_60%,rgba(99,102,241,0.06),transparent)]" />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-6">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Free Report</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.1]">
                Biopharma Deal<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Benchmarks 2026</span>
              </h1>

              <p className="mt-6 text-lg text-slate-400 leading-relaxed max-w-lg">
                Upfront ranges, milestone structures, royalty benchmarks, and deal-flow trends across all 12 therapeutic areas — sourced from {DEAL_STATS.TOTAL_DEALS} verified transactions in the Ambrosia Benchmarker corpus.
              </p>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal-500" /> {DEAL_STATS.TOTAL_DEALS} deals analyzed</div>
                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-500" /> 12 therapeutic areas</div>
                <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-teal-500" /> Verified & calibrated</div>
              </div>
            </div>

            {/* Right: Email gate OR download */}
            <div>
              {downloadUrl ? (
                /* Download confirmation */
                <div className="bg-[#0d1420] border border-teal-500/20 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-teal-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Report ready.</h3>
                  <p className="text-slate-400 mb-6">Download link also sent to your inbox.</p>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-white text-base font-semibold rounded-xl shadow-lg shadow-teal-500/25 hover:bg-teal-400 hover:-translate-y-0.5 transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download Report (PDF)
                  </a>
                  <div className="mt-8 pt-6 border-t border-white/[0.06]">
                    <p className="text-sm text-slate-400 mb-3">Want to run the numbers yourself?</p>
                    <Link
                      href="/calculator?utm_source=seo&utm_medium=insight_page&utm_content=q1-2026-deal-benchmarks"
                      className="inline-flex items-center gap-2 text-teal-400 text-sm font-medium hover:text-teal-300 transition-colors"
                    >
                      Open the deal calculator
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                /* Email capture form */
                <div className="bg-[#0d1420] border border-white/[0.08] rounded-2xl p-8">
                  <h3 className="text-xl font-bold text-white mb-1">Download the report</h3>
                  <p className="text-sm text-slate-400 mb-6">Free — enter your email and it's yours.</p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <input
                        type="email"
                        required
                        placeholder="Work email *"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800/80 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="First name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="px-4 py-3 rounded-xl border border-slate-600 bg-slate-800/80 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      />
                      <input
                        type="text"
                        placeholder="Company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="px-4 py-3 rounded-xl border border-slate-600 bg-slate-800/80 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Title (optional)"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-800/80 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !email}
                      className="w-full py-3.5 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-400 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? 'Processing...' : (
                        <>
                          Get the report
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    {error && (
                      <p className="text-sm text-red-400 text-center">{error}</p>
                    )}
                  </form>

                  <p className="mt-4 text-[11px] text-slate-500 text-center">
                    No spam. Report delivered instantly. Unsubscribe anytime.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* What's inside — teaser content */}
      <section className="py-20 px-4 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">What&apos;s Inside</span>
            </div>
            <h2 className="text-3xl font-bold text-white">
              The comp set your committee needs.
            </h2>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Every section is anchored to verified closed transactions — not estimates, not models, not survey data.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Upfront Benchmarks by Phase',
                desc: 'Median upfront ranges for preclinical through approved, broken out by modality and therapeutic area. See exactly where the market prices each stage.',
                stat: '9 phases × 12 TAs',
              },
              {
                icon: TrendingUp,
                title: 'Deal Flow Trends',
                desc: 'Quarter-over-quarter transaction volume, average deal sizes, and the TAs seeing the most activity. Spot where capital is concentrating.',
                stat: '500+ deals tracked',
              },
              {
                icon: Building2,
                title: 'Top Acquirers & Partners',
                desc: 'Which pharma companies are doing the most deals, what they\'re paying, and which modalities they\'re targeting. Counterparty intelligence for your pitch.',
                stat: '1,308 companies profiled',
              },
            ].map(item => (
              <div key={item.title} className="p-7 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:border-teal-500/15 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5 group-hover:bg-teal-500/15 transition-colors">
                  <item.icon className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{item.desc}</p>
                <span className="text-xs font-medium text-teal-400">{item.stat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teaser stats — sample data points */}
      <section className="py-20 px-4 border-t border-white/[0.04] bg-[#080d16]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white">Sample findings from the report</h2>
            <p className="mt-3 text-slate-400">A preview of the intelligence inside.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { value: '$584M', label: 'Median Phase 2 ADC upfront', sub: 'Oncology, global licensing' },
              { value: '168', label: 'Oncology deals in 2025–2026', sub: 'Highest volume TA' },
              { value: '+1,408%', label: 'Radiopharm upfront surge', sub: 'Fastest-growing asset class' },
              { value: '38/wk', label: 'New deals tracked weekly', sub: 'Continuously updated corpus' },
            ].map(stat => (
              <div key={stat.label} className="p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="text-3xl font-bold text-teal-400 font-mono">{stat.value}</div>
                <div className="mt-2 text-sm font-medium text-white">{stat.label}</div>
                <div className="mt-1 text-xs text-slate-500">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* CTA repeat */}
          <div className="mt-14 text-center">
            <a
              href="#top"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-white text-base font-semibold rounded-xl shadow-lg shadow-teal-500/25 hover:bg-teal-400 hover:-translate-y-0.5 transition-all"
            >
              Download the full report — free
              <ArrowRight className="w-4 h-4" />
            </a>
            <p className="mt-3 text-sm text-slate-500">Enter your email above to unlock.</p>
          </div>
        </div>
      </section>

      <InsightEmailCapture slug="q1-2026-deal-benchmarks" />

      {/* Source credibility */}
      <section className="py-16 px-4 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto text-center">
          <Image src="/logo-white.png" alt="Ambrosia Ventures" width={160} height={32} className="h-6 w-auto mx-auto opacity-40 mb-6" />
          <p className="text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Report data sourced from the Ambrosia Benchmarker deal intelligence platform — {DEAL_STATS.TOTAL_DEALS} verified biopharma transactions,
            1,308 company profiles, 14 valuation engines. Updated weekly from SEC EDGAR, ClinicalTrials.gov, press disclosures,
            and proprietary calibration corpus.
          </p>
          <div className="mt-6 flex items-center justify-center gap-8 text-xs text-slate-600">
            <Link href="/methodology" className="hover:text-slate-400 transition-colors">Methodology</Link>
            <Link href="/accuracy" className="hover:text-slate-400 transition-colors">Accuracy</Link>
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/calculator" className="hover:text-slate-400 transition-colors">Open Calculator</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
