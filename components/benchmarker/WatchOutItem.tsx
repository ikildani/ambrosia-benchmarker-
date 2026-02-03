'use client';

import { AlertTriangle } from 'lucide-react';
import type { WatchOutFactor } from '@/types/partner-breakdown';

interface WatchOutItemProps {
  factor: WatchOutFactor;
}

export function WatchOutItem({ factor }: WatchOutItemProps) {
  const severityStyles = {
    low: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: 'text-amber-500',
      title: 'text-amber-700',
      impact: 'text-amber-600',
    },
    medium: {
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      icon: 'text-orange-500',
      title: 'text-orange-700',
      impact: 'text-orange-600',
    },
    high: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      icon: 'text-red-500',
      title: 'text-red-700',
      impact: 'text-red-600',
    },
  };

  const styles = severityStyles[factor.severity];

  return (
    <div className={`py-2.5 px-3 rounded-lg ${styles.bg} border ${styles.border}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${styles.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${styles.title}`}>
              {factor.title}
            </span>
            {factor.impact !== 0 && (
              <span className={`text-xs font-medium ${styles.impact}`}>
                {factor.impact > 0 ? '+' : ''}{factor.impact} pts
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{factor.description}</p>
        </div>
      </div>
    </div>
  );
}

export default WatchOutItem;
