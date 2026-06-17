'use client';

interface UsageCounterProps {
  remaining: number | null;
  tier: string;
  onUpgrade: () => void;
}

export function UsageCounter({ remaining, tier, onUpgrade }: UsageCounterProps) {
  if ((tier !== 'free' && tier !== 'starter') || remaining === null) return null;

  const limit = tier === 'starter' ? 10 : 3;
  const upgradeLabel = tier === 'starter' ? 'Upgrade to Pro' : 'Start Free Trial';

  if (remaining <= 0) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-sm text-red-300 font-medium">{tier === 'starter' ? 'Monthly' : 'Free'} calculations used</span>
        </div>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
        >
          {upgradeLabel}
        </button>
      </div>
    );
  }

  if (remaining === 1) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-amber-300 font-medium">Last free calculation</span>
        </div>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
        >
          {upgradeLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.06]">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${i < remaining ? 'bg-teal-400' : 'bg-slate-600'}`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400">
        {remaining} of {limit} {tier === 'starter' ? 'monthly' : 'free'} calculations remaining
      </span>
    </div>
  );
}
