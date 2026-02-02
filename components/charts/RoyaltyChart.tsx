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
        <div className="bg-white p-3 rounded-lg shadow-lg border border-neutral-200">
          <p className="font-semibold text-navy-800 mb-1">
            ${label}M Annual Sales
          </p>
          <p className="text-xs text-neutral-500 mb-2">{item?.tier} Tier</p>
          <div className="space-y-1 text-sm">
            <p className="text-neutral-600">
              Royalty Range: <span className="font-bold text-teal-600">
                {payload[0]?.value}% - {payload[1]?.value}%
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
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
      <div className="hidden sm:flex justify-center gap-8 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-teal-600"></div>
          <span className="text-neutral-500">Low Range</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-teal-500 border-dashed"></div>
          <span className="text-neutral-500">High Range</span>
        </div>
      </div>
    </div>
  );
}
