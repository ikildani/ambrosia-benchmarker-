'use client';

import { WatchlistItem } from '@/lib/hooks/useWatchlist';

interface WatchlistItemRowProps {
  item: WatchlistItem;
  onRemove: (id: string) => Promise<boolean>;
}

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  modality: { label: 'Modality', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  indication: { label: 'Indication', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-500/20' },
  company: { label: 'Company', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/20' },
  therapeutic_area: { label: 'Area', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/20' },
};

function formatValue(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function WatchlistItemRow({ item, onRemove }: WatchlistItemRowProps) {
  const config = typeConfig[item.item_type] || typeConfig.modality;

  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`px-2 py-0.5 text-xs font-bold rounded ${config.bg} ${config.color} uppercase tracking-wide shrink-0`}>
          {config.label}
        </span>
        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {formatValue(item.item_value)}
        </span>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors shrink-0"
        title="Remove from watchlist"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
