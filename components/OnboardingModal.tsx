'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DEAL_STATS } from '@/lib/config/constants';
import { Target, Check, ChevronRight, ChevronLeft } from 'lucide-react';

export type OnboardingStep = 'welcome' | 'big-three' | 'modifiers' | 'ready';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onStepChange?: (step: OnboardingStep | null) => void;
}

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i + 1 === currentStep
              ? 'w-8 bg-gradient-to-r from-teal-500 to-cyan-500 animate-progress-dot'
              : i + 1 < currentStep
              ? 'w-2 bg-teal-500'
              : 'w-2 bg-neutral-200'
          }`}
        />
      ))}
      <span className="ml-2 text-xs text-neutral-500">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  onStepChange,
}: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Reset to welcome when modal opens and manage focus
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('welcome');
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the modal after a brief delay for animation
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Notify parent of step changes for spotlight highlighting
  useEffect(() => {
    if (onStepChange) {
      onStepChange(isOpen ? currentStep : null);
    }
  }, [currentStep, isOpen, onStepChange]);

  // Handle keyboard navigation (Escape and Tab for focus trap)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const goToStep = useCallback((step: OnboardingStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(step);
      setIsAnimating(false);
    }, 150);
  }, []);

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className={`text-center ${isAnimating ? 'opacity-0' : 'animate-onboarding-step'}`}>
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Target className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-navy-800 mb-3">
              Get deal terms in 60 seconds
            </h2>
            <p className="text-neutral-600 mb-6">
              Based on {DEAL_STATS.TOTAL_DEALS} real biopharma licensing deals across oncology and neurology, our calculator estimates:
            </p>

            <div className="text-left space-y-3 mb-8 max-w-sm mx-auto">
              {[
                'Upfront payment ranges',
                'Milestone structures',
                'Royalty rates',
                'Best-fit partners',
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-teal-600" />
                  </div>
                  <span className="text-neutral-700">{item}</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-neutral-500 mb-8">
              Used by BD teams at 50+ biotech companies
            </p>

            <div className="space-y-3">
              <button
                onClick={() => goToStep('big-three')}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                         shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all duration-200 hover:-translate-y-0.5
                         flex items-center justify-center gap-2"
              >
                Show me how it works
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="text-neutral-500 hover:text-neutral-700 text-sm font-medium transition-colors py-2"
              >
                Skip tutorial
              </button>
            </div>
          </div>
        );

      case 'big-three':
        return (
          <div className={isAnimating ? 'opacity-0' : 'animate-onboarding-step'}>
            <ProgressIndicator currentStep={1} totalSteps={3} />

            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-sm font-medium mb-4">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                The Big Three
              </div>

              <h3 className="text-xl font-bold text-navy-800 mb-3">
                These 3 inputs drive 70% of deal value
              </h3>
              <p className="text-neutral-600 mb-6">
                <strong>Phase</strong>, <strong>Modality</strong>, and <strong>Indication</strong> are
                the primary factors that determine baseline deal economics.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="font-semibold text-navy-800">Phase</p>
                    <p className="text-sm text-neutral-600">Later phase = higher value. Phase 2 deals average $120M upfront.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="font-semibold text-navy-800">Modality</p>
                    <p className="text-sm text-neutral-600">ADCs and bispecifics command 40%+ premium over small molecules.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <p className="font-semibold text-navy-800">Indication</p>
                    <p className="text-sm text-neutral-600">High unmet need indications drive significantly higher valuations.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => goToStep('welcome')}
                className="flex-1 py-3 border border-neutral-200 text-neutral-700 font-medium rounded-xl hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => goToStep('modifiers')}
                className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'modifiers':
        return (
          <div className={isAnimating ? 'opacity-0' : 'animate-onboarding-step'}>
            <ProgressIndicator currentStep={2} totalSteps={3} />

            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-700 rounded-full text-sm font-medium mb-4">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Value Modifiers
              </div>

              <h3 className="text-xl font-bold text-navy-800 mb-3">
                These inputs adjust your baseline up or down
              </h3>
              <p className="text-neutral-600 mb-6">
                Fine-tune your estimate with competitive position and regulatory status.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                <div className="mb-4">
                  <p className="font-semibold text-navy-800 mb-2">Competitive Position</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">First-in-class</span>
                      <span className="text-teal-600 font-medium">+20% premium</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Best-in-class</span>
                      <span className="text-teal-600 font-medium">+10% premium</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Crowded market</span>
                      <span className="text-red-500 font-medium">-30% discount</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <p className="font-semibold text-navy-800 mb-2">Regulatory Designations</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Breakthrough Therapy</span>
                      <span className="text-teal-600 font-medium">+5% bonus</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Orphan Drug</span>
                      <span className="text-teal-600 font-medium">+5% bonus</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => goToStep('big-three')}
                className="flex-1 py-3 border border-neutral-200 text-neutral-700 font-medium rounded-xl hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => goToStep('ready')}
                className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all flex items-center justify-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className={`text-center ${isAnimating ? 'opacity-0' : 'animate-onboarding-step'}`}>
            <ProgressIndicator currentStep={3} totalSteps={3} />

            <div className="mt-6">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
                <Check className="w-10 h-10 text-white" />
              </div>

              <h3 className="text-xl font-bold text-navy-800 mb-3">
                You&apos;re ready to calculate
              </h3>
              <p className="text-neutral-600 mb-6">
                Fill in your asset details and get instant deal benchmarks.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left">
                <p className="font-semibold text-navy-800 mb-3">Quick tips:</p>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5">&#8226;</span>
                    Hover any label for definitions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5">&#8226;</span>
                    Results update when you click Calculate
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-500 mt-0.5">&#8226;</span>
                    Pro users get full milestone breakdowns and partner matches
                  </li>
                </ul>
              </div>

              <button
                onClick={onComplete}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                         shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all duration-200 hover:-translate-y-0.5
                         flex items-center justify-center gap-2"
              >
                Start calculating
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Get the current title for screen readers
  const getStepTitle = () => {
    switch (currentStep) {
      case 'welcome': return 'Get deal terms in 60 seconds';
      case 'big-three': return 'These 3 inputs drive 70% of deal value';
      case 'modifiers': return 'These inputs adjust your baseline up or down';
      case 'ready': return "You're ready to calculate";
      default: return 'Onboarding';
    }
  };

  // Check if we're on a spotlight step (where we want to show the form highlighting)
  const isSpotlightStep = currentStep === 'big-three' || currentStep === 'modifiers';

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center p-0 sm:p-4 ${
      isSpotlightStep ? 'lg:justify-end' : 'justify-center'
    }`}>
      {/* Backdrop - transparent when spotlight is active so users can see highlighted fields */}
      <div
        className={`absolute inset-0 animate-fade-in transition-colors duration-300 ${
          isSpotlightStep
            ? 'bg-transparent'
            : 'bg-navy-900/60 backdrop-blur-sm'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - positioned to the right on desktop during spotlight steps */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        tabIndex={-1}
        className={`relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up outline-none ${
          isSpotlightStep ? 'lg:mr-8' : ''
        }`}
      >
        {/* Screen reader only title that updates with each step */}
        <h1 id="onboarding-title" className="sr-only">{getStepTitle()}</h1>
        <p id="onboarding-description" className="sr-only">
          Interactive tutorial to help you use the deal calculator. Step {
            currentStep === 'welcome' ? '0' :
            currentStep === 'big-three' ? '1' :
            currentStep === 'modifiers' ? '2' : '3'
          } of 3.
        </p>

        {/* Live region for step announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {currentStep !== 'welcome' && `Now on step ${
            currentStep === 'big-three' ? '1' :
            currentStep === 'modifiers' ? '2' : '3'
          } of 3: ${getStepTitle()}`}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors z-10"
          aria-label="Close tutorial"
        >
          <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content with safe area padding for iOS */}
        <div className="p-6 sm:p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:pb-8">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
