import Link from 'next/link';
import { logoIconColor } from '@/lib/report/logo';
import {
  DEAL_PHASE_LABEL,
  STRUCTURE_LABEL,
  fmtM,
  fmtPct,
  type CompSetReport,
} from '@/lib/onboarding/comp-set-report';
import type { CompRow, CompStats } from '@/lib/brief/types';
import { PrintButton } from '@/components/comps/PrintButton';

/**
 * Comp set report, laid out like a Deal Intelligence Brief page (navy bar,
 * teal section rule, decision card, three stat cards, confidential footer)
 * but responsive, so it reads on a phone and prints to a clean PDF.
 */

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function CompSetReportView({ report: r }: { report: CompSetReport }) {
  const { program, headline } = r;
  const asOf = fmtDate(r.generatedAt);
  const lowConfidence = r.sameIndicationCount < 5;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body > footer, [data-cookie-consent] { display: none !important; }
          .avoid-break { break-inside: avoid; }
          .comp-report a { color: inherit; text-decoration: none; }
          .comp-report a[href^="http"]:after { content: none !important; }
        }
      `}</style>

      <article className="comp-report mx-auto w-full max-w-[920px] rounded-lg bg-white px-5 py-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] sm:px-10 sm:py-9 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {/* Navy top bar */}
        <header className="flex items-center justify-between gap-3 rounded-md bg-[#1a1e42] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: logoIconColor(18) }} />
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-white/75 sm:tracking-[0.16em]">Ambrosia Ventures</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] tracking-wide text-white/45 sm:inline">Comparable Deal Set</span>
            <span className="whitespace-nowrap rounded bg-[rgba(94,234,212,0.1)] px-2 py-0.5 text-[10px] font-bold text-[#5eead4]">{r.reportId}</span>
          </div>
        </header>

        {/* Title */}
        <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
          <div className="border-l-4 border-[#0d9488] pl-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1a1e42] sm:text-3xl">{program.indicationLabel} comp set</h1>
            <p className="mt-1.5 text-sm italic text-slate-500">
              The deals a buyer will price a {program.phaseLabel} {program.modalityLabel} {program.dealTypeLabel.toLowerCase()} in {program.indicationLabel} against.
            </p>
          </div>
          <PrintButton />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {r.preparedFor ? <>Prepared for <span className="font-semibold text-slate-700">{r.preparedFor}</span> · </> : null}
          As of {asOf} · {program.therapeuticAreaLabel}
        </p>

        {/* Summary card */}
        <div className="avoid-break relative mt-6 overflow-hidden rounded-lg bg-gradient-to-br from-[#1a1e42] to-[#23285a] px-6 py-5 text-white">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-[#0d9488]" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5eead4]">What deals like yours paid</p>
            <p className="text-[10px] text-white/45">as of {asOf}</p>
          </div>
          <p className="mt-2 text-xl font-extrabold sm:text-2xl">
            {headline.upfront ? `Median upfront ${fmtM(headline.upfront.p50)}` : 'Upfronts not disclosed'}
            {headline.total ? `, median total ${fmtM(headline.total.p50)}` : ''}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            {r.rows.length} comparable deals{r.sameIndicationCount ? `, ${r.sameIndicationCount} of them in ${program.indicationLabel}` : ''}, taken {r.phaseWindowLabel} of {program.phaseLabel}.
            Every deal is a verified row in the Solidus database with a link to the filing or release it was verified against.
          </p>
        </div>

        {/* Stat cards */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Upfront" accent="#0d9488" stats={headline.upfront} fmt={fmtM} valueClass="text-[#0d9488]" />
          <StatCard label="Total deal value" accent="#1a1e42" stats={headline.total} fmt={fmtM} valueClass="text-[#1a1e42]" />
          <StatCard label="Royalty (mid)" accent="#f59e0b" stats={headline.royaltyMid} fmt={fmtPct} valueClass="text-[#1a1e42]" />
        </div>

        <div className="mt-7 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* Benchmark vs comps */}
          <div className="avoid-break">
            <Eyebrow>Your benchmark against the comparables</Eyebrow>
            {r.benchmark.upfront || r.benchmark.total ? (
              <div className="space-y-5">
                {r.benchmark.upfront && headline.upfront && (
                  <RangeCompare label="Upfront" mine={r.benchmark.upfront} comps={headline.upfront} />
                )}
                {r.benchmark.total && headline.total && (
                  <RangeCompare label="Total deal value" mine={r.benchmark.total} comps={headline.total} />
                )}
                <p className="text-xs leading-relaxed text-slate-500">
                  <span className="mr-1 inline-block h-2 w-4 translate-y-[1px] rounded-sm bg-[#0d9488]/80" /> middle half of comparable deals, tick at the median
                  <span className="ml-3 mr-1 inline-block h-2 w-4 translate-y-[1px] rounded-sm bg-[#1a1e42]" /> your benchmark from the Solidus calculator
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Your saved benchmark did not include a range to compare.</p>
            )}
          </div>

          {/* By phase / structure */}
          <div className="avoid-break">
            <Eyebrow>How the set breaks down</Eyebrow>
            <BreakdownTable
              head="Phase at signing"
              rows={r.byPhase.map((b) => ({ label: DEAL_PHASE_LABEL[b.phase], stats: b.stats }))}
            />
            <div className="mt-4" />
            <BreakdownTable
              head="Structure"
              rows={r.byStructure.map((b) => ({ label: STRUCTURE_LABEL[b.structure], stats: b.stats }))}
            />
          </div>
        </div>

        {/* Comparable table */}
        <div className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Eyebrow className="mb-0">The comparable set</Eyebrow>
            <span className="text-[11px] text-slate-400">Same indication first, then by closeness · $ in millions unless shown</span>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="bg-[#1a1e42] text-[9px] font-bold uppercase tracking-[0.1em] text-white/80">
                  <th className="px-3 py-2.5">Deal</th>
                  <th className="px-2 py-2.5">Year</th>
                  <th className="px-2 py-2.5">Phase</th>
                  <th className="px-2 py-2.5">Structure</th>
                  <th className="px-2 py-2.5 text-right">Upfront</th>
                  <th className="px-2 py-2.5 text-right">Total</th>
                  <th className="px-2 py-2.5 text-right">Royalty</th>
                  <th className="px-3 py-2.5 text-right">Source</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row, i) => <CompTableRow key={row.id} row={row} zebra={i % 2 === 1} />)}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 text-xs font-extrabold text-[#0d9488]">
                  <td className="px-3 py-2.5 text-[10px] uppercase tracking-[0.08em] text-[#1a1e42]" colSpan={4}>Median, outliers excluded</td>
                  <td className="px-2 py-2.5 text-right">{fmtM(headline.upfront?.p50)}</td>
                  <td className="px-2 py-2.5 text-right">{fmtM(headline.total?.p50)}</td>
                  <td className="px-2 py-2.5 text-right">{fmtPct(headline.royaltyMid?.p50)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Method */}
        <div className="avoid-break mt-8 grid gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <Eyebrow>How this set was built</Eyebrow>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
              <li>Candidates are verified deals in the same therapeutic area, indication or mechanism with at least one disclosed economic term. Terminated and cancelled deals are excluded.</li>
              <li>Deals are ranked on phase, indication, modality, therapeutic area, territory and recency. Same-indication deals are listed first.</li>
              <li>Medians exclude outliers on total value (above the 75th percentile plus 1.5 times the interquartile range). Values are headline terms as disclosed, not risk-adjusted.</li>
              {r.caveat && <li>{r.caveat}</li>}
            </ul>
          </div>
          <div className="flex items-start">
            <span className={`rounded px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] ${lowConfidence ? 'bg-rose-100 text-rose-700' : 'bg-teal-50 text-teal-700'}`}>
              {lowConfidence ? 'Thin indication set' : 'Solid indication set'}
            </span>
          </div>
        </div>

        {/* Next step (screen only) */}
        <div className="avoid-break mt-8 rounded-lg border border-slate-200 bg-[#f4f8f8] p-5 print:hidden sm:p-6">
          <div className="border-l-4 border-[#1a1e42] pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Take it further</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              Solidus Pro runs every valuation engine on your program, ranks the buyers most likely to pay, and alerts you the day a new {program.indicationLabel} deal is signed.
              For one asset and one decision, the Deal Intelligence Brief gives a signed ask, floor and walk-away.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/trial?ref=comps" className="rounded-md bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f766e]">Start a 7-day Pro trial</Link>
              <Link href="/brief?ref=comps" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#1a1e42] hover:border-[#1a1e42]">See the Deal Intelligence Brief</Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 flex flex-col gap-1.5 border-t-2 border-slate-200 pt-3 text-[10px] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold uppercase tracking-[0.08em] text-slate-400">Confidential · {asOf}</span>
          <span className="text-slate-500">Powered by <span className="font-bold text-[#0d9488]">Ambrosia Ventures</span> · solidus.ambrosiaventures.co</span>
          <span className="font-bold text-[#0d9488]">{r.reportId}</span>
        </footer>
      </article>
    </main>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function Eyebrow({ children, className = 'mb-3' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ${className}`}>{children}</p>;
}

