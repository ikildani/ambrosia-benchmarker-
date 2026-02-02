'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DealTerms } from '@/lib/calculations';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

interface DealValueChartProps {
  terms: DealTerms;
}

const formatCurrency = (value: number) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
};

export default function DealValueChart({ terms }: DealValueChartProps) {
  const isMobile = useIsMobile();

  const data = [
    {
      name: isMobile ? 'Upfront' : 'Upfront',
      low: terms.upfront.low,
      median: terms.upfront.median,
      high: terms.upfront.high,
      fill: '#14B8A6', // teal-500
    },
    {
      name: isMobile ? 'Dev MS' : 'Dev Milestones',
      low: terms.devMilestones.low,
      median: terms.devMilestones.median,
      high: terms.devMilestones.high,
      fill: '#06B6D4', // cyan-500
    },
    {
      name: isMobile ? 'Reg MS' : 'Reg Milestones',
      low: terms.regMilestones.low,
      median: terms.regMilestones.median,
      high: terms.regMilestones.high,
      fill: '#0D9488', // teal-600
    },
    {
      name: isMobile ? 'Comm MS' : 'Comm Milestones',
      low: terms.commMilestones.low,
      median: terms.commMilestones.median,
      high: terms.commMilestones.high,
      fill: '#0891B2', // cyan-600
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
        <div className="bg-white p-3 rounded-lg shadow-lg border border-neutral-200">
          <p className="font-semibold text-navy-800 mb-1">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-neutral-500">
              Low: <span className="font-medium text-neutral-700">{formatCurrency(item.low)}</span>
            </p>
            <p className="text-teal-600">
              Median: <span className="font-bold">{formatCurrency(item.median)}</span>
            </p>
            <p className="text-neutral-500">
              High: <span className="font-medium text-neutral-700">{formatCurrency(item.high)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-36 sm:h-64 mb-2">
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
            tick={{ fontSize: isMobile ? 9 : 12, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickCount={isMobile ? 4 : 6}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: isMobile ? 9 : 12, fill: '#374151' }}
            axisLine={{ stroke: '#E5E7EB' }}
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
