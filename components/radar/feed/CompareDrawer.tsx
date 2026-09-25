'use client';

/**
 * Compare tray: a bottom bar while assets are selected, and a Headless
 * Dialog with a side-by-side table (score, top factors, phase, modality,
 * predicted terms when a thesis exists, rights, owner). Animation follows
 * prefers-reduced-motion.
 */

import { Fragment, useState } from 'react';
import { percentileLabel, probabilityLabel, unrankedReason } from '@/lib/radar/client/score-copy';
import Link from 'next/link';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { radarLabel } from '@/lib/radar/vocab';
import { COMPARE_LIMIT } from '@/lib/radar/client/filter-schema';
import type { CompareAsset } from '@/lib/radar/client/api-types';
import { useCompare, usePrefersReducedMotion } from '@/lib/radar/client/hooks';
import { factorLabel, fmtInt, fmtMillions, fmtPct, fmtRange, fmtRights, fmtScore, ownerTypeLabel, shortLabel } from '@/lib/radar/client/format';
import { ErrorState } from './FeedStates';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, CountryTag, FOCUS_RING, PartnershipTag, Skeleton, cn, scoreTone } from './ui';

interface Props {
  ids: string[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function CompareTray({ ids, onRemove, onClear }: Props) {
  const [open, setOpen] = useState(false);
  if (ids.length === 0) return null;
  return (
    <>
      <div
        role="region"
        aria-label="Compare tray"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">
            <span className="font-mono font-semibold tabular-nums">{ids.length}</span> of {COMPARE_LIMIT} selected to compare
            {ids.length < 2 && <span className="text-neutral-600 dark:text-neutral-400"> · pick at least two</span>}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClear} className={BTN_GHOST}>
              Clear
            </button>
            <button type="button" onClick={() => setOpen(true)} disabled={ids.length < 2} className={BTN_PRIMARY}>
              Compare
            </button>
          </div>
        </div>
      </div>
      <CompareDialog open={open} onClose={() => setOpen(false)} ids={ids} onRemove={onRemove} />
    </>
  );
}

function CompareDialog({ open, onClose, ids, onRemove }: { open: boolean; onClose: () => void; ids: string[]; onRemove: (id: string) => void }) {
  const reduced = usePrefersReducedMotion();
  const dur = reduced ? 'duration-0' : 'duration-200';
  const { assets, status, error, retry } = useCompare(open ? ids : []);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild as={Fragment} enter={`ease-out ${dur}`} enterFrom="opacity-0" enterTo="opacity-100" leave={`ease-in ${dur}`} leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-neutral-950/50" aria-hidden />
        </TransitionChild>
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6">
          <TransitionChild
            as={Fragment}
            enter={`ease-out ${dur}`}
            enterFrom="translate-y-6 opacity-0"
            enterTo="translate-y-0 opacity-100"
            leave={`ease-in ${dur}`}
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-6 opacity-0"
          >
            <DialogPanel className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:rounded-2xl">
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
                <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Compare assets</DialogTitle>
                <button type="button" onClick={onClose} aria-label="Close compare" className={cn(BTN_GHOST, 'p-1.5')}>
                  <XMarkIcon className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div className="overflow-auto">
                {status === 'error' && error ? (
                  <ErrorState message={error} onRetry={retry} compact />
                ) : status === 'loading' && assets.length === 0 ? (
                  <div className="space-y-3 p-5" role="status" aria-label="Loading comparison">
                    {Array.from({ length: 6 }, (_, i) => (
                      <Skeleton key={`cmp-${i}`} className="h-6 w-full" />
                    ))}
                  </div>
                ) : (
                  <CompareTable assets={assets} onRemove={onRemove} />
                )}
              </div>
              <div className="flex justify-end border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>
                  Done
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

interface RowDef {
  label: string;
  render: (a: CompareAsset) => React.ReactNode;
}

const ROWS: RowDef[] = [
  {
    label: 'Licensing intent',
    render: a => (
      <span className={cn('font-mono text-lg font-semibold tabular-nums', scoreTone(a.licensing_intent_score))}>
        {fmtScore(a.licensing_intent_score)}
        <span className="ml-1 text-xs font-normal text-neutral-600 dark:text-neutral-400">conf. {fmtScore(a.score_confidence)}</span>
      </span>
    ),
  },
  {
    label: 'Top factors',
    render: a =>
      a.factors.length ? (
        <ul className="space-y-1">
          {a.factors.map(f => (
            <li key={f.factor} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate" title={f.evidence_text ?? undefined}>
                {factorLabel(f.factor)}
              </span>
              <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{fmtScore(f.score)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs text-neutral-500">No active factors</span>
      ),
  },
  {
    label: 'Peer percentile',
    render: a => {
      const p = { score: a.licensing_intent_score, probability: a.score_probability, pct_peer: a.score_pct_peer, peer_n: a.score_peer_n, peer_key: a.score_peer_key, base_rate: a.score_base_rate };
      const pct = percentileLabel(p, { withN: true });
      return pct ? <span title={probabilityLabel(p) ?? undefined}>{pct}</span> : <span className="text-neutral-500">{unrankedReason(p)}</span>;
    },
  },
  {
    label: 'Why now',
    render: a => {
      const drivers = (a.score_top_drivers ?? []).slice(0, 2);
      if (!drivers.length) return <span className="text-neutral-500">No drivers recorded</span>;
      return (
        <ul className="space-y-0.5">
          {drivers.map(d => (
            <li key={d.factor} className="truncate" title={d.evidence ?? undefined}>
              <span className="font-mono tabular-nums">{d.points > 0 ? '+' : ''}{d.points}</span> {d.factor.replace(/_/g, ' ')}
            </li>
          ))}
        </ul>
      );
    },
  },
  { label: 'Deal readiness', render: a => <span className="font-mono tabular-nums">{fmtScore(a.deal_readiness_score)}</span> },
  { label: 'Competitive heat', render: a => <span className="font-mono tabular-nums">{fmtScore(a.competitive_heat)}</span> },
  { label: 'Phase', render: a => <span title={radarLabel(a.phase)}>{radarLabel(a.phase)}</span> },
  { label: 'Modality', render: a => radarLabel(a.modality) },
  {
    label: 'Area / indication',
    render: a => (
      <>
        <div>{a.therapeutic_area ? radarLabel(a.therapeutic_area) : '—'}</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400">{a.indication_specific ?? (a.indication_category ? radarLabel(a.indication_category) : '')}</div>
      </>
    ),
  },
  { label: 'Target / mechanism', render: a => (
    <>
      <div className="font-mono text-xs">{a.target ?? '—'}</div>
      {a.mechanism && <div className="text-xs text-neutral-600 dark:text-neutral-400">{a.mechanism}</div>}
    </>
  ) },
  {
    label: 'Predicted upfront',
    render: a => (a.terms ? <Terms t={a.terms} kind="upfront" /> : <span className="text-xs text-neutral-500">No thesis yet</span>),
  },
  {
    label: 'Predicted total',
    render: a => (a.terms ? <Terms t={a.terms} kind="total" /> : <span className="text-xs text-neutral-500">—</span>),
  },
  {
    label: 'Predicted royalty',
    render: a => (a.terms ? <Terms t={a.terms} kind="royalty" /> : <span className="text-xs text-neutral-500">—</span>),
  },
  { label: 'Partnership', render: a => <PartnershipTag status={a.partnership_status} /> },
  { label: 'Rights available', render: a => fmtRights(a.territory_rights_available) },
  {
    label: 'Owner',
    render: a => (
      <>
        <div className="flex items-center gap-1.5">
          <span className="truncate">{a.company_name}</span>
          <CountryTag code={a.originator_country} />
        </div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400">{ownerTypeLabel(a.owner_type)}</div>
      </>
    ),
  },
  { label: 'Trials / enrollment', render: a => `${fmtInt(a.trial_count)} · ${fmtInt(a.enrollment_total)}` },
  {
    label: 'Designations',
    render: a => (a.regulatory_designations?.length ? a.regulatory_designations.map(d => radarLabel(d)).join(', ') : '—'),
  },
];

function Terms({ t, kind }: { t: NonNullable<CompareAsset['terms']>; kind: 'upfront' | 'total' | 'royalty' }) {
  const value =
    kind === 'upfront'
      ? fmtRange(t.upfront_low, t.upfront_mid, t.upfront_high, fmtMillions)
      : kind === 'total'
        ? fmtRange(t.total_low, t.total_mid, t.total_high, fmtMillions)
        : fmtRange(t.royalty_low, t.royalty_mid, t.royalty_high, fmtPct);
  return (
    <div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
      <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
        n={t.comp_count} · conf. {t.confidence}
        {t.relaxation ? ` · ${radarLabel(t.relaxation)} comps` : ''}
        {t.insufficient_comps ? ' · too few comps' : ''}
      </div>
    </div>
  );
}

function CompareTable({ assets, onRemove }: { assets: CompareAsset[]; onRemove: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm text-neutral-800 dark:text-neutral-200">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 w-40 bg-white p-3 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <span className="sr-only">Attribute</span>
            </th>
            {assets.map(a => (
              <th scope="col" key={a.id} className="min-w-[180px] p-3 text-left align-top">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/radar/${a.id}`} className={cn('font-semibold text-neutral-900 hover:text-teal-700 dark:text-neutral-100 dark:hover:text-teal-300 rounded', FOCUS_RING)}>
                    {a.asset_name}
                  </Link>
                  <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.asset_name} from compare`} className={cn(BTN_GHOST, 'p-1')}>
                    <XMarkIcon className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="text-xs font-normal text-neutral-600 dark:text-neutral-400">{shortLabel(a.phase)} · {shortLabel(a.modality)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => (
            <tr key={row.label} className="border-t border-neutral-100 dark:border-neutral-800">
              <th scope="row" className="sticky left-0 z-10 bg-white p-3 text-left text-xs font-semibold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                {row.label}
              </th>
              {assets.map(a => (
                <td key={`${row.label}-${a.id}`} className="p-3 align-top">
                  {row.render(a)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
