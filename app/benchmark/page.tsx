import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { BENCHMARK_PRICING } from '@/lib/config/constants';
import BenchmarkIntakeWizard from '@/components/benchmark/BenchmarkIntakeWizard';

export const metadata: Metadata = {
  title: 'Deal Intelligence Brief',
  description:
    'The complete deal landscape for any indication. Every modality. Every structure. Every counterparty. $2,500 all-inclusive with white-label branding and walkthrough.',
  openGraph: {
    title: 'Deal Intelligence Brief — Ambrosia Ventures',
    description:
      'The complete deal landscape for any indication. Every modality. Every structure. Every counterparty. $2,500 all-inclusive with white-label branding and walkthrough.',
    url: 'https://calculator.ambrosiaventures.co/benchmark',
    type: 'website',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/benchmark',
  },
};

const PROOF_POINTS = [
  '52 deal combinations',
  'AI strategic narrative',
  'Delivered in 24 hours',
] as const;

export default function BenchmarkPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900">
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="bg-[#1a1e42] dark:bg-slate-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          {/* Eyebrow */}
          <p className="text-teal-400 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4">
            Deal Intelligence Brief
          </p>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
            The complete deal landscape
            <br className="hidden sm:block" /> for any indication
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/60 mb-10">
            Every modality. Every structure. Every counterparty.
          </p>

          {/* Proof points */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-10">
            {PROOF_POINTS.map((point) => (
              <div
                key={point}
                className="flex items-center gap-2 text-sm text-white/80"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                {point}
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="mb-10">
            <span className="text-3xl sm:text-4xl font-bold">
              {BENCHMARK_PRICING.PRICE}
            </span>
            <span className="text-white/50 text-sm ml-2">all-inclusive</span>
            <p className="text-white/40 text-xs mt-2">
              Includes white-label branding + complimentary walkthrough
            </p>
          </div>

          {/* Scroll CTA */}
          <a
            href="#wizard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            Configure Your Brief
            <span aria-hidden="true" className="text-base">&#8595;</span>
          </a>
        </div>
      </section>

      {/* ── Wizard ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 dark:bg-slate-900">
        <BenchmarkIntakeWizard />
      </section>

      {/* ── What's Included ────────────────────────────────────────── */}
      <section className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center mb-12">
            What&apos;s Included
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BENCHMARK_PRICING.INCLUDES.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/30"
              >
                <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
