'use client';

import { useState, FormEvent } from 'react';

interface InsightEmailCaptureProps {
  slug: string;
}

export function InsightEmailCapture({ slug }: InsightEmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'insight_capture',
          calculation_context: {
            insight_slug: slug,
            captured_at: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Subscription failed');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'success') {
    return (
      <section className="my-12 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 sm:p-10 bg-slate-50 dark:bg-slate-800/50 text-center">
        <div className="text-teal-600 dark:text-teal-400 text-2xl font-semibold mb-2">
          Subscribed
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          You will receive weekly deal intelligence from Ambrosia Ventures.
        </p>
      </section>
    );
  }

  return (
    <section className="my-12 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 sm:p-10 bg-slate-50 dark:bg-slate-800/50">
      <div className="max-w-xl mx-auto text-center">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Get deal intelligence in your inbox
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Weekly benchmarks, market signals, and deal analysis from 1,900+ transactions.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            disabled={status === 'loading'}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>

        {status === 'error' && (
          <p className="text-red-500 text-xs mt-3">{errorMessage}</p>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}
