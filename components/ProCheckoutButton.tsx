'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, Tag } from 'lucide-react';
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
  const pendingCheckoutRef = useRef(false);

  // Auto-trigger checkout after user signs up via the auth modal
  useEffect(() => {
    if (isAuthenticated && pendingCheckoutRef.current) {
      pendingCheckoutRef.current = false;
      handleCheckout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      pendingCheckoutRef.current = true;
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

      {/* Promo code — visible with icon */}
      {!showPromo ? (
        <button
          onClick={() => setShowPromo(true)}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors border border-slate-700 hover:border-teal-500/30 rounded-lg px-3 py-1.5 bg-white/[0.02]"
        >
          <Tag className="w-3 h-3" />
          Have a promo code?
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter promo code"
              autoFocus
              className="pl-7 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 w-44 focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
          {promoCode && (
            <span className="text-xs text-teal-400 font-medium">✓ Applied</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 max-w-xs text-center">{error}</p>
      )}
    </div>
  );
}
