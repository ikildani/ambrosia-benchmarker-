import React, { useMemo, useState } from 'react';
import { type CalculationHistoryItem } from '@/lib/history';

interface ActivityHeatmapProps {
  history: CalculationHistoryItem[];
}

function ActivityHeatmapInner({ history }: ActivityHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const { weeks, monthLabels, maxCount } = useMemo(() => {
    // Group by date
    const counts = new Map<string, number>();
    history.forEach(item => {
      const dateKey = item.timestamp.split('T')[0];
      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    });

    // Build 52 weeks of days ending today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0=Sun
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (51 * 7 + dayOfWeek));

    const weeksArr: { date: string; count: number; dayOfWeek: number }[][] = [];
    const monthLabelsArr: { label: string; col: number }[] = [];
    let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];
    let lastMonth = -1;

    const d = new Date(startDate);
    let weekIdx = 0;
    while (d <= endDate) {
      const dateStr = d.toISOString().split('T')[0];
      const month = d.getMonth();
      if (month !== lastMonth && d.getDay() === 0) {
        monthLabelsArr.push({ label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month], col: weekIdx });
        lastMonth = month;
      }
      currentWeek.push({ date: dateStr, count: counts.get(dateStr) || 0, dayOfWeek: d.getDay() });
      if (d.getDay() === 6 || d.getTime() === endDate.getTime()) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }
      d.setDate(d.getDate() + 1);
    }
    if (currentWeek.length > 0) weeksArr.push(currentWeek);

    let maxC = 0;
    counts.forEach(v => { if (v > maxC) maxC = v; });

    return { weeks: weeksArr, monthLabels: monthLabelsArr, maxCount: maxC };
  }, [history]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-700';
    if (count === 1) return 'bg-teal-200 dark:bg-teal-800';
    if (count === 2) return 'bg-teal-400 dark:bg-teal-600';
    return 'bg-teal-600 dark:bg-teal-400';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (history.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Analysis Activity</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300 text-sm mb-1">No activity yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Your analysis activity will appear here as you use the calculator
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Analysis Activity</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <span>Less</span>
          <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-700" />
          <div className="w-2.5 h-2.5 rounded-sm bg-teal-200 dark:bg-teal-800" />
          <div className="w-2.5 h-2.5 rounded-sm bg-teal-400 dark:bg-teal-600" />
          <div className="w-2.5 h-2.5 rounded-sm bg-teal-600 dark:bg-teal-400" />
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto relative">
        {/* Month labels */}
        <div className="flex ml-8 mb-1">
          {monthLabels.map((m, i) => (
            <div key={`${m.label}-${i}`} className="text-[10px] text-slate-400 dark:text-slate-500" style={{ position: 'absolute', left: `${32 + m.col * 14}px` }}>
              {m.label}
            </div>
          ))}
        </div>

        <div className="flex gap-[2px] mt-5 ml-8">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-[2px] mr-1 -ml-8">
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, i) => (
              <div key={i} className="h-[11px] text-[10px] text-slate-400 dark:text-slate-500 leading-[11px]">{label}</div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {Array.from({ length: 7 }, (_, di) => {
                const day = week.find(d => d.dayOfWeek === di);
                if (!day) return <div key={di} className="w-[11px] h-[11px]" />;
                return (
                  <div
                    key={di}
                    className={`w-[11px] h-[11px] rounded-sm ${getColor(day.count)} transition-colors cursor-pointer hover:ring-1 hover:ring-slate-400 dark:hover:ring-slate-500`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({ date: day.date, count: day.count, x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setHoveredDay(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredDay && (
          <div
            className="fixed z-50 px-2.5 py-1.5 bg-slate-800 dark:bg-slate-600 text-white text-xs rounded-lg shadow-lg pointer-events-none"
            style={{ left: hoveredDay.x - 40, top: hoveredDay.y - 36 }}
          >
            <span className="font-semibold">{hoveredDay.count} {hoveredDay.count === 1 ? 'analysis' : 'analyses'}</span>
            <span className="text-slate-300 dark:text-slate-400"> on {formatDate(hoveredDay.date)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const ActivityHeatmap = React.memo(ActivityHeatmapInner);
export default ActivityHeatmap;
