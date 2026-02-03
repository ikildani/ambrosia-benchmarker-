'use client';

import { useState, useCallback } from 'react';
import { X, Mail, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import type { OutreachEmail, ApproachStrategy, EmailTone } from '@/types/partner-breakdown';

interface OutreachEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  matchScore: number;
  matchContext: any;
  userAsset: {
    modality: string;
    phase: string;
    indication_category: string | null;
    indication_specific: string | null;
    territory: string | null;
  };
  userId?: string;
  userEmail?: string;
  sessionId?: string;
}

export function OutreachEmailModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  matchScore,
  matchContext,
  userAsset,
  userId,
  userEmail,
  sessionId,
}: OutreachEmailModalProps) {
  const [tone, setTone] = useState<EmailTone>('formal');
  const [recipientRole, setRecipientRole] = useState('');
  const [email, setEmail] = useState<OutreachEmail | null>(null);
  const [strategy, setStrategy] = useState<ApproachStrategy | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<{ emails_generated_today: number; daily_limit: number } | null>(null);

  const generateEmail = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/partners/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          company_name: companyName,
          match_context: matchContext,
          user_asset: userAsset,
          tone,
          recipient_role: recipientRole || undefined,
          user_id: userId,
          user_email: userEmail,
          session_id: sessionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.rate_limited) {
          setError(`Daily limit reached (${data.usage.emails_generated_today}/${data.usage.daily_limit}). Resets at midnight.`);
        } else if (data.upgrade_required) {
          setError('Outreach email generation is a Pro feature. Please upgrade to access.');
        } else {
          setError(data.error || 'Failed to generate email');
        }
        return;
      }

      setEmail(data.email);
      setStrategy(data.approach_strategy);
      setUsage(data.usage);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [companyId, companyName, matchContext, userAsset, tone, recipientRole, userId, userEmail, sessionId]);

  const copyToClipboard = useCallback(async () => {
    if (!email) return;

    const fullEmail = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [email]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Draft Outreach Email
                </h2>
                <p className="text-sm text-teal-100">
                  {companyName} · {matchScore}% match
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {!email ? (
            // Configuration Form
            <div className="space-y-4">
              {/* Tone Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Tone
                </label>
                <div className="flex gap-3">
                  {(['formal', 'conversational'] as EmailTone[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                        tone === t
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Role (optional)
                </label>
                <input
                  type="text"
                  value={recipientRole}
                  onChange={(e) => setRecipientRole(e.target.value)}
                  placeholder="e.g., VP of Business Development"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={generateEmail}
                disabled={isGenerating}
                className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Generate Email
                  </>
                )}
              </button>

              {usage && (
                <p className="text-xs text-center text-gray-500">
                  {usage.daily_limit - usage.emails_generated_today} emails remaining today
                </p>
              )}
            </div>
          ) : (
            // Email Display
            <div className="space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Subject
                </label>
                <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-900">
                  {email.subject}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Body
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {email.body}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 py-2.5 bg-teal-500 text-white font-medium rounded-lg hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEmail(null);
                    setStrategy(null);
                  }}
                  className="px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>

              {usage && (
                <p className="text-xs text-center text-gray-500 pt-2">
                  {usage.daily_limit - usage.emails_generated_today} emails remaining today
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OutreachEmailModal;
