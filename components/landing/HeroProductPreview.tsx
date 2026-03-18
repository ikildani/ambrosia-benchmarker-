import React from 'react';

const HeroProductPreview = React.memo(function HeroProductPreview() {
  return (
    <div className="hidden lg:block relative" aria-hidden="true">
      {/* Subtle glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-slate-500/8 via-blue-500/5 to-slate-400/3 dark:from-blue-600/10 dark:via-slate-600/5 dark:to-blue-500/3 rounded-3xl blur-2xl" />

      <div
        className="relative motion-safe:animate-float"
        style={{ transform: 'perspective(1000px) rotateY(-5deg) rotateX(2deg)' }}
      >
        <div className="w-[380px] xl:w-[420px] bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xl shadow-black/20 overflow-hidden">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <svg className="w-2.5 h-2.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                calculator.ambrosiaventures.co
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Tags */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">Live</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">Phase 2</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">ADC</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">Breast (TNBC)</span>
            </div>

            {/* Primary metrics — large, readable */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-100 dark:border-slate-600/50">
                <div className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Upfront</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">$85M</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">$47M — $612M range</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-100 dark:border-slate-600/50">
                <div className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Value</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">$450M</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">$280M — $1.2B range</div>
              </div>
            </div>

            {/* Secondary metrics — compact row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600/30">
                <div className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Milestones</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">$120M</div>
              </div>
              <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600/30">
                <div className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Royalties</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">8-12%</div>
              </div>
              <div className="text-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-100 dark:border-slate-600/30">
                <div className="text-[8px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">rNPV</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">$312M</div>
              </div>
            </div>

            {/* Deal structure bar */}
            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2.5 border border-slate-100 dark:border-slate-600/30">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Deal Structure</span>
                <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">25% Upfront / 75% Milestones</span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden flex">
                <div className="h-full bg-slate-700 dark:bg-blue-400 rounded-l-full" style={{ width: '25%' }} />
                <div className="h-full bg-slate-400 dark:bg-blue-600 rounded-r-full" style={{ width: '75%' }} />
              </div>
            </div>

            {/* Comparable deals mini-preview */}
            <div className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center justify-between pt-1">
              <span>Based on 47 comparable ADC deals</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">View all →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HeroProductPreview;
