'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import type { UserTier } from '@/types/tier';

const Pricing = dynamic(() => import('@/components/Pricing'), { ssr: false });

/** Pricing needs the session (tier, email) and the ?code= promo handoff from email campaigns. */
export default function PricingIsland() {
  const { tier, user, setTier } = useAuth();
  const [urlPromoCode, setUrlPromoCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setUrlPromoCode(codeParam.toUpperCase());
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, []);

  return (
    <Pricing
      currentTier={tier}
      onSelectTier={(newTier: UserTier) => setTier(newTier)}
      userEmail={user?.email}
      userId={user?.id}
      initialPromoCode={urlPromoCode}
    />
  );
}
