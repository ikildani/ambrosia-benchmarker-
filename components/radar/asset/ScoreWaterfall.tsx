'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { ScoreBreakdown, ScoreTrend } from './types';
import { SectionCard, ExternalLink, btnGhost } from './ui';
import { fmtDate, signedPts } from './format';
import { TrendSparkline } from './TrendSparkline';

/**
 * Waterfall from zero through every factor's points to the weighted total,
 * then the two multipliers (phase prior, rights availability) to the
 * composite. Rendered as an accessible table with inline bars; zero-score
 * factors stay visible with "checked N sources" so the absence of evidence
 * is itself legible.
 */
export function ScoreWaterfall({ score, trend }: { score: ScoreBreakdown; trend: ScoreTrend }) {
  const [openFactor, setOpenFactor] = useState<string | null>(null);
  const [window, setWindow] = useState<7 | 30 | 90>(30);
  const maxPts = Math.max(1, ...score.contributions.map(c => c.points), score.raw_weighted);
  const factorSteps = score.waterfall.filter(s => s.kind === 'factor');
  const tailSteps = score.waterfall.filter(s => s.kind !== 'factor');

  return (
    <SectionCard
      id="intent"
      title="Licensing intent"
      meta={
        <span>
          model <span className="font-mono">{score.model_version}</span>
          {score.snapshot_date && <> · snapshot {score.snapshot_date}</>}
          {' · '}
          <Link href="/radar/methodology" className="text-amber-700 underline underline-offset-2 dark:text-amber-400">Methodology</Link>
        </span>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Composite</p>
              <p className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{score.score}<span className="text-sm font-normal text-neutral-400"> /100</span></p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Evidence completeness {score.confidence}% — confidence is how much was checked, not how right the score is.</p>
            </div>
            {score.legacy_shape && (
              <p className="max-w-xs text-xs text-neutral-500 dark:text-neutral-400">Decomposition reconstructed from the v2 snapshot map and active signals; per-factor evidence links appear once the v3 scorer writes contributions.</p>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Score waterfall: factor points, multipliers and the composite</caption>
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <th scope="col" className="py-1.5 pr-2 font-semibold">Factor</th>
                  <th scope="col" className="py-1.5 pr-2 font-semibold">Weight</th>
                  <th scope="col" className="py-1.5 pr-2 font-semibold">Score</th>
                  <th scope="col" className="w-[38%] py-1.5 pr-2 font-semibold">Points</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Running</th>
                </tr>
              </thead>
              <tbody>
                {factorSteps.map(step => {
                  const c = step.contribution!;
                  const open = openFactor === c.factor;
                  const width = Math.max(0, Math.min(100, (c.points / maxPts) * 100));
                  return (
                    <FactorRows key={c.factor} open={open} onToggle={() => setOpenFactor(open ? null : c.factor)} width={width} label={step.label} contribution={c} running={step.running} />
                  );
                })}
                {tailSteps.map(step => (
                  <tr key={step.key} className={`border-t ${step.key === 'composite' ? 'border-neutral-400 dark:border-neutral-600' : 'border-neutral-200 dark:border-neutral-800'}`}>
                    <td className={`py-2 pr-2 ${step.key === 'composite' ? 'font-semibold text-neutral-900 dark:text-neutral-50' : 'text-neutral-700 dark:text-neutral-300'}`}>{step.label}</td>
                    <td className="py-2 pr-2 text-neutral-500 dark:text-neutral-400" colSpan={2}>
                      {step.kind === 'multiplier' ? <span className="font-mono tabular-nums">× {step.value.toFixed(2)}</span> : step.key === 'raw_weighted' ? 'sum of points' : ''}
                    </td>
                    <td className="py-2 pr-2">
                      {step.kind === 'multiplier' && (
                        <div className="h-2 w-full rounded-sm bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
                          <div className="h-2 rounded-sm bg-neutral-500 dark:bg-neutral-400" style={{ width: `${Math.max(0, Math.min(100, step.value * 100)).toFixed(1)}%` }} />
                        </div>
                      )}
                    </td>
                    <td className={`py-2 text-right font-mono tabular-nums ${step.key === 'composite' ? 'text-base font-semibold text-neutral-900 dark:text-neutral-50' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {step.key === 'composite' ? step.value.toFixed(0) : step.running.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800" aria-label="Score trend">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Trend</p>
            <div role="group" aria-label="Trend window" className="flex gap-1">
              {([7, 30, 90] as const).map(d => (
                <button key={d} type="button" onClick={() => setWindow(d)} aria-pressed={window === d} className={`${btnGhost} ${window === d ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`}>{d}d</button>
              ))}
            </div>
          </div>
          <div className="mt-2">
            <TrendSparkline points={trend.points} days={window} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {([['7d', trend.delta_7d], ['30d', trend.delta_30d], ['90d', trend.delta_90d]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{k}</dt>
                <dd className={`font-mono text-sm tabular-nums ${v == null ? 'text-neutral-400' : v > 0 ? 'text-emerald-700 dark:text-emerald-400' : v < 0 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-700 dark:text-neutral-300'}`}>{signedPts(v, 0)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs capitalize text-neutral-500 dark:text-neutral-400">Current trend: {trend.current_trend}</p>
        </aside>
      </div>
    </SectionCard>
  );
}

function FactorRows({ open, onToggle, width, label, contribution: c, running }: { open: boolean; onToggle: () => void; width: number; label: string; contribution: ScoreBreakdown['contributions'][number]; running: number }) {
  const hasEvidence = !!c.evidence_text || !!c.evidence_url;
  const detailId = `factor-${c.factor}-detail`;
  return (
    <>
      <tr className="border-t border-neutral-200 dark:border-neutral-800">
        <td className="py-2 pr-2">
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={detailId} className="inline-flex items-center gap-1 text-left text-neutral-800 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-neutral-200 dark:hover:text-white">
            <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            <span>{label}</span>
          </button>
        </td>
        <td className="py-2 pr-2 font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{(c.weight * 100).toFixed(0)}%</td>
        <td className="py-2 pr-2 font-mono text-xs tabular-nums text-neutral-700 dark:text-neutral-300">{Math.round(c.score)}</td>
        <td className="py-2 pr-2">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-sm bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
              <div className={`h-2 rounded-sm ${c.points > 0 ? 'bg-amber-500' : 'bg-transparent'}`} style={{ width: `${width.toFixed(1)}%` }} />
            </div>
            <span className="w-12 text-right font-mono text-xs tabular-nums text-neutral-800 dark:text-neutral-200">+{c.points.toFixed(1)}</span>
          </div>
        </td>
        <td className="py-2 text-right font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{running.toFixed(1)}</td>
      </tr>
      <tr id={detailId} hidden={!open} className="border-t border-transparent">
        <td colSpan={5} className="pb-3 pl-5 pr-2 text-xs text-neutral-600 dark:text-neutral-300">
          {hasEvidence ? (
            <div className="space-y-1">
              {c.evidence_text && <p className="max-w-3xl">{c.evidence_text}</p>}
              <p className="text-neutral-500 dark:text-neutral-400">
                {c.evidence_date && <span>{fmtDate(c.evidence_date)} · </span>}
                {c.evidence_url && <ExternalLink href={c.evidence_url}>Source</ExternalLink>}
                {c.evidence_url && ' · '}
                <span>confidence {Math.round(c.confidence)}%</span>
                {c.sources_checked.length > 0 && <span> · checked {c.sources_checked.join(', ')}</span>}
              </p>
            </div>
          ) : (
            <p className="text-neutral-500 dark:text-neutral-400">
              No evidence found. Checked {c.sources_checked.length || 0} source{c.sources_checked.length === 1 ? '' : 's'}{c.sources_checked.length ? `: ${c.sources_checked.join(', ')}` : ''}. A zero here means nothing was detected, not that the factor was skipped.
            </p>
          )}
        </td>
      </tr>
    </>
  );
}
