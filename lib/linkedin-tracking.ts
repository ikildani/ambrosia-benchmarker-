/**
 * LinkedIn Insight Tag conversion tracking.
 *
 * Fires conversion events for retargeting audiences:
 * - calculation_run: user ran a calculation (high intent)
 * - paywall_hit: user saw the upgrade/report paywall (very high intent)
 * - checkout_started: user clicked to buy report/pro (purchase intent)
 *
 * These create LinkedIn audiences you can retarget with ads.
 * Requires NEXT_PUBLIC_LINKEDIN_PARTNER_ID env var to be set.
 */

declare global {
  interface Window {
    lintrk?: (action: string, data: { conversion_id: number }) => void;
  }
}

// LinkedIn conversion IDs — set these in LinkedIn Campaign Manager
// Go to: Campaign Manager → Analyze → Conversion Tracking → Create
const CONVERSION_IDS = {
  calculation_run: Number(process.env.NEXT_PUBLIC_LI_CONV_CALCULATION) || 0,
  paywall_hit: Number(process.env.NEXT_PUBLIC_LI_CONV_PAYWALL) || 0,
  checkout_started: Number(process.env.NEXT_PUBLIC_LI_CONV_CHECKOUT) || 0,
  report_purchased: Number(process.env.NEXT_PUBLIC_LI_CONV_PURCHASE) || 0,
};

export function trackLinkedInConversion(event: keyof typeof CONVERSION_IDS): void {
  if (typeof window === 'undefined') return;
  if (!window.lintrk) return;

  const conversionId = CONVERSION_IDS[event];
  if (!conversionId) return;

  try {
    window.lintrk('track', { conversion_id: conversionId });
  } catch {
    // Silent fail — tracking should never break the app
  }
}
