'use client';

import { useState, useEffect, type ReactNode } from 'react';

interface ReportEmailGateProps {
  children: ReactNode;
  report: string;
}

const STORAGE_KEY = 'ambrosia_report_email';

export function ReportEmailGate({ children, report }: ReportEmailGateProps) {
  const [email, setEmail] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setEmail(stored);
  }, []);

  useEffect(() => {
    if (!email) return;
    fetch('/api/events/report-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report,
        email,
        referrer: document.referrer || null,
        ua: navigator.userAgent,
      }),
    }).catch(() => {});
  }, [email, report]);

  if (email) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="max-h-[600px] overflow-hidden relative" aria-hidden="true">
        <div className="pointer-events-none select-none" style={{ filter: 'blur(6px)' }}>
          {children}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
      </div>

      {/* Gate */}
      <div className="relative -mt-32 pb-20">
        <div className="max-w-lg mx-auto px-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Continue reading the full report</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Enter your work email to unlock the complete Q1 2026 analysis — all 9 sections, interactive charts, and downloadable benchmarks.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!inputValue) return;
                setIsSubmitting(true);
                try {
                  await fetch('/api/newsletter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: inputValue, source: `report-gate-${report}` }),
                  });
                } catch {}
                localStorage.setItem(STORAGE_KEY, inputValue);
                setEmail(inputValue);
                setIsSubmitting(false);
              }}
              className="flex gap-2"
            >
              <input
                type="email"
                required
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 px-4 py-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isSubmitting ? 'Unlocking...' : 'Unlock Report'}
              </button>
            </form>
            <p className="text-[11px] text-slate-400 mt-4">Free access. No credit card. Unsubscribe anytime.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
