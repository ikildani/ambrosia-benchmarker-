export default function ResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header gradient skeleton */}
      <div className="rounded-2xl bg-gradient-to-r from-neutral-200 to-neutral-100 h-32" />

      {/* Deal structure bar skeleton */}
      <div className="h-12 bg-neutral-100 rounded-xl" />

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-neutral-100 rounded-xl p-5 space-y-3">
            <div className="h-3 bg-neutral-100 rounded w-2/3" />
            <div className="h-7 bg-neutral-200 rounded w-full" />
            <div className="h-3 bg-neutral-100 rounded w-1/2" />
          </div>
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="bg-white border border-neutral-100 rounded-xl p-6">
        <div className="h-4 bg-neutral-100 rounded w-1/4 mb-4" />
        <div className="h-48 bg-neutral-50 rounded-lg" />
      </div>
    </div>
  );
}
