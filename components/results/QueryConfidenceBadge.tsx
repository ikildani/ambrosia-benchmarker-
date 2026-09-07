'use client';

/**
 * QueryConfidenceBadge — shows per-query directional confidence for the
 * user's SPECIFIC input combination, not a global average.
 *
 * A BD professional needs to know: "for deals LIKE MINE (same TA, phase,
 * modality), how deep is the comparable pool, and does the engine's model
 * view sit inside it?" This badge answers that from the SAME comp population
 * as the hero band and the Comparables tab (PeerBenchmarkContext, fed by
 * GET /api/deals/peer-benchmark). While that is loading or unavailable it
 * falls back to the bundled corpus and says so ("offline sample").
 *
 * Goldman-grade transparency: every claim is traceable to the pool the user
 * can open on the Comparables tab.
 */

import { useMemo } from 'react';
import {
  computePeerBenchmark,
  toOfflineSample,
  type PeerBenchmarkSummary,
} from '@/lib/peer-benchmark';
import type { DealStructure } from '@/lib/financial/deal-structure-classifier';
import { usePeerBenchmark } from './PeerBenchmarkContext';
import { OfflineSampleTag } from './DirectionalRangeHero';

interface Props {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  dealType?: string;
  territory?: string;
  dealStructure?: DealStructure;
  engineUpfrontMedian?: number;
  /** The single comp population; falls back to context, then offline sample. */
  peerBenchmark?: PeerBenchmarkSummary | null;
}

type Level = 'high' | 'medium' | 'low' | 'insufficient';
type Tone = 'teal' | 'amber' | 'slate';

export interface QueryConfidenceAssessment {
  n: number;
  level: Level;
  label: string;
  description: string;
  tone: Tone;
  source: PeerBenchmarkSummary['source'];
}

/**
 * Pure assessment from the aggregate summary. Exported for tests.
 *
 *   high   — strict rung (no relaxation) and >= 8 comps
 *   medium — >= 5 comps and not widened all the way to TA-only
 *   low    — otherwise (>= 3)
 *   insufficient — < 3 comps
 */
export function assessQueryConfidence(
  b: PeerBenchmarkSummary,
  engineUpfrontMedian?: number,
): QueryConfidenceAssessment {
  const n = b.n;
  const suffix = b.source === 'live' ? '' : ' (offline sample)';

  if (n < 3 || b.nDisclosedUpfront < 3) {
    return {
      n,
      level: 'insufficient',
      label: 'Limited comparables',
      description: `Only ${n} similar disclosed deal${n === 1 ? '' : 's'} in the comparable pool${suffix}. Treat any number as highly uncertain.`,
      tone: 'slate',
      source: b.source,
    };
  }

  const strict = b.source === 'live' ? b.relaxation === 'none' : b.matchLevel === 'strict';
  const fullyWidened = b.source === 'live' ? b.relaxation === 'ta_only' : b.matchLevel === 'ta-only' || b.matchLevel === 'global';

  let level: Exclude<Level, 'insufficient'>;
  let tone: Tone;
  if (strict && n >= 8) {
    level = 'high'; tone = 'teal';
  } else if (n >= 5 && !fullyWidened) {
    level = 'medium'; tone = 'amber';
  } else {
    level = 'low'; tone = 'slate';
  }

  const levelLabels = {
    high: 'Strong directional signal',
    medium: 'Moderate directional signal',
    low: 'Weak directional signal',
  };

  const parts: string[] = [];
  parts.push(`${n} comparable disclosed deals in the pool${suffix}`);
  if (b.source === 'live') {
    if (b.relaxation === 'none') parts.push('Strict match: same TA + phase/indication');
    else if (b.relaxation === 'modality_only') parts.push('Widened to same TA + modality (thin strict pool)');
    else parts.push('Widened to therapeutic area only (thin pool)');
  } else if (b.matchLevel === 'strict') {
    parts.push('Strict match: same TA + phase + modality');
  } else if (b.matchLevel === 'widened') {
    parts.push('Widened: same TA + phase');
  } else {
    parts.push('Widened to therapeutic area');
  }

  if (engineUpfrontMedian && engineUpfrontMedian > 0) {
    const { p10, p25, p75, p90 } = b.upfrontPercentiles;
    if (engineUpfrontMedian >= p25 && engineUpfrontMedian <= p75) {
      parts.push('Engine model view sits inside the p25–p75 band of the comps');
    } else if (engineUpfrontMedian >= p10 && engineUpfrontMedian <= p90) {
      parts.push('Engine model view sits inside the p10–p90 band of the comps');
    } else {
      parts.push('Engine model view falls outside the p10–p90 band of the comps');
    }
  }

  return {
    n,
    level,
    label: levelLabels[level],
    description: parts.join('. ') + '.',
    tone,
    source: b.source,
  };
}

export function QueryConfidenceBadge({
  therapeuticArea,
  phase,
  modality,
  dealType,
  territory,
  dealStructure,
  engineUpfrontMedian,
  peerBenchmark,
}: Props) {
  const fromContext = usePeerBenchmark();

  const offline = useMemo(() => {
    if (!therapeuticArea) return null;
    return toOfflineSample(
      computePeerBenchmark({ therapeuticArea, phase, modality, dealType, territory, dealStructure }),
    );
  }, [therapeuticArea, phase, modality, dealType, territory, dealStructure]);

  const benchmark = peerBenchmark ?? fromContext ?? offline;

  const assessment = useMemo(
    () => (benchmark ? assessQueryConfidence(benchmark, engineUpfrontMedian) : null),
    [benchmark, engineUpfrontMedian],
  );

  if (!assessment) return null;

  const toneClasses: Record<Tone, string> = {
    teal: 'border-teal-500/40 bg-teal-500/5 text-teal-300',
    amber: 'border-amber-500/40 bg-amber-500/5 text-amber-300',
    slate: 'border-slate-600/40 bg-slate-800/30 text-slate-400',
  };

  const dotClasses: Record<Tone, string> = {
    teal: 'bg-teal-400',
    amber: 'bg-amber-400',
    slate: 'bg-slate-500',
  };

  return (
    <div className={`rounded-lg border p-3 ${toneClasses[assessment.tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <span className={`inline-block h-2 w-2 rounded-full ${dotClasses[assessment.tone]}`} />
          {assessment.label}
        </div>
        {assessment.source !== 'live' && <OfflineSampleTag />}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed opacity-80">
        {assessment.description}
      </p>
      {assessment.level === 'insufficient' && (
        <p className="mt-1 text-[10px] text-slate-500">
          The benchmark range and comparable deals shown are drawn from
          broader matches. Narrow results (exact TA + phase + modality)
          require more verified deals in this segment.
        </p>
      )}
    </div>
  );
}
