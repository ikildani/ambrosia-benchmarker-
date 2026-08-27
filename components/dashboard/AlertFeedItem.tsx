'use client';

interface AlertFeedItemProps {
  headline: string;
  date: string;
  ta?: string;
  licensor?: string;
  licensee?: string;
  upfront?: number | null;
  totalValue?: number | null;
  impactNote?: string;
  blurred?: boolean;
}

const TA_COLORS: Record<string, string> = {
  oncology: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
  neurology: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  immunology: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  metabolic: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  cardiovascular: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  infectiousDisease: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  ophthalmology: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  rareDisease: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  hematology: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  dermatology: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-400',
  gastroenterology: 'bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-400',
};

function formatM(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val}`;
}

export default function AlertFeedItem({
  headline, date, ta, licensor, licensee, upfront, totalValue, impactNote, blurred,
}: AlertFeedItemProps) {
  const taClass = ta ? (TA_COLORS[ta] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400') : '';
  const taLabel = ta ? ta.replace(/([A-Z])/g, ' $1').trim() : '';

  return (
    <div className="flex gap-3 py-3 group">
      <div className="flex flex-col items-center pt-1.5">
        <div className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {ta && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${taClass}`}>
              {taLabel}
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-900 dark:text-white leading-snug">
          {licensor && licensee ? `${licensor} → ${licensee}` : headline}
        </p>
        {(upfront || totalValue) && (
          <div className={`flex items-center gap-3 mt-1 text-xs ${blurred ? 'blur-[4px] select-none' : ''}`}>
            {upfront != null && (
              <span className="text-slate-600 dark:text-slate-400">Upfront: <span className="font-medium text-slate-900 dark:text-white">{formatM(upfront)}</span></span>
            )}
            {totalValue != null && (
              <span className="text-slate-600 dark:text-slate-400">Total: <span className="font-medium text-slate-900 dark:text-white">{formatM(totalValue)}</span></span>
            )}
          </div>
        )}
        {impactNote && (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{impactNote}</p>
        )}
      </div>
    </div>
  );
}
