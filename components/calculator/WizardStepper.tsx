import React, { useState, useCallback, useRef } from 'react';

export interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onCalculate: () => void;
  isCalculating: boolean;
  children: React.ReactNode;
}

function WizardStepperInner({
  steps,
  currentStep,
  onStepChange,
  onCalculate,
  isCalculating,
  children,
}: WizardStepperProps) {
  const [transitioning, setTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const contentRef = useRef<HTMLDivElement>(null);

  const handleStepChange = useCallback((newStep: number) => {
    if (newStep === currentStep || transitioning) return;
    setSlideDirection(newStep > currentStep ? 'left' : 'right');
    setTransitioning(true);
    setTimeout(() => {
      onStepChange(newStep);
      setTransitioning(false);
    }, 180);
  }, [currentStep, transitioning, onStepChange]);

  const transitionClass = transitioning
    ? slideDirection === 'left'
      ? 'opacity-0 -translate-x-4'
      : 'opacity-0 translate-x-4'
    : 'opacity-100 translate-x-0 animate-wizard-slide-in';

  return (
    <div>
      {/* Progress bar */}
      <nav aria-label="Calculator steps" className="flex items-center px-1 py-3 mb-6">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isClickable = isCompleted;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => isClickable && handleStepChange(i)}
                disabled={!isClickable && !isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex flex-col items-center gap-1.5 flex-shrink-0 transition-all duration-200 ${
                  isClickable ? 'cursor-pointer hover:scale-105' : isCurrent ? 'cursor-default' : 'cursor-default opacity-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-teal-500 text-white'
                    : isCurrent
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/30'
                    : 'bg-neutral-200 dark:bg-slate-700 text-neutral-500 dark:text-slate-400'
                }`}>
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`hidden sm:block text-xs font-medium transition-colors duration-200 ${
                  isCurrent ? 'text-teal-600 dark:text-teal-400' :
                  isCompleted ? 'text-teal-600 dark:text-teal-400' :
                  'text-neutral-400 dark:text-slate-500'
                }`}>
                  {step.label}
                </span>
                <span className={`sm:hidden text-[10px] font-medium transition-colors duration-200 ${
                  isCurrent ? 'text-teal-600 dark:text-teal-400' :
                  isCompleted ? 'text-teal-600 dark:text-teal-400' :
                  'text-neutral-400 dark:text-slate-500'
                }`}>
                  {step.shortLabel}
                </span>
              </button>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors duration-300 ${
                  isCompleted ? 'bg-teal-500' : 'bg-neutral-200 dark:bg-slate-700'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Step content with slide transition — only clip overflow during animation to avoid hiding dropdowns/tooltips */}
      <div className={transitioning ? 'overflow-hidden' : ''}>
        <div
          ref={contentRef}
          className={`motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out ${transitionClass}`}
        >
          {children}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8">
        {currentStep > 0 && (
          <button
            type="button"
            onClick={() => handleStepChange(currentStep - 1)}
            className="flex-1 py-3 border-2 border-neutral-200 dark:border-slate-700 text-neutral-700 dark:text-slate-300
                       font-medium rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-800 transition-all duration-200
                       motion-safe:active:scale-[0.98]"
          >
            Back
          </button>
        )}
        {currentStep < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => handleStepChange(currentStep + 1)}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                       shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all duration-200
                       hover:from-teal-600 hover:to-cyan-600 motion-safe:hover:-translate-y-0.5
                       motion-safe:active:scale-[0.98]
                       flex items-center justify-center gap-2"
          >
            <span>Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCalculate}
            disabled={isCalculating}
            className="flex-1 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                       shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all duration-200
                       hover:from-teal-600 hover:to-cyan-600 motion-safe:hover:-translate-y-0.5
                       disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
                       flex items-center justify-center gap-2.5 touch-feedback btn-press
                       motion-safe:active:scale-[0.97] active:shadow-md"
          >
            {isCalculating ? (
              <>
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 rounded-full border-2 border-white/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
                <span>Analyzing Market Data...</span>
              </>
            ) : (
              <>
                <span>Calculate Deal Terms</span>
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

const WizardStepper = React.memo(WizardStepperInner);
export default WizardStepper;
