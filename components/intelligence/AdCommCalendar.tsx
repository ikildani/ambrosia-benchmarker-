/**
 * FDA AdComm calendar widget — second intelligence surface after CT.gov
 * readouts. Displays a compact timeline of upcoming + recent FDA advisory
 * committee meetings, filtered by TA when a context is supplied.
 */

import type { EnrichedAdComm } from '@/lib/market-intelligence/fda-adcomm';

interface Props {
  meetings: EnrichedAdComm[];
  title?: string;
  taLabel?: string;
}

function urgencyStyle(u: EnrichedAdComm['urgency']): { label: string; color: string } {
  switch (u) {
    case 'imminent':
      return { label: 'Imminent', color: 'border-amber-500/40 bg-amber-500/10 text-amber-300' };
    case 'near-term':
      return { label: 'Near-term', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' };
    case 'watch':
      return { label: 'Watch', color: 'border-slate-700/50 bg-slate-900/40 text-slate-400' };
    case 'recent':
      return { label: 'Recent', color: 'border-slate-700/50 bg-slate-950/60 text-slate-500' };
  }
}

function fmtDays(d: number): string {
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 0 && d < 30) return `${d}d`;
  if (d > 0 && d < 90) return `${Math.round(d / 7)}w`;
  if (d > 0) return `${Math.round(d / 30)}mo`;
  const ago = -d;
  if (ago < 30) return `${ago}d ago`;
  if (ago < 90) return `${Math.round(ago / 7)}w ago`;
  return `${Math.round(ago / 30)}mo ago`;
}

function topicLabel(topic: string): string {
  const map: Record<string, string> = {
    approval_recommendation: 'Approval vote',
    accelerated_approval: 'Accel. approval',
    risk_benefit: 'Risk / benefit',
    pediatric_plan: 'Pediatric plan',
    briefing_only: 'Briefing',
  };
  return map[topic] ?? topic.replace(/_/g, ' ');
}

export function AdCommCalendar({ meetings, title, taLabel }: Props) {
  const heading = title ?? 'FDA Advisory Committee calendar';

  return (
    <aside className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{heading}</h3>
        {taLabel && (
          <p className="mt-0.5 text-xs text-slate-500 capitalize">{taLabel.replace(/_/g, ' ')}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Curated from fda.gov · ±60 days
        </p>
      </div>

      {meetings.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">
          No AdComm meetings in this TA / window.
        </p>
      ) : (
        <ol className="space-y-3">
          {meetings.map((m) => {
            const s = urgencyStyle(m.urgency);
            return (
              <li
                key={`${m.meetingDate}-${m.application}`}
                className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 transition-colors hover:border-slate-700"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${s.color}`}
                  >
                    {s.label}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    {fmtDays(m.daysFromToday)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-snug text-slate-200">
                  {m.application}
                </p>
                <p className="mt-1 text-xs leading-snug text-slate-400">
                  {m.sponsor} · {m.committeeShort} · <span className="capitalize">{topicLabel(m.topic)}</span>
                </p>
                {m.notes && (
                  <p className="mt-2 text-[11px] leading-snug text-slate-500">
                    {m.notes}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>{m.meetingDate}</span>
                  <a
                    href="https://www.fda.gov/advisory-committees/advisory-committee-calendar"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    FDA cal →
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4 rounded border border-slate-800/60 bg-slate-950/40 p-3 text-[11px] leading-relaxed text-slate-500">
        Why this matters: an AdComm vote is a binary event that resets deal
        comps within days. Positive outcomes spike comparable upfronts
        20&ndash;40%; negative outcomes collapse benchmarks. Most teams track
        these only on press release day &mdash; we surface the calendar so
        negotiations anchor on what&rsquo;s about to happen.
      </div>
    </aside>
  );
}
