'use client';

import { useState } from 'react';
import { DealTerms, TieredRoyalties } from '@/lib/calculations';
import DealValueChart from './DealValueChart';
import RoyaltyChart from './RoyaltyChart';
import ModifierWaterfall from './ModifierWaterfall';

interface ChartSectionProps {
  terms: DealTerms;
  tieredRoyalties: TieredRoyalties;
  modifiers: { name: string; multiplier: number }[];
  isPro: boolean;
  onUpgrade?: () => void;
}

type ChartTab = 'breakdown' | 'royalties' | 'modifiers';

export default function ChartSection({
  terms,
  tieredRoyalties,
  modifiers,
  isPro,
  onUpgrade,
}: ChartSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ChartTab>('breakdown');

  const tabs: { id: ChartTab; label: string; icon: JSX.Element }[] = [
    {
      id: 'breakdown',
      label: 'Deal Breakdown',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'royalties',
      label: 'Royalty Tiers',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      id: 'modifiers',
      label: 'Value Impact',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mt-6 sm:mt-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200 hover:border-teal-300 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-semibold text-teal-800">Interactive Charts</span>
          {!isPro && (
            <span className="px-2 py-0.5 bg-navy-100 text-navy-700 text-xs font-medium rounded-full">
              Pro
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-teal-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 bg-white rounded-xl border border-neutral-200 overflow-hidden animate-fade-in">
          {isPro ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-neutral-200 overflow-x-auto gap-1 sm:gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'text-teal-600 border-b-2 border-teal-500 -mb-px bg-teal-50/50'
                        : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Chart Content */}
              <div className="p-3 sm:p-6 overflow-hidden">
                {activeTab === 'breakdown' && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-700 mb-3">
                      Deal Value Breakdown (Median Values)
                    </h4>
                    <DealValueChart terms={terms} />
                    <p className="text-xs text-neutral-500 mt-3">
                      Hover over bars to see low, median, and high estimates
                    </p>
                  </div>
                )}

                {activeTab === 'royalties' && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-700 mb-3">
                      Tiered Royalty Structure
                    </h4>
                    <RoyaltyChart royalties={tieredRoyalties} />
                    <p className="text-xs text-neutral-500 mt-3">
                      Royalty rates step up as annual sales reach tier thresholds
                    </p>
                  </div>
                )}

                {activeTab === 'modifiers' && (
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-700 mb-3">
                      How Modifiers Impact Value
                    </h4>
                    <ModifierWaterfall
                      modifiers={modifiers}
                      baseValue={terms.totalDealValue.median}
                    />
                    <p className="text-xs text-neutral-500 mt-3">
                      Shows how each factor adjusts the baseline deal value
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-navy-800 mb-2">
                Unlock Interactive Charts
              </h4>
              <p className="text-neutral-600 mb-4 max-w-md mx-auto">
                Pro users get visual deal breakdowns, royalty tier charts, and modifier impact analysis.
              </p>
              <button
                onClick={onUpgrade}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
              >
                Upgrade to Pro
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
