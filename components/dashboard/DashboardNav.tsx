import React, { useCallback, useRef } from 'react';

type TabId = 'overview' | 'history' | 'watchlist' | 'settings';

interface DashboardNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  watchlistNewCount: number;
}

const TAB_IDS: TabId[] = ['overview', 'history', 'watchlist', 'settings'];

const DashboardNav = React.memo(function DashboardNav({
  activeTab,
  onTabChange,
  watchlistNewCount,
}: DashboardNavProps) {
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TAB_IDS.indexOf(activeTab);
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % TAB_IDS.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = TAB_IDS.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextTabId = TAB_IDS[nextIndex];
    onTabChange(nextTabId);

    // Move focus to the newly active tab button
    const tablistEl = tablistRef.current;
    if (tablistEl) {
      const nextButton = tablistEl.querySelector<HTMLButtonElement>(`#tab-${nextTabId}`);
      nextButton?.focus();
    }
  }, [activeTab, onTabChange]);

  return (
    <div className="mb-6 sm:mb-8 -mx-3 sm:mx-0 px-3 sm:px-0 sticky top-16 sm:top-20 lg:top-24 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm py-2 -mt-2">
      <div ref={tablistRef} role="tablist" aria-label="Dashboard sections" onKeyDown={handleKeyDown} className="flex gap-1.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 sm:p-1 rounded-2xl sm:rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar scroll-snap-x">
        {[
          { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
          { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
          { id: 'watchlist', label: 'Watchlist', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
          { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id as typeof activeTab)}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none min-w-0 scroll-snap-center touch-feedback ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md sm:shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white active:bg-white/50 dark:active:bg-slate-700/50'
            }`}
          >
            <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
              activeTab === tab.id ? 'text-blue-700' : ''
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            <span className="text-xs sm:text-sm">{tab.label}</span>
            {tab.id === 'watchlist' && watchlistNewCount > 0 && activeTab !== 'watchlist' && (
              <span className="ml-1 w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full animate-pulse">
                {watchlistNewCount > 9 ? '9+' : watchlistNewCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

export default DashboardNav;
