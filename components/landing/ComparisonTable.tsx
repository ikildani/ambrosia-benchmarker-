'use client';

import { useEffect, useRef, useState } from 'react';

const comparisonRows = [
  { feature: 'Time to analyze', manual: '2-3 weeks', ambrosia: 'Under 30 seconds' },
  { feature: 'Data sources', manual: '1-2 databases', ambrosia: '600+ deals, SEC filings, press releases' },
  { feature: 'Comparable deals', manual: 'Hours of manual search', ambrosia: 'Instant AI-powered matching' },
  { feature: 'Cost per analysis', manual: '$5,000-$25,000 consultant', ambrosia: 'Free to start' },
  { feature: 'Partner matching', manual: 'Relationship-based only', ambrosia: 'AI-matched across 50+ companies' },
  { feature: 'Sensitivity analysis', manual: 'Build custom Excel models', ambrosia: 'One-click scenario modeling' },
  { feature: 'Board-ready reports', manual: 'Days of formatting', ambrosia: 'Instant PDF & Excel export' },
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
    <section className="py-16 sm:py-20 lg:py-24 xl:py-28 px-4 xl:px-6 bg-white dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl xl:max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-50 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 rounded-full px-4 py-1.5 mb-6">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="text-sm font-medium text-teal-700 dark:text-teal-400">Side by Side</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-navy-800 dark:text-white mb-3 sm:mb-4">
            Manual Analysis vs Ambrosia
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 dark:text-slate-400 max-w-xl mx-auto">
            See how Ambrosia transforms your deal analysis workflow
          </p>
        </div>

        <div
          ref={sectionRef}
          className={`bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-soft-lg overflow-hidden
                     motion-safe:transition-all motion-safe:duration-700
                     ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Desktop table */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-3 border-b border-neutral-200 dark:border-slate-700">
              <div className="p-4 sm:p-5 bg-neutral-50 dark:bg-slate-700/50">
                <span className="text-sm font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Feature</span>
              </div>
              <div className="p-4 sm:p-5 bg-red-50/50 dark:bg-red-900/10 text-center">
                <span className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Manual</span>
              </div>
              <div className="p-4 sm:p-5 bg-teal-50/50 dark:bg-teal-900/10 text-center">
                <span className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Ambrosia</span>
              </div>
            </div>
            {comparisonRows.map((row, idx) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 border-b border-neutral-100 dark:border-slate-700/50 last:border-b-0
                           ${idx % 2 === 0 ? '' : 'bg-neutral-50/50 dark:bg-slate-700/20'}`}
              >
                <div className="p-4 sm:p-5 flex items-center">
                  <span className="text-sm font-medium text-neutral-700 dark:text-slate-300">{row.feature}</span>
                </div>
                <div className="p-4 sm:p-5 flex items-center justify-center gap-2 text-center">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm text-neutral-500 dark:text-slate-400">{row.manual}</span>
                </div>
                <div className="p-4 sm:p-5 flex items-center justify-center gap-2 text-center">
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-teal-700 dark:text-teal-400">{row.ambrosia}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile stacked cards */}
          <div className="sm:hidden divide-y divide-neutral-100 dark:divide-slate-700/50">
            {comparisonRows.map((row) => (
              <div key={row.feature} className="p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-700 dark:text-slate-300">{row.feature}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">Manual</p>
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-xs text-neutral-500 dark:text-slate-400">{row.manual}</span>
                    </div>
                  </div>
                  <div className="bg-teal-50/50 dark:bg-teal-900/10 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-teal-500 dark:text-teal-400 uppercase tracking-wider mb-1">Ambrosia</p>
                    <div className="flex items-start gap-1.5">
                      <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-medium text-teal-700 dark:text-teal-400">{row.ambrosia}</span>
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
