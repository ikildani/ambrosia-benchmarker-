'use client';

import { fmtDelta, fmtScore } from '@/lib/radar/client/format';
import { baseRateMultiple, percentileLabel, probabilityLabel, rankPhrase, scoreToneKey, unrankedReason, type ScorePresentation } from '@/lib/radar/client/score-copy';
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

const TONE_TEXT: Record<ReturnType<typeof scoreToneKey>, string> = {
  high: 'text-teal-700 dark:text-teal-300',
  mid: 'text-amber-700 dark:text-amber-300',
  neutral: 'text-neutral-700 dark:text-neutral-300',
  none: 'text-neutral-400 dark:text-neutral-500',
};

const TONE_BAR: Record<ReturnType<typeof scoreToneKey>, string> = {
  high: 'bg-teal-600 dark:bg-teal-400',
  mid: 'bg-amber-500',
  neutral: 'bg-neutral-400 dark:bg-neutral-500',
  none: 'bg-neutral-300 dark:bg-neutral-600',
};

/** Five-bar signal gauge from the peer percentile: 1 bar = bottom fifth, 5 = top fifth. */
export function SignalGauge({ pct, tone, className }: { pct: number | null | undefined; tone: ReturnType<typeof scoreToneKey>; className?: string }) {
  const lit = pct === null || pct === undefined ? 0 : Math.min(5, Math.max(1, Math.ceil((pct + 0.0001) / 20)));
  return (
    <span className={cn('inline-flex items-end gap-[2px]', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={cn('w-[3px] rounded-sm', i < lit ? TONE_BAR[tone] : 'bg-neutral-200 dark:bg-neutral-700')} style={{ height: `${5 + i * 2.5}px` }} />
      ))}
    </span>
  );
}

/**
 * Licensing intent as a peer rank. The raw score is a calibrated 12-month
 * probability × 100, so almost every program shows 0 to 5 and the number
 * alone says nothing; the gauge and "Top 3%" come from the percentile
 * within phase × therapeutic area, and the second line gives the actual
 * odds against the peer average. Unranked assets show the raw score.
 */
export function ScoreCell({ score, confidence, delta30d, spark, presentation, size = 'table' }: Props) {
  const p: ScorePresentation = { score, ...(presentation ?? {}) };
  const tone = scoreToneKey(p);
  const rank = rankPhrase(p.pct_peer);
  const pctLabel = percentileLabel(p);
  const prob = probabilityLabel(p);
  const multiple = baseRateMultiple(p);
  const delta = fmtDelta(delta30d);
  const label =
    score === null
      ? 'Not yet scored'
      : [pctLabel ?? `Licensing intent ${fmtScore(score)} of 100`, prob, delta ? `${delta} over 30 days` : null].filter(Boolean).join('. ');
  const title = score === null ? undefined : [pctLabel ?? unrankedReason(p), prob].filter(Boolean).join('\n');
  const odds = p.probability !== null && p.probability !== undefined && Number.isFinite(p.probability)
    ? `${(100 * p.probability) < 0.1 ? '<0.1' : (100 * p.probability).toFixed(100 * p.probability < 10 ? 1 : 0)}% odds`
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-0.5" aria-label={label} title={title}>
      <div className="flex items-center gap-2">
        <SignalGauge pct={p.pct_peer} tone={tone} className={size === 'card' ? 'scale-125' : undefined} />
        <span className={cn('truncate font-semibold tabular-nums', size === 'card' ? 'text-lg' : 'text-[13px]', TONE_TEXT[tone])}>
          {score === null ? 'Not scored' : rank ?? `${fmtScore(score)}`}
        </span>
        <ConfidenceDot confidence={confidence} />
        {spark.length >= 2 && <Sparkline values={spark} width={size === 'card' ? 56 : 36} height={14} />}
      </div>
      {score !== null && (odds || multiple || delta) && (
        <span className={cn('truncate tabular-nums text-neutral-500 dark:text-neutral-400', size === 'card' ? 'text-xs' : 'text-[12px]')} aria-hidden>
          {[odds, multiple, delta ? `${delta} 30d` : null].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  );
}
