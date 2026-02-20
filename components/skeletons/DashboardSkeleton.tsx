export default function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
          <div className="h-4 w-32 bg-neutral-100 dark:bg-slate-800 rounded mt-2" />
        </div>
        <div className="h-10 w-10 bg-neutral-200 dark:bg-slate-700 rounded-full" />
      </div>

      {/* Stats cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700">
            <div className="h-3 w-20 bg-neutral-100 dark:bg-slate-700 rounded mb-3" />
            <div className="h-7 w-16 bg-neutral-200 dark:bg-slate-600 rounded" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <div className="md:col-span-2 lg:col-span-2 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-neutral-200 dark:bg-slate-700 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-neutral-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-3 w-16 bg-neutral-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-full bg-neutral-100 dark:bg-slate-800 rounded" />
            <div className="h-10 w-full bg-neutral-200 dark:bg-slate-700 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
