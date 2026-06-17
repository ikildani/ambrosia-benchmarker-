'use client';

import { useState, useEffect } from 'react';
import { useWatchlist } from '@/lib/hooks/useWatchlist';
import WatchlistItemRow from './WatchlistItemRow';
import WatchlistActivityFeed from './WatchlistActivityFeed';
import AddToWatchlistModal from './AddToWatchlistModal';
import EmptyState from '@/components/ui/EmptyState';
import type { UserTier } from '@/types/tier';

interface WatchlistPanelProps {
  tier: UserTier;
  onUpgrade: () => void;
}

export default function WatchlistPanel({ tier, onUpgrade }: WatchlistPanelProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.id) setUserId(parsed.id);
      } catch {
        // ignore
      }
    }
  }, []);

  const { items, activity, isLoading, error, addItem, removeItem } = useWatchlist(userId);

  if (tier !== 'pro' && tier !== 'portfolio') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-600/15 to-cyan-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Watchlist is a Pro Feature</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
          Track modalities, indications, and companies you care about. Get notified when new deals or trial updates match your interests.
        </p>
        <button
          onClick={onUpgrade}
          className="px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg shadow-slate-900/15"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Unable to load watchlist</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">Something went wrong. Please try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-medium text-slate-900 dark:text-white bg-blue-50 dark:bg-blue-900/15 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const recentActivityCount = activity.filter(a => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(a.date) >= weekAgo;
  }).length;

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your Watchlist</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} watched
            {recentActivityCount > 0 && (
              <span className="ml-2 text-slate-900 dark:text-white font-medium">
                {recentActivityCount} new event{recentActivityCount !== 1 ? 's' : ''} this week
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg shadow-slate-900/15 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add to Watchlist
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Items List — 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Watched Items
              </h3>
            </div>
            {items.length === 0 ? (
              <EmptyState
                icon="bell"
                title="Your watchlist is empty"
                description="Track modalities, indications, and companies to get notified when matching deals appear."
                action={{
                  label: 'Add First Item',
                  onClick: () => setShowAddModal(true),
                }}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map((item) => (
                  <WatchlistItemRow key={item.id} item={item} onRemove={removeItem} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed — 3 cols */}
        <div className="lg:col-span-3">
          <WatchlistActivityFeed activity={activity} />
        </div>
      </div>

      {showAddModal && (
        <AddToWatchlistModal
          onClose={() => setShowAddModal(false)}
          onAdd={addItem}
          existingItems={items}
        />
      )}
    </div>
  );
}
