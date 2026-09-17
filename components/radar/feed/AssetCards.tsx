'use client';

import Link from 'next/link';
import { radarLabel } from '@/lib/radar/vocab';
import type { FeedRow } from '@/lib/radar/client/api-types';
import { daysUntil, fmtDate, fmtRelative, fmtRights, shortLabel } from '@/lib/radar/client/format';
import { ScoreCell } from './ScoreCell';
import { CountryTag, FOCUS_RING, OwnerTypeChip, PartnershipTag, cn } from './ui';

interface Props {
  rows: FeedRow[];
  compareIds: string[];
  compareFull: boolean;
  onToggleCompare: (id: string) => void;
  loading?: boolean;
}

/** Card view: the same row payload, laid out for narrow screens and scanning. */
export function AssetCards({ rows, compareIds, compareFull, onToggleCompare, loading }: Props) {
  return (
    <ul
      aria-label="Assets"
      aria-busy={loading || undefined}
      className={cn('grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3', loading && 'opacity-60 transition-opacity motion-reduce:transition-none')}
    >
      {rows.map(row => {
        const inCompare = compareIds.includes(row.id);
        const catalystDays = daysUntil(row.next_catalyst_date);
        return (
          <li
            key={row.id}
            className={cn(
              'flex flex-col rounded-xl border bg-white p-4 dark:bg-neutral-900',
              inCompare ? 'border-teal-500/60' : 'border-neutral-200 dark:border-neutral-800',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/radar/${row.id}`}
                  className={cn('block truncate text-sm font-semibold text-neutral-900 hover:text-teal-700 dark:text-neutral-100 dark:hover:text-teal-300 rounded', FOCUS_RING)}
                >
                  {row.asset_name}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="truncate">{row.company_name}</span>
                  <CountryTag code={row.originator_country} />
                  <OwnerTypeChip type={row.owner_type} />
                </div>
              </div>
              <ScoreCell size="card" score={row.licensing_intent_score} confidence={row.score_confidence} delta30d={row.score_delta_30d} spark={row.score_spark} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <Field label="Phase" value={shortLabel(row.phase)} title={radarLabel(row.phase)} mono />
              <Field label="Modality" value={shortLabel(row.modality)} title={radarLabel(row.modality)} />
              <Field label="Area" value={row.therapeutic_area ? radarLabel(row.therapeutic_area) : '—'} />
              <Field label="Target" value={row.target ?? '—'} mono />
              <div className="col-span-2">
                <Field label="Indication" value={row.indication_specific ?? (row.indication_category ? radarLabel(row.indication_category) : '—')} />
              </div>
              <Field label="Rights" value={fmtRights(row.territory_rights_available)} />
              <div>
                <dt className="text-neutral-600 dark:text-neutral-400">Partnership</dt>
                <dd>
                  <PartnershipTag status={row.partnership_status} />
                </dd>
              </div>
              {row.next_catalyst_date && (
                <div className="col-span-2">
                  <dt className="text-neutral-600 dark:text-neutral-400">Next catalyst</dt>
                  <dd className="tabular-nums">
                    {fmtDate(row.next_catalyst_date)}
                    {catalystDays !== null && <span className="text-neutral-600 dark:text-neutral-400"> · primary completion in {catalystDays}d</span>}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
              <span className="text-neutral-600 dark:text-neutral-400">Updated {fmtRelative(row.last_update_date)}</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={inCompare}
                  disabled={!inCompare && compareFull}
                  onChange={() => onToggleCompare(row.id)}
                  className={cn('h-4 w-4 rounded border-neutral-400 text-teal-600 dark:border-neutral-600 dark:bg-neutral-900', FOCUS_RING)}
                />
                Compare
              </label>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, value, title, mono }: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-neutral-600 dark:text-neutral-400">{label}</dt>
      <dd className={cn('truncate text-neutral-900 dark:text-neutral-100', mono && 'font-mono')} title={title ?? value}>
        {value}
      </dd>
    </div>
  );
}
