'use client';

import { fmtDelta, fmtScore } from '@/lib/radar/client/format';
import { percentileLabel, probabilityLabel, scoreToneKey, unrankedReason, type ScorePresentation } from '@/lib/radar/client/score-copy';
import { ConfidenceDot, Sparkline, cn } from './ui';

interface Props {
  score: number | null;
  confidence: number | null;
  delta30d: number | null;
  spark: number[];
  /** Percentile, probability and base rate (migration 126); optional so older payloads still render. */
  presentation?: Partial<ScorePresentation> | null;
  /** Cards get a larger figure; the table stays dense. */
  size?: 'table' | 'card';
}

const TONE_CLASS: Record<ReturnType<typeof scoreToneKey>, string> = {
  high: 'text-teal-700 dark:text-teal-300',
  mid: 'text-amber-700 dark:text-amber-300',
  neutral: 'text-neutral-800 dark:text-neutral-200',
  none: 'text-neutral-500 dark:text-neutral-500',
};

/**
 * Licensing intent score with its peer percentile, confidence dot and 30-day
 * movement. The score is a calibrated probability × 100 and most programs sit
 * under 15, so the colour and the second line come from the percentile.
 */
export function ScoreCell({ score, confidence, delta30d, spark, presentation, size = 'table' }: Props) {
  const p: ScorePresentation = { score, ...(presentation ?? {}) };
  const delta = fmtDelta(delta30d);
  const deltaTone = delta30d === null ? '' : delta30d > 0 ? 'text-teal-700 dark:text-teal-300' : delta30d < 0 ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-500';
  const pct = percentileLabel(p);
  const prob = probabilityLabel(p);
  const label =
    score === null
      ? 'Not yet scored'
      : [`Licensing intent ${fmtScore(score)} of 100`, pct, prob, delta ? `${delta} over 30 days` : null].filter(Boolean).join('. ');
  const title = score === null ? undefined : [prob, pct ?? unrankedReason(p)].filter(Boolean).join('\n');

  return (
    <div className="flex flex-col gap-0.5" aria-label={label} title={title}>
      <div className="flex items-center gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('font-mono tabular-nums font-semibold', size === 'card' ? 'text-2xl' : 'text-sm', TONE_CLASS[scoreToneKey(p)])}>
            {fmtScore(score)}
          </span>
          <ConfidenceDot confidence={confidence} />
        </div>
        {spark.length >= 2 ? (
          <Sparkline values={spark} width={size === 'card' ? 64 : 44} height={size === 'card' ? 20 : 16} />
        ) : delta ? (
          <span className={cn('font-mono text-[11px] tabular-nums', deltaTone)} aria-hidden>
            {delta}
          </span>
        ) : null}
      </div>
      {pct && (
        <span className={cn('truncate text-neutral-500 dark:text-neutral-400', size === 'card' ? 'text-xs' : 'text-[11px]')} aria-hidden>
          {pct}
        </span>
      )}
    </div>
  );
}
