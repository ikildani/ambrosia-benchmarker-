'use client';

import { Calculator, Clock, Bell, BarChart3, Search } from 'lucide-react';

interface EmptyStateProps {
  icon: 'calculator' | 'clock' | 'bell' | 'chart' | 'search';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const iconMap = {
  calculator: Calculator,
  clock: Clock,
  bell: Bell,
  chart: BarChart3,
  search: Search,
} as const;

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const IconComponent = iconMap[icon];

  return (
    <div className="py-16 text-center flex flex-col items-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 flex items-center justify-center mx-auto mb-4">
        <IconComponent className="w-7 h-7 text-teal-500" />
      </div>

      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                     shadow-lg shadow-teal-500/25 dark:shadow-teal-400/15 hover:shadow-xl hover:shadow-teal-500/30 dark:hover:shadow-teal-400/20 transition-all hover:-translate-y-0.5
                     hover:from-teal-600 hover:to-cyan-600 text-sm"
        >
          {action.label}
        </button>
      )}

      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="mt-3 text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium transition-colors"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
