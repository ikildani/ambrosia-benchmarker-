'use client';

/**
 * One muted sentence under the headline cards on the results view:
 * "This profile: median error ±X% on N resolved deals".
 *
 * Reads the public, cached GET /api/outcomes/accuracy for (calculator | all
 * sources) × this TA × this phase × all-time and renders nothing until the
 * cell holds at least 10 accepted outcomes. Results.tsx is a client
 * component, so the fetch happens after mount; a failure renders nothing and
 * is logged with the [Outcomes] prefix.
 */

import { useEffect, useState } from 'react';
import { normalizePhase } from '@/lib/brief/comp-set';
import { calculatorAccuracyLine } from '@/lib/outcomes/statements';
import type { AccuracyRollupRow } from '@/lib/outcomes/types';

interface Props {
  therapeuticArea: string | null | undefined;
  phase: string | null | undefined;
  className?: string;
}

const KEY = /^[a-z0-9_\-.]{1,64}$/i;

async function fetchCells(params: URLSearchParams): Promise<AccuracyRollupRow[]> {
  const res = await fetch(`/api/outcomes/accuracy?${params.toString()}`, { cache: 'force-cache' });
  if (!res.ok) return [];
  const json = (await res.json()) as { rows?: AccuracyRollupRow[] };
  return json.rows ?? [];
}

export default function OutcomeAccuracyLine({ therapeuticArea, phase, className }: Props) {
  const [line, setLine] = useState<string | null>(null);
  const ta = therapeuticArea?.trim() ?? '';
  const phaseKey = phase ? normalizePhase(phase) : 'unknown';

  useEffect(() => {
    let cancelled = false;
    setLine(null);
    if (!ta || !KEY.test(ta) || phaseKey === 'unknown') return;
    const base = { ta, phase: phaseKey, window: 'all' };
    Promise.all([
      fetchCells(new URLSearchParams({ ...base, source: 'calculator' })),
      fetchCells(new URLSearchParams(base)),
    ])
      .then(([calc, all]) => {
        if (!cancelled) setLine(calculatorAccuracyLine([...calc, ...all]));
      })
      .catch((e: unknown) => {
        console.warn('[Outcomes] accuracy line fetch failed:', e instanceof Error ? e.message : e);
      });
    return () => { cancelled = true; };
  }, [ta, phaseKey]);

  if (!line) return null;
  return (
    <p className={`text-xs text-neutral-500 dark:text-slate-400 ${className ?? ''}`.trim()} data-testid="outcome-accuracy-line">
      {line}.
    </p>
  );
}
