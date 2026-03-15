import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
}

export interface SelectionChip {
  label: string;
  value: string;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onCalculate: () => void;
  isCalculating: boolean;
  selectionSummary?: SelectionChip[];
  children: React.ReactNode;
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

function WizardStepperInner({
  steps,
  currentStep,
  onStepChange,
  onCalculate,
  isCalculating,
  selectionSummary,
  children,
}: WizardStepperProps) {
  const [direction, setDirection] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleStepChange = useCallback((newStep: number) => {
    if (newStep === currentStep) return;
    setDirection(newStep > currentStep ? 1 : -1);
    onStepChange(newStep);
    // Scroll to top of wizard content when step changes
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }, [currentStep, onStepChange]);

  const slideVariants = prefersReducedMotion
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
      };

  return (
    <div>
      {/* Progress bar */}
      <nav aria-label="Calculator steps" className="flex items-center px-1 py-3 mb-6">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const isClickable = !isCurrent;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => isClickable && handleStepChange(i)}
                disabled={isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative flex flex-col items-center gap-1.5 flex-shrink-0 transition-all duration-200 ${
                  isCurrent ? 'cursor-default' : 'cursor-pointer hover:scale-105'
                }`}
              >
                <div className={`relative w-8 h-8 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300 ${
                  isCompleted
                    ? 'bg-teal-500 text-white'
                    : isCurrent
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/30 dark:shadow-teal-400/20'
                    : 'bg-neutral-200 dark:bg-slate-700 text-neutral-600 dark:text-slate-300'
                }`}>
                  {/* Active step ring indicator */}
                  {isCurrent && (
                    <motion.div
                      layoutId="wizard-active-ring"
                      className="absolute -inset-1 rounded-full border-2 border-teal-400/50"
                      transition={springTransition}
                    />
                  )}
                  {isCompleted ? (
                    <motion.svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      initial={prefersReducedMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={springTransition}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </motion.svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`hidden sm:block text-xs font-medium transition-colors duration-200 ${
                  isCurrent ? 'text-teal-600 dark:text-teal-400' :
                  isCompleted ? 'text-teal-600 dark:text-teal-400' :
                  'text-neutral-500 dark:text-slate-400'
                }`}>
                  {step.label}
                </span>
                <span className={`sm:hidden text-xs font-medium transition-colors duration-200 ${
                  isCurrent ? 'text-teal-600 dark:text-teal-400' :
                  isCompleted ? 'text-teal-600 dark:text-teal-400' :
                  'text-neutral-500 dark:text-slate-400'
                }`}>
                  {step.shortLabel}
                </span>
              </button>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="relative flex-1 h-0.5 mx-2 sm:mx-3 rounded-full bg-neutral-200 dark:bg-slate-700 overflow-hidden">
                  {isCompleted && (
                    <motion.div
                      className="absolute inset-0 bg-teal-500 rounded-full"
                      initial={prefersReducedMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ ...springTransition, delay: 0.1 }}
                      style={{ transformOrigin: 'left' }}
                    />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Selection summary chips — shows what user picked on step 1 */}
      {selectionSummary && selectionSummary.length > 0 && currentStep > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4 px-1">
          {selectionSummary.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-slate-800 text-xs max-w-[200px] sm:max-w-none"
            >
              <span className="text-neutral-400 dark:text-slate-500 flex-shrink-0">{chip.label}</span>
              <span className="font-medium text-neutral-700 dark:text-slate-300 truncate">{chip.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Step content with AnimatePresence spring transition */}
      <div ref={contentRef} className="relative min-h-[200px]">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={prefersReducedMotion ? { duration: 0 } : { ...springTransition, mass: 0.8 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-8">
        {currentStep > 0 && (
          <motion.button
            type="button"
            onClick={() => handleStepChange(currentStep - 1)}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            className="flex-1 py-3 border-2 border-neutral-200 dark:border-slate-700 text-neutral-700 dark:text-slate-300
                       font-medium rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors duration-200"
          >
            Back
          </motion.button>
        )}
        {currentStep < steps.length - 1 ? (
          <motion.button
            type="button"
            onClick={() => handleStepChange(currentStep + 1)}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                       shadow-lg shadow-teal-500/25 dark:shadow-teal-400/15 hover:shadow-xl hover:shadow-teal-500/30 dark:hover:shadow-teal-400/20 transition-colors duration-200
                       hover:from-teal-600 hover:to-cyan-600
                       flex items-center justify-center gap-2"
          >
            <span>Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={onCalculate}
            disabled={isCalculating}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
            whileHover={prefersReducedMotion ? undefined : { y: -2 }}
            className="flex-1 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl
                       shadow-lg shadow-teal-500/25 dark:shadow-teal-400/15 hover:shadow-xl hover:shadow-teal-500/30 dark:hover:shadow-teal-400/20 transition-colors duration-200
                       hover:from-teal-600 hover:to-cyan-600
                       disabled:opacity-70 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2.5 touch-feedback
                       animate-cta-glow"
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
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-white/60 bg-white/10 rounded ml-1">{typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}↵</kbd>
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
}

const WizardStepper = React.memo(WizardStepperInner);
export default WizardStepper;
