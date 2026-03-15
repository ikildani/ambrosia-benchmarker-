'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { CHART_COLORS } from '@/lib/chartTheme';

interface Modifier {
  name: string;
  multiplier: number;
}

interface ModifierWaterfallProps {
  modifiers: Modifier[];
  baseValue: number;
}

function ModifierWaterfall({ modifiers, baseValue }: ModifierWaterfallProps) {
  const isMobile = useIsMobile();
  // Build waterfall data
  let runningValue = baseValue;
  const truncateLength = isMobile ? 6 : 10;
  const data = [
    {
      name: 'Base',
      value: baseValue,
      fill: CHART_COLORS.slate500,
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
        fill: mod.multiplier > 1 ? CHART_COLORS.positive : CHART_COLORS.negative,
        isPositive: mod.multiplier > 1,
        start: Math.min(runningValue, newValue),
      };
      runningValue = newValue;
      return item;
    }),
    {
      name: 'Final',
      value: runningValue,
      fill: CHART_COLORS.teal600,
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
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-slate-600">
          <p className="font-semibold text-navy-800 dark:text-white mb-1">
            {item.fullName || item.name}
          </p>
          {item.isBase && (
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              Base Value: <span className="font-bold">{formatCurrency(item.value)}</span>
            </p>
          )}
          {item.isFinal && (
            <p className="text-sm text-neutral-600 dark:text-slate-300">
              Final Value: <span className="font-bold text-teal-600 dark:text-teal-400">{formatCurrency(item.value)}</span>
            </p>
          )}
          {!item.isBase && !item.isFinal && (
            <p className={`text-sm ${item.isPositive ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
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
      <div className="w-full h-40 sm:h-48 flex items-center justify-center text-neutral-400 dark:text-slate-500 text-sm">
        No modifiers applied
      </div>
    );
  }

  const finalValue = data[data.length - 1]?.value ?? baseValue;
  const chartDescription = `Value modifier impact: Base ${formatCurrency(baseValue)}, ${modifiers.map(m => `${m.name} ${m.multiplier > 1 ? '+' : ''}${((m.multiplier - 1) * 100).toFixed(0)}%`).join(', ')}, Final ${formatCurrency(finalValue)}.`;

  return (
    <div className="w-full h-56 sm:h-80 mb-2" role="img" aria-label={chartDescription}>
      <table className="sr-only" aria-label="Deal value modifiers">
        <caption>Impact of each modifier on deal value</caption>
        <thead><tr><th scope="col">Modifier</th><th scope="col">Impact</th></tr></thead>
        <tbody>
          <tr><td>Base Value</td><td>{formatCurrency(baseValue)}</td></tr>
          {modifiers.map((mod, i) => (
            <tr key={i}><td>{mod.name}</td><td>{mod.multiplier > 1 ? '+' : ''}{((mod.multiplier - 1) * 100).toFixed(0)}%</td></tr>
          ))}
          <tr><td>Final Value</td><td>{formatCurrency(finalValue)}</td></tr>
        </tbody>
      </table>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: isMobile ? 10 : 20,
            left: isMobile ? 5 : 10,
            bottom: isMobile ? 80 : 75
          }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: isMobile ? 10 : 11, fill: CHART_COLORS.axisLabel }}
            angle={-30}
            textAnchor="end"
            height={isMobile ? 70 : 90}
            interval={0}
            axisLine={{ stroke: CHART_COLORS.axisLine }}
            tickMargin={5}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: isMobile ? 10 : 11, fill: CHART_COLORS.axisLabel }}
            axisLine={{ stroke: CHART_COLORS.axisLine }}
            width={isMobile ? 35 : 55}
            tickCount={isMobile ? 4 : 6}
          />
          <Tooltip
            content={<CustomTooltip />}
            position={isMobile ? { x: 10, y: 10 } : undefined}
            wrapperStyle={isMobile ? { pointerEvents: 'none' } : undefined}
          />
          <ReferenceLine y={baseValue} stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" />
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

export default React.memo(ModifierWaterfall);
