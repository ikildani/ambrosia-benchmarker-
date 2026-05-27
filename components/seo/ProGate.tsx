'use client';

import { useState } from 'react';
import Link from 'next/link';

export function ProGate({
  children,
  title = 'Full Analysis Available with Pro',
  description = 'See all comparable deals, milestone breakdowns, royalty structures, and negotiation insights.',
  pageSlug = '',
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  pageSlug?: string;
}) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'pro_gate', page: pageSlug }),
      });
      setSubmitted(true);
    } catch {
      // Still show success — don't block UX for API failure
      setSubmitted(true);
    }
    setLoading(false);
  }

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="max-h-[200px] overflow-hidden" aria-hidden="true">
        <div className="blur-[6px] select-none pointer-events-none opacity-60">
          {children}
        </div>
      </div>

      {/* Gradient fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950" />

      {/* CTA overlay */}
      <div className="relative -mt-4 rounded-xl border border-teal-500/20 bg-slate-900/95 backdrop-blur-sm p-6 sm:p-8">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-400 text-xs font-semibold mb-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            PRO
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-400 mb-6">{description}</p>

          {!submitted ? (
            <>
              {/* Email capture — higher conversion path */}
              <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-3 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-500 text-white text-sm font-semibold hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 whitespace-nowrap"
                >
                  {loading ? 'Sending...' : 'Get Free Preview'}
                </button>
              </form>
              <p className="text-xs text-slate-500 mb-6">We'll email you the full benchmark data for this page. No spam, unsubscribe anytime.</p>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-500">or</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Pro — direct conversion path */}
              <Link
                href="/pro"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-teal-500/30 text-teal-400 text-sm font-semibold hover:bg-teal-500/10 transition-all"
              >
                Unlock Everything — $299/mo Pro
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <p className="text-xs text-slate-500 mt-3">7-day money-back guarantee · Cancel anytime</p>
            </>
          ) : (
            <div className="py-4">
              <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Check your inbox</h3>
              <p className="text-sm text-slate-400 mb-4">We're sending the full benchmark data to <span className="text-teal-400">{email}</span></p>
              <Link
                href="/pro"
                className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                Want unlimited access? Start Pro trial
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
