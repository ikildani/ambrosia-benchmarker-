'use client';

import { CheckCircle2 } from 'lucide-react';
import type { ScoreFactor } from '@/types/partner-breakdown';

interface MatchFactorProps {
  factor: ScoreFactor;
}

export function MatchFactor({ factor }: MatchFactorProps) {
  return (
    <div className="py-3 border-b border-gray-100 dark:border-slate-700 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-teal-500 dark:text-teal-400 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {factor.title}
              </span>
              <span className="text-xs px-1.5 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 rounded font-medium">
                +{factor.points} pts
              </span>
            </div>
            {/* Evidence lines */}
            {factor.evidenceLines.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {factor.evidenceLines.map((line, i) => (
                  <p
                    key={i}
                    className={`text-sm ${
                      line.highlight
                        ? 'text-gray-800 dark:text-slate-200 font-medium'
                        : 'text-gray-600 dark:text-slate-400'
                    }`}
                  >
                    {line.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchFactor;
