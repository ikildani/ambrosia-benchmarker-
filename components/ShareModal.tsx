'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { CalculationResult } from '@/lib/calculations';
import type { FinancialModelResult } from '@/lib/financial/run-financial-model';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: Record<string, string>;
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
  /** R24: optional — when present, headline rNPV + MC 80% CI + PoS are embedded in the share payload */
  financialModel?: FinancialModelResult;
}

export default function ShareModal({ isOpen, onClose, inputs, results, labels, financialModel }: ShareModalProps) {
  const { user, tier } = useAuth();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('30d');
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);

  const handleShare = async () => {
    if (!user?.email || (tier !== 'pro' && tier !== 'portfolio')) return;

    setLoading(true);
    setError(null);

    try {
      // R24: surface rNPV headline + 80% CI band + PoS on the share page.
      // Deeper breakdowns (histogram, tornado, scenarios, waterfall) stay gated.
      const financialSummary = financialModel
        ? {
            riskAdjustedNPV: financialModel.rnpv.riskAdjustedNPV,
            confidenceInterval80: financialModel.monteCarlo.confidenceInterval80,
            cumulativePoS: financialModel.rnpv.cumulativePoS,
          }
        : undefined;

      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          inputs,
          results,
          labels,
          tier,
          expiresIn,
          financialSummary,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create share link');
        return;
      }

      setShareUrl(data.shareUrl);
    } catch (err) {
      setError('Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        tabIndex={-1}
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-4">
          <div className="flex items-center justify-between">
            <h3 id="share-modal-title" className="text-lg font-bold text-white">Share Analysis</h3>
            <button
              onClick={onClose}
              className="p-2.5 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-lg"
              aria-label="Close share dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!shareUrl ? (
            <>
              <p className="text-neutral-600 mb-4">
                Generate a shareable link to this analysis. Recipients will see the results
                but won&apos;t be able to modify or access your account.
              </p>

              {/* Expiration Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Link expires in
                </label>
                <div className="flex gap-2">
                  {[
                    { value: '7d', label: '7 days' },
                    { value: '30d', label: '30 days' },
                    { value: '90d', label: '90 days' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExpiresIn(option.value)}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        expiresIn === option.value
                          ? 'bg-teal-50 border-teal-500 text-teal-700'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div role="alert" className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleShare}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating link...
                  </span>
                ) : (
                  'Generate Share Link'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-teal-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-bold text-navy-800">Link Created!</h4>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Share URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-600 truncate"
                  />
                  <button
                    onClick={handleCopy}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      copied
                        ? 'bg-teal-500 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShareUrl(null);
                    setExpiresIn('30d');
                  }}
                  className="flex-1 py-2 border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50"
                >
                  Create Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
