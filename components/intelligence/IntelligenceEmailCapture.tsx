'use client';

import { useState } from 'react';

export function IntelligenceEmailCapture({ context }: { context?: string }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'intelligence_capture', calculation_context: { page: context || 'intelligence' } }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-6 text-center">
        <p className="text-sm font-medium text-teal-400">Subscribed. Watch your inbox for weekly deal intelligence.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8">
      <div className="max-w-lg mx-auto text-center">
        <p className="text-xs font-bold text-teal-400 tracking-[0.12em] uppercase mb-2">Stay Informed</p>
        <h3 className="text-lg font-bold text-white mb-2">Weekly Deal Intelligence Digest</h3>
        <p className="text-sm text-slate-400 mb-5">
          Get benchmark updates, deal structure shifts, and market intelligence delivered to your inbox.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-50"
          >
            {loading ? '...' : 'Subscribe'}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-3">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
  );
}
