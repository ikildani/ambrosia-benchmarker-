'use client';

/**
 * Third-party tags, loaded on our terms (Sep 2026 performance + consent pass).
 *
 * - GA4 loads after the page is interactive (lazyOnload) with Consent Mode
 *   defaulting to "denied", so it sends cookieless pings until the visitor
 *   accepts cookies, then upgrades. It used to be a synchronous <script> in
 *   <head> that the CSP blocked outright, so no GA4 data was ever recorded.
 * - The LinkedIn Insight Tag (ads retargeting) loads only after acceptance, only
 *   on the routes where retargeting matters, and never before first paint. It
 *   cost 570 ms of main-thread time on the mobile home page.
 */
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

export const GA_MEASUREMENT_ID = 'G-33TBPKF000';
export const CONSENT_EVENT = 'cookie-consent-changed';
const RETARGETING_ROUTES = ['/calculator', '/pro', '/start', '/benchmark', '/dashboard'];

export type ConsentValue = 'accepted' | 'declined';

export function readConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem('cookie-consent');
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function ConsentScripts() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = () => {
      const next = readConsent();
      setConsent(next);
      if (typeof window.gtag === 'function') {
        const state = next === 'accepted' ? 'granted' : 'denied';
        window.gtag('consent', 'update', {
          analytics_storage: state,
          ad_storage: state,
          ad_user_data: state,
          ad_personalization: state,
        });
      }
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // Hold the tags until the browser has gone idle after load (or 6 s at most).
  // gtag.js alone is 190 KB and 250 ms of main-thread time on a phone; behind
  // idle it no longer competes with hydration for the interactivity window.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const go = () => { if (!done) { done = true; setReady(true); } };
    const afterLoad = () => {
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback(go, { timeout: 4000 });
      } else {
        setTimeout(go, 2500);
      }
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
    const cap = setTimeout(go, 6000);
    return () => { clearTimeout(cap); window.removeEventListener('load', afterLoad); };
  }, []);

  const granted = consent === 'accepted';
  const state = granted ? 'granted' : 'denied';
  const partnerId = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  const wantsRetargeting = granted && !!partnerId && RETARGETING_ROUTES.some((r) => pathname?.startsWith(r));

  if (!ready) return null;

  return (
    <>
      <Script id="ga4-consent-default" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{analytics_storage:'${state}',ad_storage:'${state}',ad_user_data:'${state}',ad_personalization:'${state}',wait_for_update:500});
gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:true,linker:{domains:['ambrosiaventures.co','solidus.ambrosiaventures.co']}});`}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="lazyOnload" />
      {wantsRetargeting && (
        <Script id="linkedin-insight" strategy="lazyOnload">
          {`_linkedin_partner_id="${partnerId}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);
(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}
var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`}
        </Script>
      )}
    </>
  );
}
