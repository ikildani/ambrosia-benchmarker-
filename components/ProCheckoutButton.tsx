'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { useProCheckout, useTrialEligibility } from '@/lib/hooks/useProCheckout';

interface ProCheckoutButtonProps {
  billingInterval?: 'monthly' | 'annual';
  className?: string;
  children?: React.ReactNode;
  /** Offer the 7-day card trial. Falls back to "Start Pro" for anyone who has used theirs. */
  trial?: boolean;
  /** Where the button sits, for attribution. */
  source?: string;
}

export default function ProCheckoutButton({
  billingInterval = 'monthly',
  className = '',
  children,
  trial = false,
  source = 'pro_page',
}: ProCheckoutButtonProps) {
  const { start, isLoading, error } = useProCheckout();
  const { eligible } = useTrialEligibility();
  const offerTrial = trial && eligible;

  // A trial CTA whose trial is already used must not promise one.
  const label = trial && !eligible
    ? <>Continue with Pro <ArrowRight className="w-4 h-4" /></>
    : children || <>Start Pro <ArrowRight className="w-4 h-4" /></>;

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button
        onClick={() => start({ trial: offerTrial, billingInterval, source })}
        disabled={isLoading}
        aria-busy={isLoading}
        className={`inline-flex items-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-60 ${className}`}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
      </button>

      {offerTrial && (
        <p className="text-xs text-slate-400">$0 today · Reminder before you&apos;re charged · Cancel anytime</p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-400 max-w-xs text-center">{error}</p>
      )}
    </div>
  );
}
