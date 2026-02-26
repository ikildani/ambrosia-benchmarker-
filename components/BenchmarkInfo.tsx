'use client';

import { useState, useRef } from 'react';
import benchmarks from '@/data/benchmarks.json';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

interface ChangelogEntry {
  date: string;
  version: string;
  summary: string;
  changes: string[];
}

export default function BenchmarkInfo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { metadata } = benchmarks;

  useFocusTrap(modalRef, isModalOpen, () => setIsModalOpen(false));
  const changelog = (metadata as { changelog?: ChangelogEntry[] }).changelog || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Inline Badge */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-500/20 dark:to-cyan-500/20 hover:from-teal-100 hover:to-cyan-100 dark:hover:from-teal-500/30 dark:hover:to-cyan-500/30 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full border border-teal-200 dark:border-teal-500/30 transition-all duration-200 group"
      >
        <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Data: {metadata.lastUpdated}</span>
        <svg className="w-3 h-3 text-teal-500 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal Content */}
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="benchmark-info-title" tabIndex={-1} className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 id="benchmark-info-title" className="text-lg font-bold text-white">Benchmark Data</h3>
                  <p className="text-sm text-neutral-300">Version {metadata.version}</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              {/* Current Status */}
              <div className="p-6 border-b border-neutral-100 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-slate-400">Last Updated</p>
                    <p className="text-lg font-bold text-navy-800 dark:text-white">{metadata.lastUpdated}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-neutral-500 dark:text-slate-400">Next Update</p>
                    <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{(metadata as { nextUpdate?: string }).nextUpdate || 'TBD'}</p>
                  </div>
                </div>

                {/* Data Sources */}
                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Data Sources</p>
                  <ul className="space-y-1">
                    {metadata.sources.map((source, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-slate-300">
                        <svg className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {source}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Changelog */}
              <div className="p-6">
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-4">Changelog</h4>
                <div className="space-y-4">
                  {changelog.map((entry, idx) => (
                    <div key={idx} className="relative pl-4 border-l-2 border-teal-200 dark:border-teal-500/50">
                      <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-teal-500" />
                      <div className="mb-1">
                        <span className="text-sm font-bold text-navy-800 dark:text-white">{entry.summary}</span>
                        <span className="ml-2 text-xs text-neutral-500 dark:text-slate-400">v{entry.version}</span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-slate-400 mb-2">{formatDate(entry.date)}</p>
                      <ul className="space-y-1">
                        {entry.changes.map((change, changeIdx) => (
                          <li key={changeIdx} className="text-sm text-neutral-600 dark:text-slate-300 flex items-start gap-2">
                            <span className="text-teal-500 flex-shrink-0">•</span>
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-neutral-50 dark:bg-slate-700/50 border-t border-neutral-100 dark:border-slate-700">
              <p className="text-xs text-neutral-500 dark:text-slate-400 text-center">
                Benchmarks are updated monthly based on market activity
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
