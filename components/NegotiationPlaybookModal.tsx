'use client';

import { type JSX, useState, useEffect, useCallback, useRef } from 'react';
import { CalculationResult } from '@/lib/calculations';
import { NegotiationPlaybook, PlaybookSection } from '@/lib/ai/playbook-generator';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

interface NegotiationPlaybookModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
    therapeuticArea?: string;
  };
  results: CalculationResult;
  labels: { phase: string; modality: string; indication: string };
  userId?: string;
  userEmail?: string;
  reportId?: string;
}

// Section icon component
function SectionIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    openingPosition: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    ),
    structureStrategy: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    ),
    royaltyFloor: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    competitiveIntelligence: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    partnerTactics: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
  };

  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[type] || icons.openingPosition}
    </svg>
  );
}

// Loading skeleton for playbook content
function PlaybookSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-4 bg-neutral-50 dark:bg-slate-800 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-neutral-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-5 bg-neutral-200 dark:bg-slate-700 rounded w-40" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-full" />
            <div className="h-4 bg-neutral-200 dark:bg-slate-700 rounded w-3/4" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 bg-neutral-100 dark:bg-slate-600 rounded w-5/6" />
            <div className="h-3 bg-neutral-100 dark:bg-slate-600 rounded w-4/6" />
            <div className="h-3 bg-neutral-100 dark:bg-slate-600 rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Section card component
