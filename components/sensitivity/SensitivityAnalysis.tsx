'use client';

import { useState, useMemo } from 'react';
import { CalculationInput, CalculationResult } from '@/lib/calculations';
import { useSensitivityAnalysis } from '@/lib/hooks/useSensitivityAnalysis';
import { getTopParameters } from '@/lib/sensitivity';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import KeyInsightBox from './KeyInsightBox';
import ParameterSelector from './ParameterSelector';

interface SensitivityAnalysisProps {
  currentInputs: CalculationInput;
  currentResult: CalculationResult;
  onApplyChanges: (newInputs: Partial<CalculationInput>) => void;
  isPro?: boolean;
  onUpgrade?: () => void;
}

export default function SensitivityAnalysis({
  currentInputs,
  currentResult,
  onApplyChanges,
  isPro = true,
  onUpgrade,
}: SensitivityAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [pendingChanges, setPendingChanges] = useState<Partial<CalculationInput>>({});
  const isMobile = useIsMobile();

  // Compute sensitivity data
  const { sensitivityData, isComputing } = useSensitivityAnalysis(
    currentInputs,
    currentResult,
    isExpanded
  );

  // Get top parameters to display
  const topParameters = useMemo(() => {
    if (!sensitivityData) return [];
    const maxParams = isMobile ? 3 : 4;
    return getTopParameters(sensitivityData, maxParams);
  }, [sensitivityData, isMobile]);

  // Check if there are pending changes
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  // Get current selection for a parameter (pending or original)
  const getSelectedValue = (paramKey: keyof CalculationInput): string => {
    try {
      if (paramKey in pendingChanges) {
        const pendingValue = pendingChanges[paramKey];
        return pendingValue !== undefined && pendingValue !== null ? String(pendingValue) : '';
      }
      const currentValue = currentInputs[paramKey];
      return currentValue !== undefined && currentValue !== null ? String(currentValue) : '';
    } catch {
      return '';
    }
  };

  // Handle option selection
  const handleSelect = (paramKey: keyof CalculationInput, value: string) => {
    try {
      const currentValue = currentInputs[paramKey];
      const currentValueStr = currentValue !== undefined && currentValue !== null ? String(currentValue) : '';

      if (value === currentValueStr) {
        // Remove from pending if selecting current value
        const newPending = { ...pendingChanges };
        delete newPending[paramKey];
        setPendingChanges(newPending);
      } else {
        setPendingChanges(prev => ({ ...prev, [paramKey]: value }));
      }
    } catch (error) {
      console.error('Error in handleSelect:', error);
    }
  };

  // Handle apply changes
  const handleApply = () => {
    if (hasPendingChanges) {
      onApplyChanges(pendingChanges);
      setPendingChanges({});
    }
  };

  // Handle reset
  const handleReset = () => {
    setPendingChanges({});
  };

  // Pro gate
  if (!isPro) {
    return (
      <div className="mt-8">
        <div className="relative">
          {/* Blurred preview */}
          <div className="filter blur-sm pointer-events-none">
            <div className="border border-neutral-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
              <div className="px-6 py-4 bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600">
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-slate-200">
                  Sensitivity Analysis
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="h-20 bg-neutral-100 dark:bg-slate-700 rounded-lg" />
                <div className="h-32 bg-neutral-100 dark:bg-slate-700 rounded-lg" />
                <div className="h-32 bg-neutral-100 dark:bg-slate-700 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Overlay CTA */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] rounded-xl">
            <div className="text-center px-6">
              <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-neutral-800 dark:text-white mb-2">
                Unlock Sensitivity Analysis
              </h4>
              <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 max-w-sm">
                See exactly how each variable impacts your deal value. Explore &quot;what-if&quot; scenarios instantly.
              </p>
              <button
                onClick={onUpgrade}
                className="inline-flex items-center px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="border border-neutral-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600 hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors"
        >
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-slate-200 text-left">
              Sensitivity Analysis
            </h3>
            <p className="text-sm text-neutral-500 dark:text-slate-400 text-left">
              See how changes affect your deal value
            </p>
          </div>
          <svg
            className={`w-5 h-5 text-neutral-500 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="p-6">
            {isComputing ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-20 bg-neutral-100 dark:bg-slate-700 rounded-lg" />
                <div className="h-40 bg-neutral-100 dark:bg-slate-700 rounded-lg" />
                <div className="h-40 bg-neutral-100 dark:bg-slate-700 rounded-lg" />
              </div>
            ) : sensitivityData ? (
              <>
                {/* Key Insight */}
                <KeyInsightBox
                  topValueDriver={sensitivityData.topValueDriver}
                  currentTotalValue={sensitivityData.currentTotalValue}
                />

                {/* Parameter Selectors */}
                <div className="space-y-4">
                  {topParameters.map((param) => {
                    if (!param || !param.parameterKey) return null;
                    const selectedValue = getSelectedValue(param.parameterKey);
                    return (
                      <ParameterSelector
                        key={param.parameterKey}
                        sensitivity={param}
                        selectedValue={selectedValue}
                        onSelect={(value) => handleSelect(param.parameterKey, value)}
                      />
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-neutral-200 dark:border-slate-600">
                  <button
                    onClick={handleReset}
                    disabled={!hasPendingChanges}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      hasPendingChanges
                        ? 'text-neutral-700 dark:text-slate-300 hover:bg-neutral-100 dark:hover:bg-slate-700'
                        : 'text-neutral-400 dark:text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={!hasPendingChanges}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      hasPendingChanges
                        ? 'bg-teal-500 hover:bg-teal-600 text-white'
                        : 'bg-neutral-200 dark:bg-slate-600 text-neutral-400 dark:text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Apply Selected Changes
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-neutral-500 dark:text-slate-400">
                Unable to compute sensitivity analysis
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
