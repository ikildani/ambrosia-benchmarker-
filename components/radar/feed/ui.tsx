'use client';

/**
 * Small presentational primitives shared by the Radar feed. Institutional
 * palette: neutral-* surfaces, teal accent, amber only for the Pro badge and
 * mid-band scores. Every interactive element carries a visible focus ring.
 */

import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import type { OwnerType } from '@/lib/radar/types';
import { ownerTypeLabel } from '@/lib/radar/client/format';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950';

export const PANEL = 'rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900';

export const BTN_BASE = cn(
  'inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed',
  FOCUS_RING,
);
export const BTN_PRIMARY = cn(BTN_BASE, 'bg-teal-600 text-white hover:bg-teal-500 shadow-sm shadow-teal-600/20 px-4 py-2');
export const BTN_SECONDARY = cn(
  BTN_BASE,
  'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 px-4 py-2',
);
export const BTN_GHOST = cn(
  BTN_BASE,
  'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 px-3 py-1.5',
);

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: 'sm' | 'md';
}

/** Pill toggle (the house style for option groups; never a native select). */
export function Pill({ active = false, size = 'md', className, children, ...rest }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'rounded-full font-semibold transition-colors motion-reduce:transition-none',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        active
          ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/20'
          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({ label, onRemove, title }: { label: string; onRemove?: () => void; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-teal-600/30 bg-teal-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-teal-800 dark:border-teal-400/30 dark:bg-teal-500/10 dark:text-teal-200"
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className={cn('rounded-full p-0.5 hover:bg-teal-600/15 dark:hover:bg-teal-400/20', FOCUS_RING)}
        >
          <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse motion-reduce:animate-none rounded bg-neutral-200 dark:bg-neutral-800', className)} />;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400', className)}>
      {children}
    </div>
  );
}

/** Score colour by band: teal for 60+, amber for 40–59, neutral below. */
export function scoreTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-neutral-500 dark:text-neutral-500';
  if (score >= 60) return 'text-teal-700 dark:text-teal-300';
  if (score >= 40) return 'text-amber-700 dark:text-amber-300';
  return 'text-neutral-800 dark:text-neutral-200';
}

/** Evidence completeness behind the score as a dot; the label is exposed to assistive tech. */
export function ConfidenceDot({ confidence }: { confidence: number | null | undefined }) {
  const c = confidence ?? 0;
  const tone = c >= 70 ? 'bg-teal-500' : c >= 40 ? 'bg-amber-500' : c > 0 ? 'bg-neutral-400 dark:bg-neutral-500' : 'bg-transparent ring-1 ring-inset ring-neutral-400 dark:ring-neutral-600';
  const label = confidence === null || confidence === undefined ? 'No evidence found' : `Confidence ${Math.round(c)} of 100`;
  return (
    <span className="inline-flex items-center" title={label}>
      <span aria-hidden className={cn('h-2 w-2 rounded-full', tone)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Inline SVG sparkline; scaled to the series range so a flat line reads as flat. */
export function Sparkline({ values, width = 48, height = 16, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 1 - ((v - min) / span) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className={cn('shrink-0', className)}>
      <polyline
        points={pts}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={up ? 'stroke-teal-500' : 'stroke-neutral-400 dark:stroke-neutral-500'}
      />
    </svg>
  );
}

export function CountryTag({ code }: { code: string | null | undefined }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center rounded border border-neutral-300 px-1 font-mono text-[11px] font-medium leading-4 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
      {code}
    </span>
  );
}

const OWNER_TONE: Record<OwnerType, string> = {
  industry: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  academic: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  hospital: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  government: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  network: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  cro: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  other: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  unknown: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
};

export function OwnerTypeChip({ type }: { type: OwnerType }) {
  if (type === 'industry') return null; // the default case; only non-industry owners need a flag
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 text-[11px] font-medium leading-4', OWNER_TONE[type])}>
      {ownerTypeLabel(type)}
    </span>
  );
}

export function PartnershipTag({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-neutral-500">—</span>;
  const tone =
    status === 'unpartnered'
      ? 'text-teal-700 dark:text-teal-300'
      : status === 'partially_partnered'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-neutral-600 dark:text-neutral-400';
  const label = status === 'unpartnered' ? 'Unpartnered' : status === 'partially_partnered' ? 'Partial' : 'Partnered';
  return <span className={cn('text-xs font-medium', tone)}>{label}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-4 w-4 animate-spin motion-reduce:animate-none rounded-full border-2 border-neutral-300 border-t-teal-600 dark:border-neutral-700 dark:border-t-teal-400', className)}
    />
  );
}
