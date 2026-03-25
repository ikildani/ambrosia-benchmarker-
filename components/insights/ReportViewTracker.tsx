'use client';

import { useEffect } from 'react';

interface ReportViewTrackerProps {
  report: string;
}

export function ReportViewTracker({ report }: ReportViewTrackerProps) {
  useEffect(() => {
    // Small delay to avoid tracking bot prefetches
    const timer = setTimeout(() => {
      fetch('/api/events/report-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report,
          referrer: document.referrer || null,
          ua: navigator.userAgent,
        }),
      }).catch(() => {
        // Silent fail — tracking should never break the page
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [report]);

  return null;
}
