'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ───────────────────────────────────────────────────────────────
interface QueryResult {
  answer: string;
  data: Record<string, unknown>[];
  query_type: string;
  deal_count: number;
  execution_time_ms: number;
}

interface DealQueryProps {
  /** If true, show blurred preview for free users instead of hiding */
  showBlurredPreview?: boolean;
  /** Callback when user needs to upgrade */
  onUpgrade?: () => void;
  /** Compact mode for embedding in smaller spaces */
  compact?: boolean;
}

// ── Example queries ─────────────────────────────────────────────────────
const EXAMPLE_QUERIES = [
  'What is the largest preclinical ADC deal ever?',
  'How have Phase 2 oncology upfronts trended since 2023?',
  'Which pharma companies are most active in gene therapy?',
  'Compare ADC vs bispecific deal economics at Phase 2',
  'What did Pfizer pay for ADC assets in the last 2 years?',
  'Top 10 largest oncology deals by total value',
  'Average upfront for Phase 3 neurology deals',
  'Which biotechs have licensed the most assets since 2024?',
];

// ── Format currency helper ──────────────────────────────────────────────
function formatUSD(value: unknown): string {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(0)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

// ── Format answer with bold markup ──────────────────────────────────────
function formatAnswer(text: string): React.ReactNode[] {
  // Split on **bold** markers and render as <strong> with teal highlights
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      // Dollar amounts get teal color, company names get white bold
      const isDollar = /^\$/.test(inner);
      return (
        <strong
          key={i}
          className={isDollar
            ? 'text-teal-400 font-semibold'
            : 'text-white font-semibold'
          }
        >
          {inner}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Column display names ────────────────────────────────────────────────
const COLUMN_LABELS: Record<string, string> = {
  licensor_name: 'Licensor',
  licensee_name: 'Licensee',
  asset_name: 'Asset',
  modality: 'Modality',
  indication_category: 'Indication',
  phase_at_signing: 'Phase',
  deal_type: 'Deal Type',
  upfront_usd: 'Upfront',
  total_deal_value_usd: 'Total Value',
  milestones_total_usd: 'Milestones',
  royalty_low_pct: 'Royalty Low',
  royalty_high_pct: 'Royalty High',
  announced_date: 'Date',
  therapeutic_area: 'TA',
  territory: 'Territory',
  target: 'Target',
  deal_count: 'Deals',
  avg_upfront: 'Avg Upfront',
  avg_total_value: 'Avg Total Value',
  total_upfront: 'Total Upfront',
  max_upfront: 'Max Upfront',
  min_upfront: 'Min Upfront',
  year: 'Year',
  count: 'Count',
};

const USD_COLUMNS = new Set([
  'upfront_usd', 'total_deal_value_usd', 'milestones_total_usd',
  'milestones_development_usd', 'milestones_regulatory_usd', 'milestones_commercial_usd',
  'equity_investment_usd', 'option_exercise_fee', 'research_funding_usd',
  'avg_upfront', 'avg_total_value', 'total_upfront', 'max_upfront', 'min_upfront',
  'avg_upfront_usd', 'avg_total_deal_value_usd', 'max_total_deal_value_usd',
  'total_deal_value', 'avg_deal_value', 'max_deal_value', 'min_deal_value',
]);

function isUSDColumn(col: string): boolean {
  if (USD_COLUMNS.has(col)) return true;
  // Heuristic: column name contains 'usd' or 'value' or 'upfront' (from aggregations)
  const lower = col.toLowerCase();
  return lower.includes('usd') || (lower.includes('upfront') && !lower.includes('pct'))
    || (lower.includes('value') && !lower.includes('pct'));
}

function formatCellValue(col: string, value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (isUSDColumn(col)) return formatUSD(value);
  if (col === 'announced_date' || col === 'effective_date') {
    const d = new Date(String(value));
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (col === 'phase_at_signing') {
    const phases: Record<string, string> = {
      preclinical: 'Preclinical', phase_1: 'Phase 1', phase_2: 'Phase 2',
      phase_3: 'Phase 3', approved: 'Approved', discovery: 'Discovery',
    };
    return phases[String(value)] || String(value);
  }
  if (typeof value === 'number') {
    if (col.includes('pct') || col.includes('percent') || col.includes('royalty')) {
      return `${value.toFixed(1)}%`;
    }
    return value.toLocaleString();
  }
  return String(value);
}

// ── Component ───────────────────────────────────────────────────────────
export default function DealQuery({ showBlurredPreview = true, onUpgrade, compact = false }: DealQueryProps) {
  const { user, tier } = useAuth();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showData, setShowData] = useState(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ q: string; a: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const isPro = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  // Rotate example queries
  const [visibleExamples, setVisibleExamples] = useState<string[]>([]);
  useEffect(() => {
    // Show 4 random examples
    const shuffled = [...EXAMPLE_QUERIES].sort(() => Math.random() - 0.5);
    setVisibleExamples(shuffled.slice(0, compact ? 3 : 4));
  }, [compact]);

  const handleSubmit = useCallback(async (q?: string) => {
    const queryText = (q || question).trim();
    if (!queryText || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setShowData(false);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: queryText }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error_code === 'PRO_REQUIRED') {
          setError('pro_required');
        } else if (data.error_code === 'RATE_LIMITED') {
          setError('You have reached your daily query limit. Try again tomorrow.');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }

      setResult({
        answer: data.answer,
        data: data.data || [],
        query_type: data.query_type,
        deal_count: data.deal_count,
        execution_time_ms: data.execution_time_ms,
      });

      // Add to history (keep last 10)
      setQueryHistory(prev => [{ q: queryText, a: data.answer }, ...prev].slice(0, 10));

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [question, isLoading]);

  const handleExampleClick = useCallback((example: string) => {
    setQuestion(example);
    handleSubmit(example);
  }, [handleSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // Data table columns (auto-detect from result data)
  const dataColumns = result?.data && result.data.length > 0
    ? Object.keys(result.data[0]).filter(col => col !== 'id' && col !== 'is_synthetic')
    : [];

  return (
    <div className={`w-full ${compact ? '' : 'max-w-6xl mx-auto'}`}>
      {/* Main Container */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl shadow-slate-900/50">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-white">Deal Intelligence Query</h3>
              <p className="text-xs text-slate-400">Ask anything about 1,500+ biopharma deals</p>
            </div>
            {isPro && (
              <span className="ml-auto hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                AI-Powered
              </span>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="px-4 sm:px-6 py-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the deal data..."
              disabled={isLoading}
              className="w-full pl-4 pr-12 py-3 sm:py-3.5 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500/50 transition-all disabled:opacity-50"
              aria-label="Ask a question about biopharma deals"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!question.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white transition-colors disabled:opacity-30 disabled:hover:bg-teal-500"
              aria-label="Submit query"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>

          {/* Example Queries */}
          {!result && !isLoading && !error && (
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleExamples.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-teal-400 hover:bg-slate-700/80 border border-slate-700/50 hover:border-teal-500/30 transition-all truncate max-w-[280px]"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 sm:px-6 pb-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  Analyzing deal database...
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse w-full" />
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse w-4/5" />
                  <div className="h-4 bg-slate-700/50 rounded animate-pulse w-3/5" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence>
          {error && !isLoading && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-4 sm:px-6 pb-4"
            >
              {error === 'pro_required' ? (
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Pro Feature</p>
                      <p className="text-xs text-slate-400 mt-1">Deal Intelligence Query is available for Pro and Portfolio subscribers. Unlock AI-powered analysis of 1,500+ deals.</p>
                      {onUpgrade && (
                        <button
                          onClick={onUpgrade}
                          className="mt-3 px-4 py-2 text-xs font-medium bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all"
                        >
                          Upgrade to Pro
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    onClick={() => { setError(null); inputRef.current?.focus(); }}
                    className="mt-2 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Try another question
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {result && !isLoading && (
            <motion.div
              ref={resultRef}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
              className="px-4 sm:px-6 pb-4"
            >
              {/* Answer */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 sm:p-5">
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    {formatAnswer(result.answer)}
                  </p>
                </div>

                {/* Meta */}
                <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-500">
                  <span>{result.deal_count} {result.deal_count === 1 ? 'deal' : 'deals'} analyzed</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span>{result.execution_time_ms < 1000 ? `${result.execution_time_ms}ms` : `${(result.execution_time_ms / 1000).toFixed(1)}s`}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  <span className="capitalize">{result.query_type.replace('_', ' ')}</span>
                </div>

                {/* Data Table Toggle */}
                {result.data.length > 0 && (
                  <button
                    onClick={() => setShowData(!showData)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${showData ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {showData ? 'Hide' : 'Show'} underlying data ({result.data.length} {result.data.length === 1 ? 'row' : 'rows'})
                  </button>
                )}
              </div>

              {/* Data Table */}
              <AnimatePresence>
                {showData && result.data.length > 0 && (
                  <motion.div
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-slate-700/50">
                            {dataColumns.map(col => (
                              <th key={col} className="px-3 py-2.5 text-slate-400 font-medium whitespace-nowrap">
                                {COLUMN_LABELS[col] || col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.map((row, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-700/20 transition-colors">
                              {dataColumns.map(col => (
                                <td key={col} className={`px-3 py-2.5 whitespace-nowrap ${isUSDColumn(col) ? 'text-teal-400 font-medium' : 'text-slate-300'}`}>
                                  {formatCellValue(col, row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ask Another */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    setResult(null);
                    setQuestion('');
                    inputRef.current?.focus();
                  }}
                  className="text-xs text-slate-500 hover:text-teal-400 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ask another question
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blurred Preview for Free Users */}
        {!isPro && showBlurredPreview && !result && !isLoading && !error && (
          <div className="px-4 sm:px-6 pb-4">
            <div className="relative rounded-xl border border-slate-700/30 bg-slate-800/20 p-4 overflow-hidden">
              <div className="filter blur-sm select-none pointer-events-none" aria-hidden="true">
                <p className="text-sm text-slate-400 leading-relaxed">
                  The largest preclinical ADC deal was the <strong className="text-teal-400">$5.1B</strong> agreement between <strong className="text-white">Daiichi Sankyo</strong> and <strong className="text-white">AstraZeneca</strong> for DS-1062, announced in March 2023. This deal included <strong className="text-teal-400">$1.0B</strong> upfront with up to <strong className="text-teal-400">$4.1B</strong> in milestones...
                </p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
                <div className="text-center">
                  <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-300">Upgrade to unlock AI Deal Intelligence</p>
                  {onUpgrade && (
                    <button
                      onClick={onUpgrade}
                      className="mt-2 px-4 py-2 text-xs font-medium bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-400 hover:to-cyan-400 transition-all"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
