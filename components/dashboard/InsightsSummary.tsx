import React, { useMemo } from 'react';
import { type CalculationHistoryItem } from '@/lib/history';

interface InsightsSummaryProps {
  history: CalculationHistoryItem[];
}

interface Insight {
  icon: React.ReactNode;
  text: string;
}

// Icon components for reuse
const ChartIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ArrowUpIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const ArrowDownIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
  </svg>
);

const TargetIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const SparkleIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const AdjustIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const CompareIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const RangeIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

function formatVal(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`;
}

function capitalizeArea(area: string): string {
  return area.charAt(0).toUpperCase() + area.slice(1);
}

function InsightsSummaryInner({ history }: InsightsSummaryProps) {
  const insights = useMemo(() => {
    if (history.length === 0) return [];

    const result: Insight[] = [];

    // --- 1 item: single analysis summary + adjustment tip ---
    if (history.length === 1) {
      const item = history[0];
      const phase = item.labels?.phase || 'unknown';
      const area = capitalizeArea(item.inputs?.therapeuticArea || 'oncology');
      const modality = item.labels?.modality || 'unknown';
      const total = formatVal(item.results?.totalValueMedian || 0);

      result.push({
        icon: SparkleIcon,
        text: `You just analyzed a ${phase} ${area} ${modality} asset valued at ${total}`,
      });
      result.push({
        icon: AdjustIcon,
        text: 'Try adjusting competitive position or data quality to see how terms shift',
      });
      return result;
    }

    // --- 2 items: above + comparison + phase distribution ---
    if (history.length === 2) {
      const latest = history[0];
      const phase = latest.labels?.phase || 'unknown';
      const area = capitalizeArea(latest.inputs?.therapeuticArea || 'oncology');
      const modality = latest.labels?.modality || 'unknown';
      const total = formatVal(latest.results?.totalValueMedian || 0);

      result.push({
        icon: SparkleIcon,
        text: `You just analyzed a ${phase} ${area} ${modality} asset valued at ${total}`,
      });

      // Average by TA
      const areaGroups: Record<string, number[]> = {};
      history.forEach(h => {
        const ta = capitalizeArea(h.inputs?.therapeuticArea || 'oncology');
        if (!areaGroups[ta]) areaGroups[ta] = [];
        areaGroups[ta].push(h.results?.totalValueMedian || 0);
      });
      const largestGroup = Object.entries(areaGroups).sort((a, b) => b[1].length - a[1].length)[0];
      if (largestGroup && largestGroup[1].length > 1) {
        const avg = largestGroup[1].reduce((a, b) => a + b, 0) / largestGroup[1].length;
        result.push({
          icon: CompareIcon,
          text: `Your ${largestGroup[0]} analyses average ${formatVal(avg)} in total deal value`,
        });
      } else if (largestGroup) {
        const avg = history.reduce((sum, h) => sum + (h.results?.totalValueMedian || 0), 0) / history.length;
        result.push({
          icon: CompareIcon,
          text: `Your analyses average ${formatVal(avg)} in total deal value`,
        });
      }

      // Phase distribution
      const phases: Record<string, number> = {};
      history.forEach(h => {
        const p = h.labels?.phase || 'unknown';
        phases[p] = (phases[p] || 0) + 1;
      });
      const phaseSummary = Object.entries(phases)
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => `${p} (${n})`)
        .join(', ');
      result.push({
        icon: ChartIcon,
        text: `Phase distribution: ${phaseSummary}`,
      });

      return result;
    }

    // --- 3+ items: full insights ---
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
        icon: ChartIcon,
        text: `You've analyzed ${thisMonth.length} ${capitalizeArea(topArea?.[0] || '')} assets this month`,
      });
    }

    // 2. Valuation range
    const allValues = history
      .map(h => h.results?.totalValueMedian || 0)
      .filter(v => v > 0)
      .sort((a, b) => a - b);
    if (allValues.length >= 2) {
      const min = allValues[0];
      const max = allValues[allValues.length - 1];
      if (min !== max) {
        result.push({
          icon: RangeIcon,
          text: `Your analyses range from ${formatVal(min)} to ${formatVal(max)} in total deal value`,
        });
      }
    }

    // 3. Stage focus (most common phase)
    const phaseCounts: Record<string, number> = {};
    history.forEach(h => {
      const p = h.labels?.phase || 'unknown';
      phaseCounts[p] = (phaseCounts[p] || 0) + 1;
    });
    const topPhase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0];
    if (topPhase) {
      const pct = Math.round((topPhase[1] / history.length) * 100);
      result.push({
        icon: TargetIcon,
        text: `You focus on ${topPhase[0]} assets (${pct}% of analyses)`,
      });
    }

    // 4. Highest-valued deal
    const sorted = [...history].sort((a, b) => (b.results?.totalValueMedian || 0) - (a.results?.totalValueMedian || 0));
    const highest = sorted[0];
    if (highest?.results?.totalValueMedian) {
      result.push({
        icon: SparkleIcon,
        text: `Your highest-valued analysis was ${highest.labels?.indication || 'unknown'} at ${formatVal(highest.results.totalValueMedian)}`,
      });
    }

    // 5. TA distribution
    const allAreas: Record<string, number> = {};
    history.forEach(h => {
      const area = h.inputs?.therapeuticArea || 'oncology';
      allAreas[area] = (allAreas[area] || 0) + 1;
    });
    const dominant = Object.entries(allAreas).sort((a, b) => b[1] - a[1])[0];
    if (dominant) {
      const pct = Math.round((dominant[1] / history.length) * 100);
      result.push({
        icon: TargetIcon,
        text: `${pct}% of your analyses are in ${capitalizeArea(dominant[0])}`,
      });
    }

    // 6. Activity trend (show both up and down)
    const oneWeekAgo = Date.now() - 7 * 86400000;
    const twoWeeksAgo = Date.now() - 14 * 86400000;
    const thisWeek = history.filter(h => new Date(h.timestamp).getTime() >= oneWeekAgo).length;
    const lastWeek = history.filter(h => {
      const t = new Date(h.timestamp).getTime();
      return t >= twoWeeksAgo && t < oneWeekAgo;
    }).length;
    if (lastWeek > 0) {
      if (thisWeek > lastWeek) {
        result.push({
          icon: ArrowUpIcon,
          text: `Analysis activity up ${Math.round(((thisWeek - lastWeek) / lastWeek) * 100)}% vs last week`,
        });
      } else if (thisWeek < lastWeek) {
        result.push({
          icon: ArrowDownIcon,
          text: `Analysis activity down ${Math.round(((lastWeek - thisWeek) / lastWeek) * 100)}% vs last week`,
        });
      }
    }

    return result.slice(0, 5);
  }, [history]);

  // True empty state: no history at all
  if (history.length === 0) {
    return (
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-[1px] rounded-2xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Smart Insights</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Run your first calculation to unlock personalized insights about your deal patterns.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-[1px] rounded-2xl">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Smart Insights</h3>
        </div>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-slate-900 dark:text-white flex-shrink-0 mt-0.5">
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
