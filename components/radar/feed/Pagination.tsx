'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { BTN_SECONDARY, cn } from './ui';

interface Props {
  page: number;
  rowsOnPage: number;
  pageSize: number;
  estimatedTotal: number | null;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  loading?: boolean;
}

export function Pagination({ page, rowsOnPage, pageSize, estimatedTotal, hasNext, hasPrev, onNext, onPrev, loading }: Props) {
  const from = rowsOnPage === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + rowsOnPage;
  const totalText =
    estimatedTotal === null ? '' : ` of ${estimatedTotal < 1000 ? estimatedTotal.toLocaleString('en-US') : `about ${(Math.round(estimatedTotal / 100) * 100).toLocaleString('en-US')}`}`;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
      <p className="text-xs text-neutral-600 dark:text-neutral-400" aria-live="polite">
        {rowsOnPage === 0 ? 'No rows' : `Rows ${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')}${totalText}`}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onPrev} disabled={!hasPrev || loading} className={cn(BTN_SECONDARY, 'px-2.5 py-1.5')} aria-label="Previous page">
          <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="px-1 font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-400">Page {page}</span>
        <button type="button" onClick={onNext} disabled={!hasNext || loading} className={cn(BTN_SECONDARY, 'px-2.5 py-1.5')} aria-label="Next page">
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
