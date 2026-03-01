'use client';

import { useState, useEffect, useCallback } from 'react';

interface PromoDiscount {
  percentOff: number | null;
  amountOff: number | null;
  duration: string | null;
  name: string | null;
}

interface UsePromoCodeReturn {
  promoCode: string;
  setPromoCode: (code: string) => void;
  promoStatus: 'idle' | 'validating' | 'valid' | 'invalid';
  promoDiscount: PromoDiscount | null;
  promoId: string | null;
  promoError: string | null;
  validatePromoCode: (code: string) => Promise<void>;
  clearPromo: () => void;
}

export function usePromoCode(initialCode?: string): UsePromoCodeReturn {
  const [promoCode, setPromoCodeRaw] = useState(initialCode?.toUpperCase() || '');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState<PromoDiscount | null>(null);
  const [promoId, setPromoId] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const validatePromoCode = useCallback(async (code: string) => {
    if (!code.trim()) {
      setPromoStatus('idle');
      setPromoDiscount(null);
      setPromoId(null);
      setPromoError(null);
      return;
    }

    setPromoStatus('validating');
    setPromoError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.valid) {
        setPromoStatus('valid');
        setPromoDiscount(data.discount);
        setPromoId(data.promoId);
        setPromoError(null);
      } else {
        setPromoStatus('invalid');
        setPromoDiscount(null);
        setPromoId(null);
        setPromoError(data.error || 'Invalid promo code');
      }
    } catch {
      clearTimeout(timeoutId);
      setPromoStatus('invalid');
      setPromoError('Unable to validate code. Try again.');
    }
  }, []);

  const clearPromo = useCallback(() => {
    setPromoCodeRaw('');
    setPromoStatus('idle');
    setPromoDiscount(null);
    setPromoId(null);
    setPromoError(null);
  }, []);

  const setPromoCode = useCallback((code: string) => {
    setPromoCodeRaw(code.toUpperCase());
  }, []);

  // Auto-validate initial code on mount
  useEffect(() => {
    if (initialCode) {
      validatePromoCode(initialCode);
    }
  }, [initialCode, validatePromoCode]);

  return {
    promoCode,
    setPromoCode,
    promoStatus,
    promoDiscount,
    promoId,
    promoError,
    validatePromoCode,
    clearPromo,
  };
}
