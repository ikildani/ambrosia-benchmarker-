'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface YearData {
  year: string;
  licensing: number;
  acquisitions: number;
  collaborations: number;
  other: number;
  total: number;
}

interface DealVolumeStackedChartProps {
  data: YearData[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  const total = payload.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl text-sm border border-slate-700">
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex justify-between gap-6">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300">{entry.name}</span>
          </span>
          <span className="text-white tabular-nums font-medium">{entry.value}</span>
        </div>
      ))}
      <div className="flex justify-between gap-6 mt-2 pt-2 border-t border-slate-700">
        <span className="text-slate-400 font-semibold">Total</span>
        <span className="text-white tabular-nums font-bold">{total}</span>
      </div>
    </div>
  );
};

export function DealVolumeStackedChart({ data }: DealVolumeStackedChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-80 animate-pulse bg-slate-50 rounded-xl" />;

  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradLicensing" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5A5" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="gradAcquisitions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="gradCollaborations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#64748b" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
            <Legend
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: 11, color: '#64748B', paddingTop: 8 }}
            />
            <Bar dataKey="licensing" name="Licensing" stackId="a" fill="url(#gradLicensing)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="acquisitions" name="Acquisitions" stackId="a" fill="url(#gradAcquisitions)" />
            <Bar dataKey="collaborations" name="Collaborations" stackId="a" fill="url(#gradCollaborations)" />
            <Bar dataKey="other" name="Co-dev + Options" stackId="a" fill="url(#gradOther)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 text-center tracking-wide">
        Source: Ambrosia Ventures | 2,339 transactions (2020-2026 YTD) | SEC filings, FTC premerger filings, press releases
      </p>
    </div>
  );
}
