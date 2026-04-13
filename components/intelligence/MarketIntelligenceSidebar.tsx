/**
 * Market Intelligence Sidebar — displays upcoming Phase 3 / Phase 2-3
 * trial readouts that affect the user's deal context. Sourced live from
 * ClinicalTrials.gov via lib/market-intelligence/ct-gov-events.ts.
 *
 * Designed to slot into a multi-column layout (e.g., right rail on
 * /trade-space or /simulator). Self-contained — fetches its own data
 * server-side via the loader function passed in.
 */

import Link from 'next/link';
import type { UpcomingReadout } from '@/lib/market-intelligence/ct-gov-events';

interface Props {
  readouts: UpcomingReadout[];
  /** Optional title override */
  title?: string;
  /** Optional therapeutic area context label */
  taLabel?: string;
}

function fmtDays(d: number): string {
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 30) return `${d}d`;
  if (d < 90) return `${Math.round(d / 7)}w`;
  return `${Math.round(d / 30)}mo`;
}

function fmtEnrollment(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function urgencyBucket(daysToReadout: number): { label: string; color: string } {
  if (daysToReadout <= 30) {
    return { label: 'Imminent', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' };
  }
  if (daysToReadout <= 60) {
    return { label: 'Near-term', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' };
  }
  return { label: 'Watch', color: 'border-slate-700/50 bg-slate-900/40 text-slate-400' };
}

export function MarketIntelligenceSidebar({ readouts, title, taLabel }: Props) {
  const heading = title ?? 'Upcoming Phase 3 readouts';

  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{heading}</h3>
        {taLabel && (
          <p className="mt-0.5 text-xs text-slate-500 capitalize">{taLabel.replace(/_/g, ' ')}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Live from ClinicalTrials.gov · next 90 days
        </p>
      </div>

      {readouts.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">
          No matching readouts in the next 90 days.
        </p>
      ) : (
        <ol className="space-y-3">
          {readouts.map((r) => {
            const urgency = urgencyBucket(r.daysToReadout);
            return (
              <li
                key={r.nctId}
                className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 transition-colors hover:border-slate-700"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${urgency.color}`}
                  >
                    {urgency.label}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmtDays(r.daysToReadout)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-snug text-slate-200">
                  {r.intervention ? `${r.intervention} · ` : ''}{r.sponsor}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-400">
                  {r.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>n={fmtEnrollment(r.enrollment)} · {r.phase.replace('PHASE', 'Ph ').replace('_', '/')}</span>
                  <Link
                    href={r.studyUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    NCT →
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 rounded border border-slate-800/60 bg-slate-950/40 p-3 text-[11px] leading-relaxed text-slate-500">
        Why this matters: when a Phase 3 trial reads out positive in your
        indication, comparable-deal pricing rises within weeks. A negative
        readout collapses peer benchmarks and can change the negotiation
        anchor by 30–60%.
      </div>
    </aside>
  );
}
