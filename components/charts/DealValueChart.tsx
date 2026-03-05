'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DealTerms } from '@/lib/calculations';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { BAR_COLORS, CHART_COLORS } from '@/lib/chartTheme';

interface DealValueChartProps {
  terms: DealTerms;
}

const formatCurrency = (value: number) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
};

function DealValueChart({ terms }: DealValueChartProps) {
  const isMobile = useIsMobile();

  const data = [
    {
      name: isMobile ? 'Upfront' : 'Upfront',
      low: terms.upfront.low,
      median: terms.upfront.median,
      high: terms.upfront.high,
      fill: BAR_COLORS[0],
    },
    {
      name: isMobile ? 'Dev MS' : 'Dev Milestones',
      low: terms.devMilestones.low,
      median: terms.devMilestones.median,
      high: terms.devMilestones.high,
      fill: BAR_COLORS[1],
    },
    {
      name: isMobile ? 'Reg MS' : 'Reg Milestones',
      low: terms.regMilestones.low,
      median: terms.regMilestones.median,
      high: terms.regMilestones.high,
      fill: BAR_COLORS[2],
    },
    {
      name: isMobile ? 'Comm MS' : 'Comm Milestones',
      low: terms.commMilestones.low,
      median: terms.commMilestones.median,
      high: terms.commMilestones.high,
      fill: BAR_COLORS[3],
    },
  ];

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const item = data.find(d => d.name === label);
      if (!item) return null;

      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-slate-600">
          <p className="font-semibold text-navy-800 dark:text-white mb-1">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-neutral-500 dark:text-slate-400">
              Low: <span className="font-medium text-neutral-700 dark:text-slate-200">{formatCurrency(item.low)}</span>
            </p>
            <p className="text-teal-600 dark:text-teal-400">
              Median: <span className="font-bold">{formatCurrency(item.median)}</span>
            </p>
            <p className="text-neutral-500 dark:text-slate-400">
              High: <span className="font-medium text-neutral-700 dark:text-slate-200">{formatCurrency(item.high)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // A11Y-002: Generate accessible description for screen readers
  const chartDescription = `Deal value breakdown chart showing: Upfront payment ${formatCurrency(terms.upfront.median)}, Development milestones ${formatCurrency(terms.devMilestones.median)}, Regulatory milestones ${formatCurrency(terms.regMilestones.median)}, Commercial milestones ${formatCurrency(terms.commMilestones.median)}.`;

  return (
    <div
      className="w-full h-36 sm:h-64 mb-2"
      role="img"
      aria-label={chartDescription}
    >
      {/* A11Y: Hidden table for screen reader users */}
      <table className="sr-only" aria-label="Deal value breakdown">
        <caption>Deal term values showing low, median, and high estimates</caption>
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col">Low</th>
            <th scope="col">Median</th>
            <th scope="col">High</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{formatCurrency(item.low)}</td>
              <td>{formatCurrency(item.median)}</td>
              <td>{formatCurrency(item.high)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 10,
            right: isMobile ? 15 : 30,
            left: isMobile ? 60 : 80,
            bottom: 10
          }}
        >
          <XAxis
            type="number"
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: isMobile ? 9 : 12, fill: CHART_COLORS.axisLabel }}
            axisLine={{ stroke: CHART_COLORS.axisLine }}
            tickCount={isMobile ? 4 : 6}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: isMobile ? 9 : 12, fill: CHART_COLORS.axisLabelBold }}
            axisLine={{ stroke: CHART_COLORS.axisLine }}
            width={isMobile ? 50 : 75}
          />
          <Tooltip
            content={<CustomTooltip />}
            position={isMobile ? { x: 10, y: 10 } : undefined}
            wrapperStyle={isMobile ? { pointerEvents: 'none' } : undefined}
          />
          <Bar
            dataKey="median"
            radius={[0, 4, 4, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default React.memo(DealValueChart);
