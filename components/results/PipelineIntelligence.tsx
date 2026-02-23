'use client';

import { useState, useEffect } from 'react';
import { PRICING } from '@/lib/config/constants';

interface TrialSummary {
  totalTrials: number;
  totalEnrollment: number;
  phaseDistribution: Record<string, number>;
  topSponsors: { name: string; count: number }[];
  recentTrials: {
    nct_id: string;
    title: string;
    sponsor: string;
    phase: string;
    status: string;
  }[];
}

interface PipelineIntelligenceProps {
  therapeuticArea?: string;
  modality?: string;
  tier: 'free' | 'report' | 'pro';
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  recruiting: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  not_yet_recruiting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  enrolling_by_invitation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

export default function PipelineIntelligence({
  therapeuticArea,
  modality,
  tier,
  onUpgrade,
  onBuyReport,
}: PipelineIntelligenceProps) {
  const [summary, setSummary] = useState<TrialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const hasFullAccess = tier === 'pro' || tier === 'report';

  useEffect(() => {
    if (!therapeuticArea) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ therapeuticArea });
    if (modality) params.set('modality', modality);

    fetch(`/api/trials/intelligence?${params}`)
      .then(res => res.json())
      .then(data => setSummary(data.summary || null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [therapeuticArea, modality]);

  if (!loading && (!summary || summary.totalTrials === 0)) return null;

  const taLabel = therapeuticArea
    ? therapeuticArea.charAt(0).toUpperCase() + therapeuticArea.slice(1)
    : '';

  // Phase order for display
  const phaseOrder = ['Phase 1', 'Phase 1/Phase 2', 'Phase 2', 'Phase 2/Phase 3', 'Phase 3', 'Phase 4'];
  const maxPhaseCount = summary
    ? Math.max(...Object.values(summary.phaseDistribution), 1)
    : 1;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Pipeline Intelligence
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Active clinical trials in {taLabel || 'your therapeutic area'}
          </p>
        </div>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`p-2.5 sm:p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg ${i === 3 ? 'col-span-2 sm:col-span-1' : ''}`}>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-1" />
                <div className="h-3 bg-slate-100 dark:bg-slate-600 rounded w-20" />
              </div>
            ))}
          </div>
          <div className="h-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg" />
        </div>
      )}

      {!loading && summary && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center">
              <p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">{summary.totalTrials}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Active Trials</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center">
              <p className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">{summary.topSponsors.length}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Companies</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center col-span-2 sm:col-span-1">
              <p className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">
                {Object.keys(summary.phaseDistribution).length}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Phase Stages</p>
            </div>
          </div>

          {/* Phase Distribution */}
          <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Phase Distribution</h4>
            <div className="space-y-2">
              {phaseOrder
                .filter(p => summary.phaseDistribution[p])
                .map(phase => (
                  <div key={phase} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-20 sm:w-28 flex-shrink-0 truncate">{phase}</span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${(summary.phaseDistribution[phase] / maxPhaseCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
                      {summary.phaseDistribution[phase]}
                    </span>
                  </div>
                ))}
              {/* Show remaining phases not in order */}
              {Object.entries(summary.phaseDistribution)
                .filter(([p]) => !phaseOrder.includes(p))
                .map(([phase, count]) => (
                  <div key={phase} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-20 sm:w-28 flex-shrink-0 truncate">{phase}</span>
                    <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full transition-all duration-500"
                        style={{ width: `${(count / maxPhaseCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Sponsors */}
          <div className="relative">
            <div className={`p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg ${!hasFullAccess ? 'blur-sm' : ''}`}>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Top Sponsors</h4>
              <div className="grid grid-cols-2 gap-2">
                {summary.topSponsors.slice(0, 8).map(sponsor => (
                  <div key={sponsor.name} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate mr-2">{sponsor.name}</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">{sponsor.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {!hasFullAccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-lg">
                <button
                  onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Unlock Pipeline Data
                </button>
              </div>
            )}
          </div>

          {/* Recent Trials — expandable */}
          {hasFullAccess && summary.recentTrials.length > 0 && (
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                <span>Recent Trials ({summary.recentTrials.length})</span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expanded && (
                <div className="mt-3 space-y-2">
                  {summary.recentTrials.map(trial => (
                    <div key={trial.nct_id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                            {trial.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {trial.sponsor} &middot; {trial.phase}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[trial.status] || 'bg-slate-100 text-slate-600'}`}>
                            {trial.status.replace(/_/g, ' ')}
                          </span>
                          <a
                            href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400"
                            title="View on ClinicalTrials.gov"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
