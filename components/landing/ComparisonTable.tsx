'use client';

import { useEffect, useRef, useState } from 'react';

const comparisonRows = [
  { feature: 'Time to analyze', manual: '2-3 weeks', ambrosia: 'Under 30 seconds' },
  { feature: 'Data coverage', manual: '1-2 databases', ambrosia: '1,900+ deals from 10+ sources' },
  { feature: 'Financial modeling', manual: 'Custom Excel models', ambrosia: 'rNPV + Monte Carlo (10K iterations)' },
  { feature: 'Comparable deals', manual: 'Hours of manual search', ambrosia: 'Semantic matching, ranked by similarity' },
  { feature: 'Partner intelligence', manual: 'Relationship-based', ambrosia: '850+ company profiles with deal history' },
  { feature: 'Cost', manual: '$5K-$25K per engagement', ambrosia: 'Free to start' },
];

export default function ComparisonTable() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-10 sm:py-14 lg:py-18 px-4 xl:px-6 bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-3xl xl:max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Manual Analysis vs Ambrosia
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            How institutional deal benchmarking should work
          </p>
        </div>

        <div
          ref={sectionRef}
          className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft overflow-hidden
                     motion-safe:transition-all motion-safe:duration-700
                     ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-700">
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Feature</span>
              </div>
              <div className="px-5 py-3 bg-red-50/30 dark:bg-red-900/5 text-center">
                <span className="text-xs font-semibold text-red-400 dark:text-red-500 uppercase tracking-wider">Traditional</span>
              </div>
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/30 text-center">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Ambrosia</span>
              </div>
            </div>
            {comparisonRows.map((row, idx) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 border-b border-slate-100 dark:border-slate-700/50 last:border-b-0
                           ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/10'}`}
              >
                <div className="px-5 py-3 flex items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{row.feature}</span>
                </div>
                <div className="px-5 py-3 flex items-center justify-center gap-2 text-center">
                  <svg className="w-3.5 h-3.5 text-red-300 dark:text-red-500/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm text-slate-400 dark:text-slate-500">{row.manual}</span>
                </div>
                <div className="px-5 py-3 flex items-center justify-center gap-2 text-center">
                  <svg className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{row.ambrosia}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile stacked cards */}
          <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
            {comparisonRows.map((row) => (
              <div key={row.feature} className="p-4 space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.feature}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50/30 dark:bg-red-900/5 rounded-lg p-2.5">
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3 h-3 text-red-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-xs text-slate-400">{row.manual}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-2.5">
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.ambrosia}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
