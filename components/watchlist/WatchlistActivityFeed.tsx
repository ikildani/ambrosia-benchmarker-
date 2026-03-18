'use client';

import Link from 'next/link';
import { WatchlistActivity } from '@/lib/hooks/useWatchlist';

interface WatchlistActivityFeedProps {
  activity: WatchlistActivity[];
}

const matchTypeConfig: Record<string, { icon: string; color: string }> = {
  modality: { icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-blue-500' },
  company: { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'text-blue-500' },
  indication: { icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', color: 'text-purple-500' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActivityLink(item: WatchlistActivity): string | null {
  if (item.type === 'deal' && item.company_id) return `/companies/${item.company_id}`;
  if (item.type === 'trial' && item.company_id) return `/companies/${item.company_id}`;
  if (item.match_type === 'company' && item.company_id) return `/companies/${item.company_id}`;
  return null;
}

export default function WatchlistActivityFeed({ activity }: WatchlistActivityFeedProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Recent Activity
        </h3>
      </div>

      {activity.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-500 dark:text-slate-400">
          <p className="text-sm">No recent activity matching your watchlist.</p>
          <p className="text-xs mt-1">Activity will appear as new deals and trial updates match your watched items.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
          {activity.map((item, idx) => {
            const config = matchTypeConfig[item.match_type] || matchTypeConfig.modality;
            const link = getActivityLink(item);

            const content = (
              <div className={`px-5 py-3 transition-colors ${link ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <svg className={`w-4 h-4 ${config.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${
                        item.type === 'deal' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.date)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.detail}</p>
                  </div>
                  {link && (
                    <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            );

            return link ? (
              <Link key={idx} href={link} className="block">
                {content}
              </Link>
            ) : (
              <div key={idx}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
