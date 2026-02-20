export default function HistoryListSkeleton() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-700 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-neutral-200 dark:bg-slate-700 rounded-full" />
                <div className="h-5 w-24 bg-neutral-100 dark:bg-slate-800 rounded-full" />
              </div>
              <div className="h-4 w-48 bg-neutral-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-32 bg-neutral-100 dark:bg-slate-800 rounded" />
            </div>
            <div className="text-right space-y-2">
              <div className="h-6 w-20 bg-neutral-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-neutral-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
