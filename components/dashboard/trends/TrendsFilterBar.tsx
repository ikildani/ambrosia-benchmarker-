'use client';

import { therapeuticAreaOptions } from '@/lib/calculations';

interface TrendsFilterBarProps {
  selectedTA: string;
  fromYear: number;
  toYear: number;
  onTAChange: (ta: string) => void;
  onFromChange: (year: number) => void;
  onToChange: (year: number) => void;
}

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

export default function TrendsFilterBar({
  selectedTA, fromYear, toYear, onTAChange, onFromChange, onToChange,
}: TrendsFilterBarProps) {
  const selectClass = 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 outline-none transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <select value={selectedTA} onChange={e => onTAChange(e.target.value)} className={selectClass}>
        <option value="all">All Therapeutic Areas</option>
        {therapeuticAreaOptions.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <select value={fromYear} onChange={e => onFromChange(Number(e.target.value))} className={selectClass}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span>to</span>
        <select value={toYear} onChange={e => onToChange(Number(e.target.value))} className={selectClass}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}