function StatCard({ label, accent, stats, fmt, valueClass }: {
  label: string;
  accent: string;
  stats: { p25: number; p50: number; p75: number } | null;
  fmt: (v: number | null | undefined) => string;
  valueClass: string;
}) {
  return (
    <div className="avoid-break rounded-md border border-slate-200 bg-white px-5 py-4" style={{ borderTop: `4px solid ${accent}` }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tracking-tight ${valueClass}`}>{stats ? fmt(stats.p50) : 'n/d'}</p>
      <p className="mt-1 text-xs text-slate-500">
        {stats ? <>middle half <span className="font-semibold text-slate-700">{fmt(stats.p25)}</span> to <span className="font-semibold text-slate-700">{fmt(stats.p75)}</span></> : 'not disclosed in this set'}
      </p>
    </div>
  );
}

function RangeCompare({ label, mine, comps }: {
  label: string;
  mine: { low: number; high: number };
  comps: { p25: number; p50: number; p75: number };
}) {
  const max = Math.max(mine.high, comps.p75) * 1.1 || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const width = (a: number, b: number) => `${Math.max(1.5, ((b - a) / max) * 100)}%`;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">yours {fmtM(mine.low)} to {fmtM(mine.high)} · comps {fmtM(comps.p25)} to {fmtM(comps.p75)}</span>
      </div>
      <div className="relative h-9 rounded bg-slate-100">
        <div className="absolute top-1.5 h-2.5 rounded-sm bg-[#0d9488]/80" style={{ left: pct(comps.p25), width: width(comps.p25, comps.p75) }} />
        <div className="absolute top-0.5 w-0.5 bg-[#0f766e]" style={{ left: pct(comps.p50), height: 18 }} />
        <div className="absolute bottom-1.5 h-2.5 rounded-sm bg-[#1a1e42]" style={{ left: pct(mine.low), width: width(mine.low, mine.high) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>$0</span><span>{fmtM(max)}</span></div>
    </div>
  );
}

function BreakdownTable({ head, rows }: { head: string; rows: Array<{ label: string; stats: CompStats }> }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-200 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
          <th className="py-1.5 text-left">{head}</th>
          <th className="py-1.5 text-right">Deals</th>
          <th className="py-1.5 text-right">Median upfront</th>
          <th className="py-1.5 text-right">Median total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.label} className="border-b border-slate-100">
            <td className="py-1.5 font-medium text-slate-700">{b.label}</td>
            <td className="py-1.5 text-right text-slate-500">{b.stats.n}</td>
            <td className="py-1.5 text-right font-semibold text-[#1a1e42]">{fmtM(b.stats.upfront?.p50)}</td>
            <td className="py-1.5 text-right font-semibold text-[#1a1e42]">{fmtM(b.stats.total?.p50)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompTableRow({ row, zebra }: { row: CompRow; zebra: boolean }) {
  const royalty = row.royaltyLowPct != null
    ? row.royaltyHighPct != null && row.royaltyHighPct !== row.royaltyLowPct
      ? `${fmtPct(row.royaltyLowPct)}–${fmtPct(row.royaltyHighPct)}`
      : fmtPct(row.royaltyLowPct)
    : '—';
  return (
    <tr className={`border-b border-slate-100 align-top text-xs ${zebra ? 'bg-slate-50' : 'bg-white'}`}>
      <td className="px-3 py-2.5">
        <div className="font-semibold text-[#1a1e42]">{row.licensor} <span className="text-slate-400">→</span> {row.licensee}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {row.sameIndication && <span className="rounded bg-teal-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-teal-700">Same indication</span>}
          {row.outlier && <span className="rounded bg-amber-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-700">Outlier</span>}
          <span className="line-clamp-1">{row.asset ? `${row.asset} · ` : ''}{row.indication}</span>
        </div>
      </td>
      <td className="px-2 py-2.5 text-slate-600">{row.year ?? '—'}</td>
      <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">{DEAL_PHASE_LABEL[row.phase]}</td>
      <td className="px-2 py-2.5 text-slate-600">{STRUCTURE_LABEL[row.structure]}</td>
      <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-slate-700">{row.upfrontM != null ? fmtM(row.upfrontM) : '—'}</td>
      <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold text-[#1a1e42]">{row.totalM != null ? fmtM(row.totalM) : '—'}</td>
      <td className="whitespace-nowrap px-2 py-2.5 text-right text-slate-600">{royalty}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        {row.sourceUrl
          ? <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0d9488] hover:underline">Source ↗</a>
          : <span className="text-slate-400">—</span>}
      </td>
    </tr>
  );
}

