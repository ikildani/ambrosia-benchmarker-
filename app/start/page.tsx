import { Metadata } from 'next';
import Link from 'next/link';
import { OnboardingWizard } from '@/components/start/OnboardingWizard';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Get Started — Plain-English Onboarding | Solidus',
  description:
    'Six plain-English questions to value any biopharma asset. No need to know what biomarkerStatus or competitivePosition mean — we translate.',
  alternates: { canonical: `${BASE_URL}/start` },
  openGraph: {
    title: 'Get Started | Solidus',
    description: 'Six plain-English questions, then a full institutional valuation.',
    type: 'website',
    url: `${BASE_URL}/start`,
    siteName: 'Solidus',
    images: [
      {
        url: '/api/og?title=Get%20Started&subtitle=Plain-English%20valuation%20in%2060%20seconds',
        width: 1200,
        height: 630,
        alt: 'Ambrosia onboarding wizard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get Started | Solidus',
    description: 'Six plain-English questions, then a full institutional valuation.',
  },
};

export default function StartPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <nav className="mb-4 text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-300">← Solidus</Link>
          </nav>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
            Get started in 60 seconds
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-400">
            Six plain-English questions, then we run the same institutional engine that powers
            the calculator and surface the result. No finance vocabulary required &mdash; we
            translate &ldquo;biomarkerStatus&rdquo; and &ldquo;competitivePosition&rdquo; into questions
            anyone working on a biopharma asset can answer.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Already familiar with the inputs?{' '}
              <Link href="/calculator" className="text-cyan-400 hover:text-cyan-300">Skip to full calculator →</Link>
            </span>
          </div>
        </div>
      </section>

      <OnboardingWizard />

      <SiteFooter />
    </main>
  );
}