function PlaybookSectionCard({ section, type }: { section: PlaybookSection; type: string }) {
  return (
    <div className="p-4 sm:p-5 bg-white border border-neutral-200 rounded-xl hover:border-teal-200 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0">
          <SectionIcon type={type} />
        </div>
        <h4 className="font-bold text-navy-800 text-base sm:text-lg">{section.title}</h4>
      </div>

      <p className="text-neutral-600 text-sm mb-4 leading-relaxed">{section.content}</p>

      <ul className="space-y-2 mb-4">
        {section.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
            <svg className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs sm:text-sm text-amber-800 font-medium">{section.highlight}</p>
        </div>
      </div>
    </div>
  );
}

export default function NegotiationPlaybookModal({
  isOpen,
  onClose,
  inputs,
  results,
  labels,
  userId,
  userEmail,
  reportId,
}: NegotiationPlaybookModalProps) {
  const [playbook, setPlaybook] = useState<NegotiationPlaybook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);

  const generatePlaybook = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Create abort controller with 60 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || undefined,
          email: userEmail || undefined,
          reportId: reportId || undefined,
          inputs,
          results: {
            terms: results.terms,
            tieredRoyalties: results.tieredRoyalties,
            dealRecommendation: results.dealRecommendation,
            negotiationInsight: results.negotiationInsight,
            modifiers: results.modifiers,
          },
          labels,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate playbook');
      }

      setPlaybook(data.playbook);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. The AI is taking longer than expected. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to generate playbook. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [inputs, results, labels, userId, userEmail, reportId]);

  // Generate playbook when modal opens
  useEffect(() => {
    if (isOpen && !playbook && !loading) {
      generatePlaybook();
    }
  }, [isOpen, playbook, loading, generatePlaybook]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPlaybook(null);
      setError(null);
      setCopied(false);
    }
  }, [isOpen]);

  // Format playbook as text for copying
  const formatPlaybookAsText = useCallback(() => {
    if (!playbook) return '';

    const sectionOrder = [
      'openingPosition',
      'structureStrategy',
      'royaltyFloor',
      'competitiveIntelligence',
      'partnerTactics',
    ] as const;

    let text = `NEGOTIATION PLAYBOOK\n`;
    text += `Generated for: ${playbook.assetProfile.phase} | ${playbook.assetProfile.modality} | ${playbook.assetProfile.indication}\n`;
    text += `Territory: ${playbook.assetProfile.territory}\n`;
    text += `Generated: ${new Date(playbook.generatedAt).toLocaleDateString()}\n\n`;
    text += '═'.repeat(60) + '\n\n';

    sectionOrder.forEach((key) => {
      const section = playbook.sections[key];
      text += `${section.title.toUpperCase()}\n`;
      text += '─'.repeat(40) + '\n\n';
      text += `${section.content}\n\n`;
      section.bullets.forEach((b) => {
        text += `• ${b}\n`;
      });
      text += `\n⚡ Key Point: ${section.highlight}\n\n`;
      text += '═'.repeat(60) + '\n\n';
    });

    text += 'IMPORTANT CAVEATS\n';
    text += '─'.repeat(40) + '\n';
    playbook.keyCaveats.forEach((c) => {
      text += `• ${c}\n`;
    });
    text += '\n\nGenerated by Ambrosia Deal Calculator';

    return text;
  }, [playbook]);

  const handleCopyAll = async () => {
    const text = formatPlaybookAsText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-modal-title"
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-2 sm:mx-auto my-4 sm:my-8 overflow-hidden animate-fade-in print:shadow-none print:my-0"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-800 to-navy-900 p-3 sm:p-4 lg:p-6 print:bg-navy-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-glow">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 id="playbook-modal-title" className="text-lg sm:text-xl font-bold text-white">
                  Negotiation Playbook
                </h3>
                <p className="text-neutral-300 text-xs sm:text-sm">Data-driven strategic advice</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white transition-colors rounded-lg print:hidden"
              aria-label="Close playbook dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Asset Profile Pills */}
          {playbook && (
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 bg-white/10 text-white text-xs sm:text-sm rounded-full">
                {playbook.assetProfile.phase}
              </span>
              <span className="px-3 py-1 bg-white/10 text-white text-xs sm:text-sm rounded-full">
                {playbook.assetProfile.modality}
              </span>
              <span className="px-3 py-1 bg-white/10 text-white text-xs sm:text-sm rounded-full">
                {playbook.assetProfile.indication}
              </span>
              <span className="px-3 py-1 bg-teal-500/30 text-teal-200 text-xs sm:text-sm rounded-full">
                {playbook.assetProfile.territory}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 print:overflow-visible">
          {loading && <PlaybookSkeleton />}

          {error && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-navy-800 mb-2">Generation Failed</h4>
              <p className="text-neutral-600 text-sm mb-4">{error}</p>
              <button
                onClick={generatePlaybook}
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {playbook && !loading && !error && (
            <div className="space-y-4">
              <PlaybookSectionCard section={playbook.sections.openingPosition} type="openingPosition" />
              <PlaybookSectionCard section={playbook.sections.structureStrategy} type="structureStrategy" />
              <PlaybookSectionCard section={playbook.sections.royaltyFloor} type="royaltyFloor" />
              <PlaybookSectionCard section={playbook.sections.competitiveIntelligence} type="competitiveIntelligence" />
              <PlaybookSectionCard section={playbook.sections.partnerTactics} type="partnerTactics" />

              {/* Caveats */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl mt-6">
                <h5 className="font-semibold text-neutral-700 text-sm mb-2">Important Caveats</h5>
                <ul className="space-y-1">
                  {playbook.keyCaveats.map((caveat, i) => (
                    <li key={i} className="text-xs text-neutral-500 flex items-start gap-2">
                      <span className="text-neutral-400">•</span>
                      <span>{caveat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {playbook && !loading && !error && (
          <div className="p-4 sm:p-6 border-t border-neutral-200 bg-neutral-50 print:hidden">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCopyAll}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${
                  copied
                    ? 'bg-teal-500 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy All
                  </>
                )}
              </button>
              <button
                onClick={handleExportPDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-neutral-200 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-100 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export PDF
              </button>
            </div>
            <p className="text-center text-xs text-neutral-400 mt-4">
              Generated by Ambrosia Intelligence • Tailored to your specific inputs • Not legal or financial advice
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
