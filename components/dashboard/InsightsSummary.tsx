import React, { useMemo } from 'react';
import { type CalculationHistoryItem } from '@/lib/history';

interface InsightsSummaryProps {
  history: CalculationHistoryItem[];
}

interface Insight {
  icon: React.ReactNode;
  text: string;
}

function InsightsSummaryInner({ history }: InsightsSummaryProps) {
  const insights = useMemo(() => {
    if (history.length < 3) return [];
    const result: Insight[] = [];
    const now = new Date();

    // 1. Monthly activity
    const thisMonth = history.filter(h => {
      const d = new Date(h.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    if (thisMonth.length > 0) {
      const areaCounts: Record<string, number> = {};
      thisMonth.forEach(h => {
        const area = h.inputs?.therapeuticArea || 'oncology';
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      });
      const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];
      result.push({
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        text: `You've analyzed ${thisMonth.length} ${topArea?.[0] || ''} assets this month`,
      });
    }

    // 2. Highest-valued deal
    const sorted = [...history].sort((a, b) => (b.results?.totalValueMedian || 0) - (a.results?.totalValueMedian || 0));
    const highest = sorted[0];
    if (highest?.results?.totalValueMedian) {
      const val = highest.results.totalValueMedian >= 1000
        ? `$${(highest.results.totalValueMedian / 1000).toFixed(1)}B`
        : `$${highest.results.totalValueMedian}M`;
      result.push({
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        ),
        text: `Your highest-valued analysis was ${highest.labels?.indication || 'unknown'} at ${val}`,
      });
    }

    // 3. TA distribution
    const allAreas: Record<string, number> = {};
    history.forEach(h => {
      const area = h.inputs?.therapeuticArea || 'oncology';
      allAreas[area] = (allAreas[area] || 0) + 1;
    });
    const dominant = Object.entries(allAreas).sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const pct = Math.round((dominant[1] / history.length) * 100);
      result.push({
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
        text: `${pct}% of your analyses are in ${dominant[0]}`,
      });
    }

    // 4. Activity trend
    const oneWeekAgo = Date.now() - 7 * 86400000;
    const twoWeeksAgo = Date.now() - 14 * 86400000;
    const thisWeek = history.filter(h => new Date(h.timestamp).getTime() >= oneWeekAgo).length;
    const lastWeek = history.filter(h => {
      const t = new Date(h.timestamp).getTime();
      return t >= twoWeeksAgo && t < oneWeekAgo;
    }).length;
    if (thisWeek > lastWeek && lastWeek > 0) {
      result.push({
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
        text: `Analysis activity is up ${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}% vs last week`,
      });
    }

    return result.slice(0, 4);
  }, [history]);

  if (history.length < 3) {
    return (
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-[1px] rounded-2xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Smart Insights</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Run a few more analyses to unlock personalized insights about your deal patterns.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-[1px] rounded-2xl">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Smart Insights</h3>
        </div>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5">
                {insight.icon}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const InsightsSummary = React.memo(InsightsSummaryInner);
export default InsightsSummary;
