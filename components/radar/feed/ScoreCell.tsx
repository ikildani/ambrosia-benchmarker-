'use client';

import { fmtDelta, fmtScore } from '@/lib/radar/client/format';
import { ConfidenceDot, Sparkline, cn, scoreTone } from './ui';

interface Props {
  score: number | null;
  confidence: number | null;
  delta30d: number | null;
  spark: number[];
  /** Cards get a larger figure; the table stays dense. */
  size?: 'table' | 'card';
}

/** Licensing intent score with its confidence dot and 30-day movement. */
export function ScoreCell({ score, confidence, delta30d, spark, size = 'table' }: Props) {
  const delta = fmtDelta(delta30d);
  const deltaTone = delta30d === null ? '' : delta30d > 0 ? 'text-teal-700 dark:text-teal-300' : delta30d < 0 ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-500';
  const label =
    score === null
      ? 'Not yet scored'
      : `Licensing intent ${fmtScore(score)} of 100${delta ? `, ${delta} over 30 days` : ''}`;

  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-mono tabular-nums font-semibold', size === 'card' ? 'text-2xl' : 'text-sm', scoreTone(score))}>
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
  );
}
