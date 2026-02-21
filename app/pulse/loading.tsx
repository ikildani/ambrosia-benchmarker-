export default function PulseLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 pt-16 sm:pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-6 w-32 bg-white/10 rounded-full animate-pulse" />
            <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
          </div>
          <div className="h-9 w-52 bg-white/10 rounded-lg animate-pulse mb-3" />
          <div className="h-5 w-96 max-w-full bg-white/10 rounded animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
