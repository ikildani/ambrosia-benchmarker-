export default function AssetBriefLoading() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 pt-16 sm:pt-20 lg:pt-24" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse motion-reduce:animate-none space-y-6">
          <div className="h-3 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-8 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-4 w-1/2 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-neutral-100 dark:bg-neutral-900" />)}
          </div>
          <div className="h-10 w-full rounded bg-neutral-100 dark:bg-neutral-900" />
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="h-64 rounded-lg bg-neutral-100 dark:bg-neutral-900" />
              <div className="h-48 rounded-lg bg-neutral-100 dark:bg-neutral-900" />
            </div>
            <div className="h-80 rounded-lg bg-neutral-100 dark:bg-neutral-900" />
          </div>
        </div>
        <p className="sr-only">Loading asset brief</p>
      </div>
    </div>
  );
}
