'use client';

import { useMemo, useState } from 'react';
import type { TrialRow, CatalystRow } from './types';
import { SectionCard, ExternalLink, EmptyState, btnGhost } from './ui';
import { label, fmtDate, fmtNum } from './format';

const PAGE = 10;

const STATUS_TONE: Record<string, string> = {
  recruiting: 'text-emerald-700 dark:text-emerald-400',
  active_not_recruiting: 'text-sky-700 dark:text-sky-400',
  completed: 'text-neutral-600 dark:text-neutral-300',
  terminated: 'text-rose-700 dark:text-rose-400',
  withdrawn: 'text-rose-700 dark:text-rose-400',
  suspended: 'text-amber-700 dark:text-amber-400',
};

export function TrialsTable({ trials, catalysts }: { trials: TrialRow[]; catalysts: CatalystRow[] }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(trials.length / PAGE));
  const rows = useMemo(() => trials.slice((page - 1) * PAGE, page * PAGE), [trials, page]);
  const upcoming = catalysts.filter(c => c.date >= new Date().toISOString().slice(0, 10));

  return (
    <SectionCard id="trials" title="Clinical program" meta={<span>{trials.length} trial{trials.length === 1 ? '' : 's'} linked by NCT</span>}>
      {upcoming.length > 0 && (
        <div className="mb-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Catalyst timeline</h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Upcoming catalysts">
            {upcoming.slice(0, 6).map(c => (
              <li key={c.id} className="rounded-md border border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800">
                <p className="font-mono tabular-nums text-neutral-900 dark:text-neutral-100">{fmtDate(c.date)}</p>
                <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">{c.title}</p>
                {c.detail && <p className="mt-0.5 line-clamp-2 text-neutral-500 dark:text-neutral-400">{c.detail}</p>}
                {c.nct_id && <ExternalLink href={`https://clinicaltrials.gov/study/${c.nct_id}`} className="mt-1 inline-block">{c.nct_id}</ExternalLink>}
                <span className="sr-only">source {c.source.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {trials.length === 0 ? (
        <EmptyState title="No registry trials linked" detail="The universe indexer links trials by NCT id; none are attached to this asset yet." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-xs">
              <caption className="sr-only">Registry trials for this asset</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  <th scope="col" className="py-2 pr-3">NCT</th>
                  <th scope="col" className="py-2 pr-3">Phase</th>
                  <th scope="col" className="py-2 pr-3">Status</th>
                  <th scope="col" className="py-2 pr-3">Primary completion</th>
                  <th scope="col" className="py-2 pr-3 text-right">Enrollment</th>
                  <th scope="col" className="py-2 pr-3">Countries</th>
                  <th scope="col" className="py-2 pr-3">Sponsor</th>
                  <th scope="col" className="py-2">Title</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.nct_id} className="border-b border-neutral-100 align-top dark:border-neutral-800/70">
                    <td className="py-2 pr-3 font-mono"><ExternalLink href={`https://clinicaltrials.gov/study/${t.nct_id}`}>{t.nct_id}</ExternalLink>{t.registry && t.registry !== 'ctgov' && <span className="block text-[10px] text-neutral-500">{t.registry}</span>}</td>
                    <td className="py-2 pr-3 text-neutral-700 dark:text-neutral-300">{label(t.phase)}</td>
                    <td className={`py-2 pr-3 ${STATUS_TONE[t.status || ''] ?? 'text-neutral-600 dark:text-neutral-300'}`}>{(t.status || 'unknown').replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{fmtDate(t.primary_completion_date)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{fmtNum(t.enrollment_count)}</td>
                    <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300" title={t.locations_countries.join(', ')}>{t.locations_countries.slice(0, 4).join(', ')}{t.locations_countries.length > 4 ? ` +${t.locations_countries.length - 4}` : ''}{t.locations_countries.length === 0 ? '—' : ''}</td>
                    <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300">{t.lead_sponsor_name || '—'}{t.is_collaboration && t.collaborator_names.length > 0 && <span className="block text-[10px] text-neutral-500">with {t.collaborator_names.slice(0, 2).join(', ')}</span>}</td>
                    <td className="py-2 text-neutral-700 dark:text-neutral-300"><span className="line-clamp-2">{t.trial_title || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav className="mt-3 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300" aria-label="Trials pagination">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-1">
                <button type="button" className={btnGhost} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
                <button type="button" className={btnGhost} onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Next</button>
              </div>
            </nav>
          )}
        </>
      )}
    </SectionCard>
  );
}
