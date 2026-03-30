'use client';

import { useState } from 'react';

interface EmailGatedDownloadProps {
  reportTitle: string;
  reportUrl: string;
  source?: string;
}

export function EmailGatedDownload({ reportTitle, reportUrl, source = 'report-download' }: EmailGatedDownloadProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      // Log to Formspree for email capture
      await fetch('https://formspree.io/f/maqbwgbq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          source,
          report: reportTitle,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Still unlock even if Formspree fails
    }

    // Also log to our API for tracking
    try {
      await fetch('/api/events/report-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: 'q1-2026-pdf-download',
          referrer: document.referrer || null,
          ua: navigator.userAgent,
        }),
      });
    } catch {
      // Silent fail
    }

    setIsUnlocked(true);
    setIsSubmitting(false);
  };

  if (isUnlocked) {
    return (
      <div className="my-10 border border-teal-200 bg-teal-50 rounded-xl p-6 text-center">
        <svg className="w-8 h-8 text-teal-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm font-semibold text-teal-900 mb-3">Download unlocked</p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
        <p className="text-xs text-teal-700 mt-2">Tip: Use Cmd+P or Ctrl+P to save as PDF</p>
      </div>
    );
  }

  return (
    <div className="my-10 border border-slate-200 bg-slate-50 rounded-xl p-6">
      <div className="sm:flex items-start gap-6">
        <div className="flex-1 mb-4 sm:mb-0">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-base font-bold text-slate-900">Download This Report</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Get the full {reportTitle} as a PDF — all exhibits, data tables, and methodology notes included. Enter your email to unlock the download.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex-shrink-0 sm:w-72">
          <div className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="Work email *"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none ${error ? 'border-red-400' : 'border-slate-300'}`}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Unlocking...' : 'Unlock Download'}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">We respect your privacy. No spam.</p>
        </form>
      </div>
    </div>
  );
}
