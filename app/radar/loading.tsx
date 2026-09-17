import { TableSkeleton } from '@/components/radar/feed/FeedStates';

export default function RadarLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 pt-16 dark:bg-neutral-950 sm:pt-20">
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">Loading assets</p>
        <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <TableSkeleton />
        </div>
      </div>
    </div>
  );
}
