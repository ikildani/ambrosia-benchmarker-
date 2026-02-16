'use client';

import { useState } from 'react';
import { useWatchlistContext } from '@/contexts/WatchlistContext';
import PaywallModal from './PaywallModal';

interface WatchButtonProps {
  itemType: 'modality' | 'indication' | 'company' | 'therapeutic_area';
  itemValue: string;
  companyId?: string;
  size?: 'sm' | 'md';
  tier?: 'free' | 'pro';
  onPaywall?: () => void;
}

export default function WatchButton({ itemType, itemValue, companyId, size = 'sm', tier = 'free', onPaywall }: WatchButtonProps) {
  const { isWatching, toggle, isLoading: contextLoading } = useWatchlistContext();
  const [toggling, setToggling] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const watched = isWatching(itemType, itemValue);
  const loading = toggling || contextLoading;

  async function handleClick() {
    if (tier !== 'pro') {
      if (onPaywall) {
        onPaywall();
      } else {
        setShowPaywall(true);
      }
      return;
    }
    if (toggling) return;

    setToggling(true);
    try {
      await toggle(itemType, itemValue, companyId);
    } finally {
      setToggling(false);
    }
  }

  const sizeClasses = size === 'sm'
    ? 'p-1.5 rounded-lg'
    : 'px-3 py-1.5 rounded-xl gap-1.5';

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleClick(); }}
        disabled={loading}
        className={`inline-flex items-center transition-all ${sizeClasses} ${
          watched
            ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/30'
            : 'bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/20 dark:hover:text-teal-400'
        } ${loading ? 'opacity-50' : ''}`}
        title={watched ? 'Stop watching' : `Watch this ${itemType}`}
      >
        {toggling ? (
          <div className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin`} />
        ) : (
          <svg className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill={watched ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
        {size === 'md' && (
          <span className="text-xs font-medium">{watched ? 'Watching' : 'Watch'}</span>
        )}
      </button>
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="pro_feature" />
    </>
  );
}
