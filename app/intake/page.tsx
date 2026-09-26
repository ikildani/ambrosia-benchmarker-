import type { Metadata } from 'next';
import Link from 'next/link';
import { BriefIntakeForm, type IntakePrefill } from '@/components/intake/BriefIntakeForm';
import { BENCHMARK_PRICING } from '@/lib/config/constants';

/**
 * Standalone intake for the Deal Intelligence Brief, linked from email:
 *   /intake?name=…&email=…&company=…&asset=…&indication=…&ref=…
 * Prefills what we already know so the client only adds what we do not.
 * Not indexed; the public product page is /benchmark.
 */

export const metadata: Metadata = {
  title: 'Deal Intelligence Brief — Intake | Solidus',
  description: 'Intake for a Deal Intelligence Brief: one asset, your own model and process, invoiced at intake.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }

const pick = (v: string | string[] | undefined): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);

export default async function IntakePage({ searchParams }: Props) {
  const sp = await searchParams;
  const prefill: IntakePrefill = {
    name: pick(sp.name), email: pick(sp.email), company: pick(sp.company), title: pick(sp.title),
    assetName: pick(sp.asset), indication: pick(sp.indication), ref: pick(sp.ref),
  };
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Deal Intelligence Brief</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Intake{prefill.name ? ` for ${prefill.name.split(' ')[0]}` : ''}</h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          One asset, one signed recommendation, about 30 data-backed pages, built from public data plus what you tell us here.
          {' '}{BENCHMARK_PRICING.PRICE}, invoiced within one business day; a 15-minute call on receipt; the brief within 24 hours of the call.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Required fields are the asset and your contact details. Sections 2 to 5 are optional; each one you fill replaces a public-data assumption with your own number.
          {' '}<Link href="/benchmark" className="text-teal-600 dark:text-teal-400 hover:underline">What the brief contains →</Link>
        </p>
        <div className="mt-8">
          <BriefIntakeForm prefill={prefill} intakePath="/intake" />
        </div>
      </div>
    </main>
  );
}
