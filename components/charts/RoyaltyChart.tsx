'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TieredRoyalties } from '@/lib/calculations';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

interface RoyaltyChartProps {
  royalties: TieredRoyalties;
}

export default function RoyaltyChart({ royalties }: RoyaltyChartProps) {
  const isMobile = useIsMobile();
  // Create data points for the step chart - simplified on mobile
  const data = isMobile ? [
    { sales: 0, low: royalties.base.low, high: royalties.base.high, tier: 'Base' },
    { sales: 500, low: royalties.midTier.low, high: royalties.midTier.high, tier: 'Mid' },
    { sales: 1000, low: royalties.highTier.low, high: royalties.highTier.high, tier: 'High' },
    { sales: 2000, low: royalties.highTier.low, high: royalties.highTier.high, tier: 'High' },
  ] : [
    { sales: 0, low: royalties.base.low, high: royalties.base.high, tier: 'Base' },
    { sales: 250, low: royalties.base.low, high: royalties.base.high, tier: 'Base' },
    { sales: 500, low: royalties.midTier.low, high: royalties.midTier.high, tier: 'Mid' },
    { sales: 750, low: royalties.midTier.low, high: royalties.midTier.high, tier: 'Mid' },
    { sales: 1000, low: royalties.highTier.low, high: royalties.highTier.high, tier: 'High' },
    { sales: 1500, low: royalties.highTier.low, high: royalties.highTier.high, tier: 'High' },
    { sales: 2000, low: royalties.highTier.low, high: royalties.highTier.high, tier: 'High' },
  ];

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string }>;
    label?: number;
  }) => {
    if (active && payload && payload.length) {
      const item = data.find(d => d.sales === label);
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-neutral-200 dark:border-slate-600">
          <p className="font-semibold text-navy-800 dark:text-white mb-1">
            ${label}M Annual Sales
          </p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mb-2">{item?.tier} Tier</p>
          <div className="space-y-1 text-sm">
            <p className="text-neutral-600 dark:text-slate-300">
              Royalty Range: <span className="font-bold text-teal-600 dark:text-teal-400">
                {payload[0]?.value}% - {payload[1]?.value}%
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const chartDescription = `Tiered royalty structure: Base tier ${royalties.base.low}%-${royalties.base.high}%, Mid tier ($500M+) ${royalties.midTier.low}%-${royalties.midTier.high}%, High tier ($1B+) ${royalties.highTier.low}%-${royalties.highTier.high}%.`;

  return (
    <div className="w-full" role="img" aria-label={chartDescription}>
      <table className="sr-only" aria-label="Tiered royalty rates">
        <caption>Royalty rates by annual sales tier</caption>
        <thead><tr><th>Tier</th><th>Sales Threshold</th><th>Low Rate</th><th>High Rate</th></tr></thead>
        <tbody>
          <tr><td>Base</td><td>$0-$500M</td><td>{royalties.base.low}%</td><td>{royalties.base.high}%</td></tr>
          <tr><td>Mid</td><td>$500M-$1B</td><td>{royalties.midTier.low}%</td><td>{royalties.midTier.high}%</td></tr>
          <tr><td>High</td><td>$1B+</td><td>{royalties.highTier.low}%</td><td>{royalties.highTier.high}%</td></tr>
        </tbody>
      </table>
      <div className="h-32 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 5,
              right: isMobile ? 5 : 30,
              left: 0,
              bottom: isMobile ? 5 : 10
            }}
          >
          <defs>
            <linearGradient id="royaltyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="sales"
            tickFormatter={(value) => value === 0 ? '$0' : value >= 1000 ? `$${value/1000}B` : `$${value}M`}
            tick={{ fontSize: isMobile ? 8 : 11, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            ticks={isMobile ? [0, 500, 1000, 2000] : [0, 500, 1000, 2000]}
            tickMargin={isMobile ? 2 : 8}
          />
          <YAxis
            domain={[0, Math.max(royalties.highTier.high + 5, 30)]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: isMobile ? 8 : 11, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            width={isMobile ? 28 : 40}
            tickCount={isMobile ? 4 : 6}
          />
          <Tooltip
            content={<CustomTooltip />}
            position={isMobile ? { x: 10, y: 10 } : undefined}
            wrapperStyle={isMobile ? { pointerEvents: 'none' } : undefined}
          />
          <ReferenceLine x={500} stroke="#E5E7EB" strokeDasharray="3 3" />
          <ReferenceLine x={1000} stroke="#E5E7EB" strokeDasharray="3 3" />
          <Area
            type="stepAfter"
            dataKey="low"
            stroke="#0D9488"
            strokeWidth={2}
            fill="url(#royaltyGradient)"
          />
          <Area
            type="stepAfter"
            dataKey="high"
            stroke="#14B8A6"
            strokeWidth={2}
            fill="none"
            strokeDasharray="4 2"
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
      <div className="hidden sm:flex justify-center gap-12 mt-6 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-6 h-0.5 bg-teal-600 rounded"></div>
          <span className="text-neutral-600 dark:text-slate-400">Low Range</span>
        </div>
        <div className="flex items-center gap-3">
          <svg className="w-6 h-2" viewBox="0 0 24 2">
            <line x1="0" y1="1" x2="24" y2="1" stroke="#14B8A6" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
          <span className="text-neutral-600 dark:text-slate-400">High Range</span>
        </div>
      </div>
    </div>
  );
}
