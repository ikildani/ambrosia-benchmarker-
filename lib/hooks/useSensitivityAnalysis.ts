'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalculationInput, CalculationResult } from '../calculations';
import { SensitivityData, computeSensitivityAnalysis } from '../sensitivity';

interface UseSensitivityAnalysisResult {
  sensitivityData: SensitivityData | null;
  isComputing: boolean;
  recompute: () => void;
}

// Generate a stable hash of inputs for memoization
function hashInputs(inputs: CalculationInput): string {
  return JSON.stringify(inputs);
}

export function useSensitivityAnalysis(
  inputs: CalculationInput | null,
  result: CalculationResult | null,
  enabled: boolean = true
): UseSensitivityAnalysisResult {
  const [sensitivityData, setSensitivityData] = useState<SensitivityData | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  // Memoize inputs hash to detect changes
  const inputsHash = useMemo(
    () => (inputs ? hashInputs(inputs) : null),
    [inputs]
  );

  const compute = useCallback(() => {
    if (!inputs || !result || !enabled) {
      setSensitivityData(null);
      return;
    }

    setIsComputing(true);

    // Use requestIdleCallback for non-blocking computation
    // Falls back to setTimeout for browsers without support
    const scheduleCompute = (callback: () => void) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        return (window as typeof window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(callback, { timeout: 1000 });
      }
      return setTimeout(callback, 0) as unknown as number;
    };

    const cancelCompute = (id: number) => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as typeof window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };

    const computeId = scheduleCompute(() => {
      try {
        const data = computeSensitivityAnalysis(inputs, result);
        setSensitivityData(data);
      } catch (error) {
        console.error('Error computing sensitivity analysis:', error);
        setSensitivityData(null);
      } finally {
        setIsComputing(false);
      }
    });

    return () => cancelCompute(computeId);
  }, [inputs, result, enabled]);

  // Recompute when inputs change
  useEffect(() => {
    const cleanup = compute();
    return cleanup;
  }, [inputsHash, result, enabled, compute]);

  const recompute = useCallback(() => {
    compute();
  }, [compute]);

  return { sensitivityData, isComputing, recompute };
}
