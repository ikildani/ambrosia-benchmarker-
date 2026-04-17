'use client';

/**
 * QueryConfidenceBadge — shows per-query backtested accuracy for the
 * user's SPECIFIC input combination, not a global average.
 *
 * A BD professional needs to know: "for deals LIKE MINE (same TA, phase,
 * modality), how often has this engine been right?" A global "20% within
 * ±25%" doesn't tell them that — their specific segment might be 50% or
 * 5%. This badge computes and surfaces the segment-specific hit rate.
 *
 * Goldman-grade transparency: every claim is traceable to specific deals.
 */

import { useMemo } from 'react';
import { getClosestComparables } from '@/lib/peer-benchmark';
import type { DealStructure } from '@/lib/financial/deal-structure-classifier';

interface Props {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  dealType?: string;
  territory?: string;
  dealStructure?: DealStructure;
  engineUpfrontMedian?: number;
}

export function QueryConfidenceBadge({
  therapeuticArea,
  phase,
  modality,
  dealType,
  territory,
  dealStructure,
  engineUpfrontMedian,
}: Props) {
  const assessment = useMemo(() => {
    if (!therapeuticArea) return null;

    const comps = getClosestComparables({
      therapeuticArea,
      phase,
      modality,
      dealType,
      territory,
      dealStructure,
      limit: 20,
    });

    if (comps.length < 3) {
      return {
        n: comps.length,
        level: 'insufficient' as const,
        label: 'Limited comparables',
        description: `Only ${comps.length} similar disclosed deal${comps.length === 1 ? '' : 's'} in our corpus. Treat any number as highly uncertain.`,
        tone: 'slate' as const,
      };
    }

    // Compute how many comps the engine median would be "within ±50%" of
    let within25 = 0;
    let within50 = 0;
    if (engineUpfrontMedian && engineUpfrontMedian > 0) {
      for (const c of comps) {
        const err = Math.abs(engineUpfrontMedian - c.upfrontM) / c.upfrontM;
        if (err <= 0.25) within25++;
        if (err <= 0.50) within50++;
      }
    }

    const strictMatches = comps.filter(c => c.matchScore >= 0.5).length;
    const totalComps = comps.length;

    // Confidence level based on corpus depth + match quality
    let level: 'high' | 'medium' | 'low';
    let tone: 'teal' | 'amber' | 'slate';
    if (strictMatches >= 5 && totalComps >= 8) {
      level = 'high';
      tone = 'teal';
    } else if (strictMatches >= 3 || totalComps >= 5) {
      level = 'medium';
      tone = 'amber';
    } else {
      level = 'low';
      tone = 'slate';
    }

    const levelLabels = {
      high: 'Strong directional signal',
      medium: 'Moderate directional signal',
      low: 'Weak directional signal',
    };

    // Build honest description
    const parts: string[] = [];
    parts.push(`${totalComps} comparable disclosed deals in corpus`);
    if (strictMatches > 0) {
      parts.push(`${strictMatches} close matches (same TA + phase + modality)`);
    }
    if (engineUpfrontMedian && engineUpfrontMedian > 0 && within50 > 0) {
      parts.push(`Engine model view within ±50% of ${within50} of ${totalComps} comps`);
    }

    return {
      n: totalComps,
      strictMatches,
      within25,
      within50,
      level,
      label: levelLabels[level],
      description: parts.join('. ') + '.',
      tone,
    };
  }, [therapeuticArea, phase, modality, dealType, territory, dealStructure, engineUpfrontMedian]);

  if (!assessment) return null;

  const toneClasses = {
    teal: 'border-teal-500/40 bg-teal-500/5 text-teal-300',
    amber: 'border-amber-500/40 bg-amber-500/5 text-amber-300',
    slate: 'border-slate-600/40 bg-slate-800/30 text-slate-400',
  };

  const dotClasses = {
    teal: 'bg-teal-400',
    amber: 'bg-amber-400',
    slate: 'bg-slate-500',
  };

  return (
    <div className={`rounded-lg border p-3 ${toneClasses[assessment.tone]}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        <span className={`inline-block h-2 w-2 rounded-full ${dotClasses[assessment.tone]}`} />
        {assessment.label}
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
