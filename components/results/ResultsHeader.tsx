import React from 'react';
import BenchmarkInfo from '../BenchmarkInfo';
import WatchButton from '../WatchButton';

interface ResultsHeaderProps {
  labels: { phase: string; modality: string; indication: string };
  isPro: boolean;
  hasFullAccess: boolean;
  tier: 'free' | 'report' | 'pro';
  inputs?: { modality: string; phase: string; indication: string; territory: string };
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  onFreePDFClick: () => void;
  onShare: () => void;
  onLinkedInShare: () => void;
  onDownloadExecutiveSummary: () => void;
}

function ResultsHeaderInner({
  labels,
  isPro,
  hasFullAccess,
  tier,
  inputs,
  onDownloadPDF,
  onDownloadExcel,
  onFreePDFClick,
  onShare,
  onLinkedInShare,
  onDownloadExecutiveSummary,
}: ResultsHeaderProps) {
  return (
    <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-6 overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
          backgroundSize: '20px 20px'
        }} />
      </div>
      <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-shrink-0">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-teal-400" />
              <div className="absolute inset-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-teal-400 animate-ping" />
            </div>
            <span className="text-xs font-medium text-teal-400 uppercase tracking-wider">Analysis Complete</span>
            {isPro && (
              <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
                PRO
              </span>
            )}
          </div>
          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white">Estimated Deal Terms</h3>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 text-neutral-400 text-xs sm:text-sm">
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-navy-700 rounded text-xs truncate max-w-[100px] sm:max-w-none">
              {labels.phase}
            </span>
            <span className="text-neutral-500 hidden sm:inline">&bull;</span>
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 bg-navy-700 rounded text-xs truncate max-w-[140px] sm:max-w-none">
              {labels.modality}
              <WatchButton itemType="modality" itemValue={inputs?.modality || ''} size="sm" tier={tier} />
            </span>
            <span className="text-neutral-500 hidden sm:inline">&bull;</span>
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-navy-700 rounded text-xs truncate max-w-[100px] sm:max-w-none">
              {labels.indication}
            </span>
            <span className="text-neutral-500 hidden sm:inline">&bull;</span>
            <BenchmarkInfo />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {hasFullAccess ? (
            <>
              <button
                onClick={onDownloadPDF}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-glow w-full sm:w-auto"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Report</span>
              </button>
              <button
                onClick={onDownloadExcel}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30 w-full sm:w-auto"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Excel</span>
              </button>
              <button
                onClick={onDownloadExecutiveSummary}
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-all duration-200 border border-white/20 hover:border-white/30 w-full sm:w-auto"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">1-Page Summary</span>
                <span className="sm:hidden">Summary</span>
              </button>
            </>
          ) : (
            <button
              onClick={onFreePDFClick}
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-glow w-full sm:w-auto"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Report</span>
            </button>
          )}
          <button
            onClick={onShare}
            className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 text-sm font-medium rounded-xl transition-all duration-200 border border-cyan-400/30 hover:border-cyan-400/50 w-full sm:w-auto"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Share</span>
          </button>
          <button
            onClick={onLinkedInShare}
            className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0A66C2]/20 hover:bg-[#0A66C2]/30 text-blue-200 text-sm font-medium rounded-xl transition-all duration-200 border border-[#0A66C2]/30 hover:border-[#0A66C2]/50 w-full sm:w-auto"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
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
