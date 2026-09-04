export default function RadarLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-200 dark:border-amber-800 border-t-amber-500 animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading Asset Radar...</p>
      </div>
    </div>
  );
}
