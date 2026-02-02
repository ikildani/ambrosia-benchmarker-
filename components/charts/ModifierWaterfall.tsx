'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

interface Modifier {
  name: string;
  multiplier: number;
}

interface ModifierWaterfallProps {
  modifiers: Modifier[];
  baseValue: number;
}

export default function ModifierWaterfall({ modifiers, baseValue }: ModifierWaterfallProps) {
  const isMobile = useIsMobile();
  // Build waterfall data
  let runningValue = baseValue;
  const truncateLength = isMobile ? 6 : 10;
  const data = [
    {
      name: 'Base',
      value: baseValue,
      fill: '#64748B', // slate-500
      isBase: true,
    },
    ...modifiers.map((mod) => {
      const impact = runningValue * (mod.multiplier - 1);
      const newValue = runningValue + impact;
      const item = {
        name: mod.name.length > truncateLength ? mod.name.substring(0, truncateLength) + '...' : mod.name,
        fullName: mod.name,
        value: Math.abs(impact),
        impact,
        fill: mod.multiplier > 1 ? '#14B8A6' : '#F59E0B', // teal or amber
        isPositive: mod.multiplier > 1,
        start: Math.min(runningValue, newValue),
      };
      runningValue = newValue;
      return item;
    }),
    {
      name: 'Final',
      value: runningValue,
      fill: '#0D9488', // teal-600
      isFinal: true,
    },
  ];

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
    return `$${value.toFixed(0)}M`;
  };

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        name: string;
        fullName?: string;
        value: number;
        impact?: number;
        isBase?: boolean;
        isFinal?: boolean;
        isPositive?: boolean;
      };
    }>;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;

      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-neutral-200">
          <p className="font-semibold text-navy-800 mb-1">
            {item.fullName || item.name}
          </p>
          {item.isBase && (
            <p className="text-sm text-neutral-600">
              Base Value: <span className="font-bold">{formatCurrency(item.value)}</span>
            </p>
          )}
          {item.isFinal && (
            <p className="text-sm text-neutral-600">
              Final Value: <span className="font-bold text-teal-600">{formatCurrency(item.value)}</span>
            </p>
          )}
          {!item.isBase && !item.isFinal && (
            <p className={`text-sm ${item.isPositive ? 'text-teal-600' : 'text-amber-600'}`}>
              {item.isPositive ? '+' : '-'}{formatCurrency(item.value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (modifiers.length === 0) {
    return (
      <div className="w-full h-40 sm:h-48 flex items-center justify-center text-neutral-400 text-sm">
        No modifiers applied
      </div>
    );
  }

  return (
    <div className="w-full h-48 sm:h-72 mb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: isMobile ? 10 : 20,
            left: isMobile ? 5 : 10,
            bottom: isMobile ? 70 : 60
          }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: isMobile ? 8 : 11, fill: '#6B7280' }}
            angle={-35}
            textAnchor="end"
            height={isMobile ? 60 : 80}
            interval={0}
            axisLine={{ stroke: '#E5E7EB' }}
            tickMargin={5}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: isMobile ? 8 : 11, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            width={isMobile ? 35 : 55}
            tickCount={isMobile ? 4 : 6}
          />
          <Tooltip
            content={<CustomTooltip />}
            position={isMobile ? { x: 10, y: 10 } : undefined}
            wrapperStyle={isMobile ? { pointerEvents: 'none' } : undefined}
          />
          <ReferenceLine y={baseValue} stroke="#E5E7EB" strokeDasharray="3 3" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
