import type { Metadata } from 'next';
import Link from 'next/link';
import { InstitutionalNav } from '@/components/institutional/InstitutionalNav';
import { BriefIntakeForm, type IntakePrefill } from '@/components/intake/BriefIntakeForm';
import { BENCHMARK_PRICING } from '@/lib/config/constants';

/**
 * Standalone intake for the Deal Intelligence Brief, linked from email:
 *   /intake?name=…&email=…&company=…&asset=…&indication=…&ref=…
 * Prefills what we already know so the client only adds what we do not.
 * Not indexed; the product page is /brief.
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
  const prefill: IntakePrefill = { name: pick(sp.name), email: pick(sp.email), company: pick(sp.company), title: pick(sp.title), assetName: pick(sp.asset), indication: pick(sp.indication), ref: pick(sp.ref) };
  const first = prefill.name?.split(' ')[0];

  return (
    <main className="min-h-screen overflow-x-clip bg-[#0b0e13] text-slate-100">
      <InstitutionalNav activePath="/brief" />
      <div className="mx-auto max-w-2xl px-6 pt-28 pb-24 lg:max-w-[calc(42rem+15rem+3.5rem)]">
        <header className="mb-12 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Deal Intelligence Brief · intake</p>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-50">{first ? `${first}, a few questions about the asset.` : 'A few questions about the asset.'}</h1>
          <p className="mt-2 text-sm text-slate-500">{BENCHMARK_PRICING.PRICE}, invoiced at intake · 15-minute call on receipt · delivered within 24 hours of the call · <Link href="/brief" className="text-teal-300 hover:underline">what the brief contains</Link></p>
        </header>
        <BriefIntakeForm prefill={prefill} intakePath="/intake" />
      </div>
    </main>
  );
}
