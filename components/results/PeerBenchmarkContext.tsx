'use client';

/**
 * Carries the single peer-benchmark population (live pool, or a labelled
 * offline sample while loading / when the API is down) from Results.tsx to
 * the Analysis-tab widgets without threading a prop through every layer.
 */

import { createContext, useContext } from 'react';
import type { PeerBenchmarkSummary } from '@/lib/peer-benchmark';

export const PeerBenchmarkContext = createContext<PeerBenchmarkSummary | null>(null);

export function usePeerBenchmark(): PeerBenchmarkSummary | null {
  return useContext(PeerBenchmarkContext);
}
