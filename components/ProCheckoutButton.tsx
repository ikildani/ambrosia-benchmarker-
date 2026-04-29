'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { captureClientError } from '@/lib/sentry-client';

interface ProCheckoutButtonProps {
  billingInterval?: 'monthly' | 'annual';
  className?: string;
  children?: React.ReactNode;
}

export default function ProCheckoutButton({
  billingInterval = 'monthly',
  className = '',
  children,
}: ProCheckoutButtonProps) {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      openAuthModal('signup');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user?.email,
          userId: user?.id,
          billingInterval,
          promoCode: promoCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.demo || data.message) {
        setError(data.message || 'Checkout is temporarily unavailable. Please contact support@ambrosiaventures.co.');
        return;
      }

      setError('Something went wrong. Please try again or contact support@ambrosiaventures.co.');
    } catch (err) {
      captureClientError(err, 'ProCheckoutButton', { context: 'Checkout failed' });
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-60 ${className}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          children || <>Start Pro <ArrowRight className="w-4 h-4" /></>
        )}
      </button>

      {!showPromo ? (
        <button
          onClick={() => setShowPromo(true)}
          className="text-[11px] text-slate-600 hover:text-teal-400 transition-colors"
        >
          Have a promo code?
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-slate-600 w-32 focus:outline-none focus:border-teal-500/30"
          />
          {promoCode && (
            <span className="text-[10px] text-teal-400">Applied</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
