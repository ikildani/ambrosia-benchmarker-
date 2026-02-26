'use client';

import { formatCurrency } from '@/lib/calculations';
import type { MarketSizeEstimate } from '@/lib/financial/types';

interface MarketSizePanelProps {
  marketSize?: MarketSizeEstimate;
  tier: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

function formatPatientCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

export default function MarketSizePanel({
  marketSize,
  tier,
  onUpgrade,
  onBuyReport,
}: MarketSizePanelProps) {
  if (!marketSize) return (
    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">Market size estimate unavailable — epidemiology data not found for this indication.</p>
    </div>
  );

  const hasAccess = tier === 'pro' || tier === 'report';
  const ms = marketSize;

  // Patient funnel steps in order from largest to smallest
  const funnelSteps = [
    { label: 'Total Population', value: ms.patientFunnel.totalPopulation },
    { label: 'Prevalent Patients', value: ms.patientFunnel.prevalentPatients },
    { label: 'Diagnosed', value: ms.patientFunnel.diagnosedPatients },
    { label: 'Treated', value: ms.patientFunnel.treatedPatients },
    { label: 'Drug-Eligible', value: ms.patientFunnel.drugEligiblePatients },
    { label: 'Addressable', value: ms.patientFunnel.addressablePatients },
  ];

  // Max value for funnel width calculation (use prevalent, not total pop, for better visual)
  const funnelMax = Math.max(
    ms.patientFunnel.prevalentPatients,
    1
  );

  return (
    <div className="relative mt-6 sm:mt-8">
      <div className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Market Size Analysis
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {ms.indication} &middot;{' '}
                  {ms.territory.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-sm pointer-events-none' : ''}>
            {/* TAM & Peak Sales Headline */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-lg border border-emerald-100 dark:border-emerald-500/20 text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Total Addressable Market
                </p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(ms.totalAddressableMarket)}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-lg border border-teal-100 dark:border-teal-500/20 text-center">
                <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Peak Sales (Median)
                </p>
                <p className="text-xl sm:text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {formatCurrency(ms.peakSales.median)}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-slate-400 mt-0.5">
                  {formatCurrency(ms.peakSales.low)} &ndash;{' '}
                  {formatCurrency(ms.peakSales.high)}
                </p>
              </div>
            </div>

            {/* Patient Funnel */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Patient Funnel
              </h5>
              <div className="space-y-1.5">
                {funnelSteps.map((step, idx) => {
                  // For the first step (total population), show full width; otherwise scale relative to prevalent
                  const widthPercent =
                    idx === 0
                      ? 100
                      : Math.max(
                          (step.value / funnelMax) * 100,
                          8
                        );
                  // Gradually darken the funnel color from light to dark
                  const colorIntensity = [
                    'from-emerald-200 to-teal-200 dark:from-emerald-800 dark:to-teal-800',
                    'from-emerald-300 to-teal-300 dark:from-emerald-700 dark:to-teal-700',
                    'from-emerald-400 to-teal-400 dark:from-emerald-600 dark:to-teal-600',
                    'from-emerald-500 to-teal-500 dark:from-emerald-500 dark:to-teal-500',
                    'from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400',
                    'from-emerald-700 to-teal-700 dark:from-emerald-300 dark:to-teal-300',
                  ][idx] || 'from-emerald-500 to-teal-500';

                  return (
                    <div key={step.label} className="flex items-center gap-3">
                      <span className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 w-24 sm:w-32 flex-shrink-0 text-right">
                        {step.label}
                      </span>
                      <div className="flex-1 flex justify-center">
                        <div
                          className={`h-6 bg-gradient-to-r ${colorIntensity} rounded transition-all duration-500 flex items-center justify-center`}
                          style={{ width: `${widthPercent}%` }}
                        >
                          <span className="text-[10px] font-semibold text-white drop-shadow-sm">
                            {formatPatientCount(step.value)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Assumptions */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Key Assumptions
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-neutral-500 dark:text-slate-400">
                    Revenue / Patient / Year
                  </p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    ${ms.annualRevenuePerPatient.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500 dark:text-slate-400">
                    Market Share (Low / Med / High)
                  </p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {(ms.marketShareAssumption.low * 100).toFixed(0)}% /{' '}
                    {(ms.marketShareAssumption.median * 100).toFixed(0)}% /{' '}
                    {(ms.marketShareAssumption.high * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-neutral-500 dark:text-slate-400">SAM</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatCurrency(ms.serviceableAddressableMarket)}
                  </p>
                </div>
              </div>
              {ms.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  <p className="text-[10px] text-neutral-400 dark:text-slate-500">
                    Sources: {ms.sources.join('; ')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() =>
                  onBuyReport ? onBuyReport() : onUpgrade?.()
                }
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Unlock Financial Modeling
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
