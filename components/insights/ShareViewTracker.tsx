'use client';

import { useEffect } from 'react';

interface ShareViewTrackerProps {
  token: string;
  company?: string;
  modality?: string;
  indication?: string;
  phase?: string;
}

export function ShareViewTracker({ token, company, modality, indication, phase }: ShareViewTrackerProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      fetch('/api/events/share-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          company: company || null,
          modality: modality || null,
          indication: indication || null,
          phase: phase || null,
          referrer: document.referrer || null,
          ua: navigator.userAgent,
        }),
      }).catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [token, company, modality, indication, phase]);

  return null;
}
