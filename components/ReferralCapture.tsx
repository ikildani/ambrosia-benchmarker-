'use client';

import { useEffect } from 'react';

export default function ReferralCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.length >= 6) {
      localStorage.setItem('referral_code', ref);
      // Clean up the URL
      params.delete('ref');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  return null;
}
