import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { loadCompSetReport } from '@/lib/onboarding/comp-set-report';
import { CompSetReportView } from '@/components/comps/CompSetReportView';

/**
 * Comp set report: the page the "your comp set" email links to. Renders the
 * stored snapshot (comp_set_reports, migration 169); every row comes from
 * deals_verified. Anyone with the link can open it; it is never indexed.
 */

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const loaded = await loadCompSetReport(createServiceClient(), token);
  const title = loaded ? `${loaded.report.program.indicationLabel} comp set | Solidus` : 'Comp set | Solidus';
  return { title, robots: { index: false, follow: false, nocache: true } };
}

export default async function CompSetReportPage({ params }: Props) {
  const { token } = await params;
  const loaded = await loadCompSetReport(createServiceClient(), token, { countView: true });
  if (!loaded) notFound();
  if (loaded.expired) return <Expired />;
  return <CompSetReportView report={loaded.report} />;
}

function Expired() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md rounded-lg bg-white p-8 text-center shadow">
        <h1 className="text-lg font-bold text-[#1a1e42]">This comp set has expired</h1>
        <p className="mt-2 text-sm text-slate-600">Comparable deals move. Run your benchmark again and we will send you a fresh set.</p>
        <Link href="/calculator" className="mt-5 inline-block rounded-md bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white">Run a benchmark</Link>
      </div>
    </main>
  );
}

