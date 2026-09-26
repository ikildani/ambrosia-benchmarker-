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
      <div className="mx-auto max-w-6xl px-6 pt-28 pb-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-slate-800/80 pb-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Deal Intelligence Brief · intake</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{first ? `${first}, tell us about the asset.` : 'Tell us about the asset.'}</h1>
            <p className="mt-3 text-slate-400">One asset, one signed recommendation, about thirty data-backed pages, built from public data plus what you add here. Two minutes with the asset alone; ten with your model to hand.</p>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-sm">
            {[[BENCHMARK_PRICING.PRICE, 'invoiced at intake'], ['15 min', 'call on receipt'], ['24 h', 'to delivery']].map(([v, l]) => (
              <div key={l}><dt className="font-mono text-xl font-semibold text-slate-50">{v}</dt><dd className="mt-0.5 text-xs text-slate-500">{l}</dd></div>
            ))}
          </dl>
        </div>
        <BriefIntakeForm prefill={prefill} intakePath="/intake" />
        <p className="mt-8 text-xs text-slate-600">What the brief contains, page by page: <Link href="/brief" className="text-teal-300 hover:underline">/brief</Link>.</p>
      </div>
    </main>
  );
}
