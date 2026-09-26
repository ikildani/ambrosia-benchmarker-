'use client';

/**
 * Field data for Core Web Vitals. Sends each metric to GA4 as a `web_vitals`
 * event (visible in GA4 Explore) so regressions like the Sep 2026 hero fade-in
 * (mobile LCP 9.5 s) show up in real traffic, not only in lab runs.
 */
import { useReportWebVitals } from 'next/web-vitals';

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const m = metric as { name: string; id: string; value: number; rating?: string; navigationType?: string };
    window.gtag('event', 'web_vitals', {
      event_category: 'Web Vitals',
      event_label: m.id,
      metric_name: m.name,
      value: Math.round(m.name === 'CLS' ? m.value * 1000 : m.value),
      metric_value: m.value,
      metric_rating: m.rating,
      navigation_type: m.navigationType,
      non_interaction: true,
    });
  });
  return null;
}
