'use client';

import { motion } from 'framer-motion';
import EstimateDistributionChart from './EstimateDistributionChart';

interface EstimateData {
  upfront: { p10: number; p25: number; median: number; p75: number; p90: number };
  totalValue: { p10: number; p25: number; median: number; p75: number; p90: number };
  sampleSize: number;
}

interface EstimateResultsProps {
  data: EstimateData;
  compact?: boolean;
}

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.round(v)}M`;

export default function EstimateResults({ data, compact }: EstimateResultsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mt-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-600 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Predicted Upfront</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{fmt(data.upfront.median)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Range: {fmt(data.upfront.p25)} – {fmt(data.upfront.p75)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-700/50 dark:to-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-600 p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Predicted Total Value</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{fmt(data.totalValue.median)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Range: {fmt(data.totalValue.p25)} – {fmt(data.totalValue.p75)}
          </p>
        </div>
      </div>

      {!compact && (
        <EstimateDistributionChart
          p10={data.upfront.p10}
          p25={data.upfront.p25}
          p50={data.upfront.median}
          p75={data.upfront.p75}
          p90={data.upfront.p90}
          label="Upfront payment"
        />
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Based on {data.sampleSize} comparable transactions
        </p>
        <a
          href="/calculator"
          className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
        >
          Get detailed analysis →
        </a>
      </div>
    </motion.div>
  );
}
