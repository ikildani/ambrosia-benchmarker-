'use client';

import { Lightbulb, ChevronRight, RefreshCw } from 'lucide-react';
import type { ApproachStrategy } from '@/types/partner-breakdown';

interface ApproachStrategyCardProps {
  strategy: ApproachStrategy;
  companyName: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function ApproachStrategyCard({
  strategy,
  companyName,
  onRegenerate,
  isRegenerating = false,
}: ApproachStrategyCardProps) {
  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 rounded-xl border border-teal-200 dark:border-teal-500/30">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-teal-800 dark:text-teal-300 text-sm">
              Approach Strategy
            </h4>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? 'Generating...' : 'Regenerate'}
              </button>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-2 italic leading-relaxed">
            &ldquo;{strategy.summary}&rdquo;
          </p>
          {strategy.keyPoints && strategy.keyPoints.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {strategy.keyPoints.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600 dark:text-slate-400"
                >
                  <ChevronRight className="w-3 h-3 mt-1 text-teal-500 dark:text-teal-400 flex-shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
          {strategy.timing && (
            <p className="mt-3 text-xs text-teal-700 dark:text-teal-300 bg-teal-100/50 dark:bg-teal-500/20 px-2 py-1 rounded inline-block">
              {strategy.timing}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApproachStrategyCard;
