'use client';

import { useState } from 'react';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus('success');
        setMessage('Thanks for subscribing! Check your inbox.');
        setEmail('');
      } else {
        throw new Error('Subscription failed');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 my-12">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-teal-500/20 rounded-xl">
          <Mail className="w-6 h-6 text-teal-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white">
            Get Biotech Deal Insights
          </h3>
          <p className="mt-2 text-slate-300 text-sm">
            Weekly analysis of licensing trends, valuation benchmarks, and market intelligence.
          </p>

          {status === 'success' ? (
            <div className="mt-4 flex items-center gap-2 text-teal-400">
              <CheckCircle className="w-5 h-5" />
              <span>{message}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {status === 'loading' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Subscribe'
                )}
              </button>
            </form>
          )}

          {status === 'error' && (
            <p className="mt-2 text-red-400 text-sm">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
