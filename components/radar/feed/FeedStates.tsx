'use client';

import { ExclamationTriangleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { BTN_PRIMARY, BTN_SECONDARY, Skeleton, cn } from './ui';

/** Skeleton rows matching the table's 56px row height. */
export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading assets" className="divide-y divide-neutral-200 dark:divide-neutral-800">
      <span className="sr-only">Loading assets</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={`sk-${i}`} className="flex h-14 items-center gap-4 px-4" aria-hidden>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading assets" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">Loading assets</span>
      {Array.from({ length: cards }, (_, i) => (
        <div key={`skc-${i}`} className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800" aria-hidden>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-10" />
          </div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  onClear,
  onBrowseAll,
}: {
  title: string;
  body: string;
  onClear?: () => void;
  onBrowseAll?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
        <MagnifyingGlassIcon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
      <div className="mt-5 flex items-center gap-2">
        {onClear && (
          <button type="button" onClick={onClear} className={BTN_PRIMARY}>
            Clear filters
          </button>
        )}
        {onBrowseAll && (
          <button type="button" onClick={onBrowseAll} className={BTN_SECONDARY}>
            Browse all assets
          </button>
        )}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry, compact }: { message: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-20',
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
        <ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Could not load this view</p>
      <p className="max-w-sm text-xs text-neutral-600 dark:text-neutral-400">{message}</p>
      <button type="button" onClick={onRetry} className={BTN_SECONDARY}>
        Try again
      </button>
    </div>
  );
}
