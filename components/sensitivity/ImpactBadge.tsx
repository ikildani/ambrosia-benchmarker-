'use client';

import { ImpactLevel } from '@/lib/sensitivity';

interface ImpactBadgeProps {
  level: ImpactLevel;
}

const badgeStyles: Record<ImpactLevel, string> = {
  'VERY HIGH': 'bg-teal-500 text-white',
  'HIGH': 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  'MEDIUM': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'LOW': 'bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-400',
};

export default function ImpactBadge({ level }: ImpactBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${badgeStyles[level]}`}
    >
      {level} IMPACT
    </span>
  );
}
