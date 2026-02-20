import React from 'react';

const metrics = [
  { label: 'Upfront Payment', value: '$85M', color: 'from-teal-500 to-teal-400', bgLight: 'bg-teal-50', bgDark: 'dark:bg-teal-500/10', textLight: 'text-teal-600', textDark: 'dark:text-teal-400' },
  { label: 'Total Deal Value', value: '$450M', color: 'from-cyan-500 to-cyan-400', bgLight: 'bg-cyan-50', bgDark: 'dark:bg-cyan-500/10', textLight: 'text-cyan-600', textDark: 'dark:text-cyan-400' },
  { label: 'Dev Milestones', value: '$120M', color: 'from-emerald-500 to-emerald-400', bgLight: 'bg-emerald-50', bgDark: 'dark:bg-emerald-500/10', textLight: 'text-emerald-600', textDark: 'dark:text-emerald-400' },
  { label: 'Royalties', value: '8-12%', color: 'from-purple-500 to-purple-400', bgLight: 'bg-purple-50', bgDark: 'dark:bg-purple-500/10', textLight: 'text-purple-600', textDark: 'dark:text-purple-400' },
];

const HeroProductPreview = React.memo(function HeroProductPreview() {
  return (
    <div className="hidden lg:block relative" aria-hidden="true">
      {/* Glow effect behind the browser window */}
      <div className="absolute -inset-4 bg-gradient-to-br from-teal-500/20 via-cyan-500/15 to-teal-400/10 dark:from-teal-500/15 dark:via-cyan-500/10 dark:to-teal-400/5 rounded-3xl blur-2xl" />

      {/* Floating browser mockup with perspective tilt */}
      <div
        className="relative motion-safe:animate-float"
        style={{
          transform: 'perspective(1000px) rotateY(-5deg) rotateX(2deg)',
        }}
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
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                <svg className="w-2.5 h-2.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                calculator.ambrosiaventures.co
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="p-4">
            {/* Analysis header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400">Analysis Complete</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400">Phase 2</span>
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400">Oncology</span>
                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500 dark:text-slate-400">ADC</span>
              </div>
            </div>

            {/* 2x2 metric cards grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className={`${metric.bgLight} ${metric.bgDark} rounded-lg p-3 border border-slate-100 dark:border-slate-700/50`}
                >
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    {metric.label}
                  </div>
                  <div className={`text-lg font-bold bg-gradient-to-r ${metric.color} bg-clip-text text-transparent`}>
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Deal structure bar */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Deal Structure
                </span>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  25% Upfront / 75% Milestones
                </span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-l-full" style={{ width: '25%' }} />
                <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-r-full" style={{ width: '75%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HeroProductPreview;
