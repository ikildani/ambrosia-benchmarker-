'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface TrendPoint {
  quarter: string;
  count: number;
  total_upfront: number | null;
}

interface DealFlowChartProps {
  trend: TrendPoint[];
  isPro: boolean;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount}`;
}

export default function DealFlowChart({ trend, isPro }: DealFlowChartProps) {
  const totalDeals = trend.reduce((sum, t) => sum + t.count, 0);
  const isEmpty = trend.length === 0 || trend.every((t) => t.count === 0);

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: TrendPoint }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600">
          <p className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
            {label}
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-slate-600 dark:text-slate-300">
              Deals:{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {point.count}
              </span>
            </p>
            {isPro ? (
              <p className="text-slate-600 dark:text-slate-300">
                Total Upfront:{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatUsd(point.total_upfront)}
                </span>
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-xs italic">
                Upgrade to Pro for financial data
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Deal Activity
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quarterly transaction volume (3-year)
          </p>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              {totalDeals}
            </span>
            <span className="text-xs text-slate-900 dark:text-white font-medium">
              deals
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-6">
        {isEmpty ? (
          <div className="flex flex-col items-center py-10 text-center">
            <svg
              className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No deal activity recorded
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="w-full h-64" role="img" aria-label={`Deal activity chart showing ${totalDeals} deals over ${trend.length} quarters. ${trend.map(t => `${t.quarter}: ${t.count} deals`).join(', ')}.`}>
              <table className="sr-only" aria-label="Deal activity data">
                <caption>Quarterly deal transaction volume</caption>
                <thead><tr><th scope="col">Quarter</th><th scope="col">Deal Count</th></tr></thead>
                <tbody>
                  {trend.map((t, i) => (
                    <tr key={i}><td>{t.quarter}</td><td>{t.count}</td></tr>
                  ))}
                </tbody>
              </table>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="chartGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#14b8a6"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="#14b8a6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{
                      fontSize: 11,
                      fill: '#94a3b8',
                    }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: isPro ? '#94a3b8' : 'transparent',
                    }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                    fill="url(#chartGradient)"
                    dot={{
                      r: 3,
                      fill: '#14b8a6',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 5,
                      fill: '#14b8a6',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Blur overlay for Y-axis values when not Pro */}
            {!isPro && (
              <div className="absolute top-0 left-0 w-12 h-full backdrop-blur-[3px] bg-white/40 dark:bg-slate-800/40 pointer-events-none" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
