'use client';

import { useState } from 'react';

interface InlineEmailCaptureProps {
  heading?: string;
  description?: string;
  source?: string;
}

export function InlineEmailCapture({
  heading = 'Get Weekly Deal Intelligence',
  description = 'Join 2,000+ BD professionals who receive our weekly analysis of biopharma licensing trends, new deal benchmarks, and negotiation insights.',
  source = 'insight-page',
}: InlineEmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch('https://formspree.io/f/maqbwgbq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, timestamp: new Date().toISOString() }),
      });
    } catch {
      // Still show success
    }
    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  if (isSubmitted) {
    return (
      <div className="my-10 bg-teal-50 border border-teal-200 rounded-xl p-6 text-center">
        <svg className="w-8 h-8 text-teal-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm font-semibold text-teal-900">You&apos;re in. Check your inbox for this week&apos;s deal intelligence.</p>
      </div>
    );
  }

  return (
    <div className="my-10 bg-slate-50 border border-slate-200 rounded-xl p-6">
      <div className="sm:flex items-start gap-6">
        <div className="flex-1 mb-4 sm:mb-0">
          <h3 className="text-lg font-bold text-slate-900 mb-1">{heading}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2 sm:w-auto w-full flex-shrink-0">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 sm:w-56 px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {isSubmitting ? '...' : 'Subscribe'}
          </button>
        </form>
      </div>
      <p className="text-xs text-slate-400 mt-3">Free weekly digest. No spam. Unsubscribe anytime.</p>
    </div>
  );
}
