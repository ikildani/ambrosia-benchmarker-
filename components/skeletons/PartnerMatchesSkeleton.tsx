export default function PartnerMatchesSkeleton() {
  return (
    <div className="mt-8 border-t border-neutral-200 dark:border-slate-700 pt-8 animate-pulse">
      <div className="h-6 w-48 bg-neutral-200 dark:bg-slate-700 rounded mb-4" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-neutral-200 dark:bg-slate-700 rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-neutral-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-20 bg-neutral-100 dark:bg-slate-800 rounded mt-1" />
              </div>
            </div>
            <div className="h-2 w-full bg-neutral-100 dark:bg-slate-800 rounded-full">
              <div className="h-2 bg-neutral-200 dark:bg-slate-700 rounded-full" style={{ width: `${70 - i * 8}%` }} />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-neutral-100 dark:bg-slate-800 rounded" />
              <div className="h-3 w-4/5 bg-neutral-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
