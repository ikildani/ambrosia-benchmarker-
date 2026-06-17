'use client';

import { useState, useEffect, type ReactNode } from 'react';

export function ShareEmailGate({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('share_email_captured')) {
        setUnlocked(true);
      }
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    try {
      await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'share_view', page: token }),
      });
    } catch {}
    try { localStorage.setItem('share_email_captured', '1'); } catch {}
    setUnlocked(true);
    setLoading(false);
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative">
      {/* Visible preview: first ~320px of the calculation */}
      <div className="max-h-[320px] overflow-hidden">
        {children}
      </div>

      {/* Gradient fade over the bottom of the preview */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-[#0c1220] pointer-events-none" style={{ bottom: 0, top: 'auto', position: 'relative', marginTop: '-192px' }} />

      {/* Email capture card */}
      <div className="relative -mt-4 rounded-xl border border-teal-500/20 bg-[#0f172a]/95 backdrop-blur-sm p-6 sm:p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-teal-400 text-xs font-semibold mb-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            FREE ACCESS
          </div>

          <h3 className="text-lg font-bold text-white mb-2">
            Enter your email to see the full analysis
          </h3>
          <p className="text-slate-400 text-sm mb-6">
            Milestones, royalties, comparable deals, and the complete deal breakdown — instantly.
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold hover:from-teal-400 hover:to-cyan-400 transition-all disabled:opacity-50"
            >
              {loading ? '...' : 'Unlock'}
            </button>
          </form>

          <p className="text-slate-500 text-xs mt-3">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
