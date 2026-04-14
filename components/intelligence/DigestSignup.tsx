'use client';

/**
 * Monthly intelligence digest signup. Posts to /api/intelligence/subscribe.
 * Uses the newsletter_subscribers table with source='intelligence_digest'.
 */

import { useState } from 'react';

export function DigestSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Enter a valid email.');
      return;
    }
    setStatus('loading');
    try {
      const res = await fetch('/api/intelligence/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data?.error ?? 'Subscription failed');
        return;
      }
      setStatus('ok');
      setMessage('Subscribed. First digest ships on the 1st of next month.');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Network error — try again.');
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
      <h3 className="text-sm font-semibold text-slate-200">Monthly intelligence digest</h3>
      <p className="mt-1 text-xs text-slate-400">
        One email a month. Summary of calibration rounds, upcoming Phase 3 readouts, AdComm
        calendar, and any major movements in the counterparty playbooks. No marketing.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'loading' || status === 'ok'}
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === 'loading' || status === 'ok'}
          className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'Subscribing…' : status === 'ok' ? 'Subscribed ✓' : 'Subscribe'}
        </button>
      </form>
      {message && (
        <p className={`mt-2 text-xs ${status === 'error' ? 'text-amber-400' : 'text-teal-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
