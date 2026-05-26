import React, { useState, useCallback } from 'react';
import BenchmarkInfo from '../BenchmarkInfo';
import WatchButton from '../WatchButton';
import { DEAL_STATS, BENCHMARK_VERSION } from '@/lib/config/constants';
import type { UserTier } from '@/types/tier';

const DEAL_STATS_TOTAL = DEAL_STATS.TOTAL_DEALS;

interface ResultsHeaderProps {
  labels: { phase: string; modality: string; indication: string };
  isPro: boolean;
  hasFullAccess: boolean;
  tier: UserTier;
  inputs?: { modality: string; phase: string; indication: string; territory: string };
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  onPreloadExcel?: () => void;
  onFreePDFClick: () => void;
  onShare: () => void;
  onLinkedInShare: () => void;
  onDownloadExecutiveSummary: () => void;
  onCompare?: () => void;
  hasHistory?: boolean;
  onCopyResults?: () => void;
  onBuyReport?: () => void;
}

function ResultsHeaderInner({
  labels,
  isPro,
  hasFullAccess,
  tier,
  inputs,
  onDownloadPDF,
  onDownloadExcel,
  onPreloadExcel,
  onFreePDFClick,
  onShare,
  onLinkedInShare,
  onDownloadExecutiveSummary,
  onCompare,
  hasHistory,
  onCopyResults,
  onBuyReport,
}: ResultsHeaderProps) {
  const [copyLabel, setCopyLabel] = useState('Copy');

  const handleCopy = useCallback(() => {
    onCopyResults?.();
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy'), 2000);
  }, [onCopyResults]);
  return (
    <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 lg:py-6 xl:py-8 overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(14, 165, 165, 0.5) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} />
      </div>
      <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

      <div className="relative space-y-3">
        {/* Top row: status badge + primary action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-teal-400" />
              <div className="absolute inset-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-teal-400 animate-ping" />
            </div>
            <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Analysis Complete</span>
            {isPro && (
              <span className="ml-1 px-1.5 sm:px-2 py-0.5 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                PRO
              </span>
            )}
          </div>
          {/* Primary download on desktop */}
          <div className="hidden sm:block">
            {hasFullAccess ? (
              <button
                onClick={onDownloadPDF}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-glow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Report</span>
              </button>
            ) : (
              <button
                onClick={onBuyReport}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-glow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Get Full Report — $499</span>
              </button>
            )}
          </div>
        </div>

        {/* Title + pills */}
        <div>
          <h3 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold font-display text-white">Estimated Deal Terms</h3>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
            <span className="inline-flex items-center px-2 py-0.5 bg-navy-700 rounded text-xs text-neutral-300 font-medium">
              {labels.phase}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy-700 rounded text-xs text-neutral-300 font-medium">
              {labels.modality}
              <WatchButton itemType="modality" itemValue={inputs?.modality || ''} size="sm" tier={tier} />
            </span>
            <span className="inline-flex items-center px-2 py-0.5 bg-navy-700 rounded text-xs text-neutral-300 font-medium">
              {labels.indication}
            </span>
            <BenchmarkInfo />
          </div>
          <p className="mt-2 text-xs text-white/60">
            Benchmarks: {BENCHMARK_VERSION.LABEL} | Data through March 2026
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            Based on {DEAL_STATS_TOTAL} publicly disclosed licensing deals from SEC filings, FTC premerger filings, and press releases
          </p>
        </div>

        {/* Action buttons row — wraps naturally */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Mobile-only primary download */}
          <div className="sm:hidden w-full">
            {hasFullAccess ? (
              <button
                onClick={onDownloadPDF}
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-glow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Report</span>
              </button>
            ) : (
              <button
                onClick={onBuyReport}
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-glow"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Get Full Report — $499</span>
              </button>
            )}
          </div>
          {/* Secondary actions */}
          {hasFullAccess && (
            <>
              <button onClick={onDownloadExcel} onMouseEnter={onPreloadExcel} onFocus={onPreloadExcel} className="inline-flex items-center gap-1.5 px-3 py-3 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all border border-white/10 hover:border-white/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Excel
              </button>
              <button onClick={onDownloadExecutiveSummary} className="inline-flex items-center gap-1.5 px-3 py-3 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all border border-white/10 hover:border-white/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                1-Page Summary
              </button>
            </>
          )}
          {hasHistory && onCompare && (
            <button onClick={onCompare} className="inline-flex items-center gap-1.5 px-3 py-3 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all border border-white/10 hover:border-white/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
              Compare
            </button>
          )}
          {onCopyResults && (
            <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 py-3 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all border border-white/10 hover:border-white/20">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              {copyLabel}
            </button>
          )}
          <button onClick={onShare} className="inline-flex items-center gap-1.5 px-3 py-3 sm:py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-medium rounded-lg transition-all border border-cyan-400/20 hover:border-cyan-400/40">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share
          </button>
          <button onClick={onLinkedInShare} className="inline-flex items-center gap-1.5 px-3 py-3 sm:py-2.5 bg-blue-600/15 hover:bg-blue-600/25 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 text-blue-200 dark:text-blue-300 text-xs font-medium rounded-lg transition-all border border-blue-600/20 hover:border-blue-600/40 dark:border-blue-500/30 dark:hover:border-blue-500/50">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            <span className="hidden sm:inline">LinkedIn</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const ResultsHeader = React.memo(ResultsHeaderInner);
ResultsHeader.displayName = 'ResultsHeader';

export default ResultsHeader;
export type { ResultsHeaderProps };
