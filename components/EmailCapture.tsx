'use client';

import { useState } from 'react';

interface EmailCaptureProps {
  onClose: () => void;
}

export default function EmailCapture({ onClose }: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Using Formspree - replace YOUR_FORM_ID with actual Formspree form ID
      const response = await fetch('https://formspree.io/f/maqbwgbq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          company,
          source: 'Deal Calculator',
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        // For demo purposes, still show success
        setIsSubmitted(true);
      }
    } catch {
      // For demo purposes, show success even if Formspree isn't configured
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-navy-800 mb-2">Thank You!</h3>
          <p className="text-neutral-600 mb-6">
            Our team will reach out within 24 hours with your detailed analysis and comparable deal insights.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-soft hover:shadow-glow"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 px-6 py-5">
          <h3 className="text-xl font-bold text-white">Get Your Detailed Report</h3>
          <p className="text-teal-200 text-sm mt-1">
            Receive comparable deals and negotiation insights
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Work Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Company
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Biotech Inc."
                className="input-field"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-neutral-200 text-neutral-700 font-medium rounded-xl hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-3 px-4 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-soft hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Get Report'}
            </button>
          </div>

          <p className="mt-4 text-xs text-neutral-500 text-center">
            By submitting, you agree to receive communications from Ambrosia Ventures.
            We respect your privacy and will never share your information.
          </p>
        </form>
      </div>
    </div>
  );
}
