function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as { gtag: (...a: unknown[]) => void }).gtag(...args);
  }
}

export function ga4Event(action: string, params?: Record<string, string | number | undefined>) {
  gtag("event", action, params);
}

export function ga4Calculation(ta: string, engine: string) {
  ga4Event("calculation", { therapeutic_area: ta, engine, event_category: "product" });
}

export function ga4ProUpgrade(source: string) {
  ga4Event("begin_checkout", { event_category: "conversion", source });
}

export function ga4ProConversion(plan: string, value: number) {
  ga4Event("purchase", { event_category: "conversion", plan, value, currency: "USD" });
}

export function ga4ReportPurchase(ta: string) {
  ga4Event("purchase", { event_category: "conversion", item: "deal_intelligence_brief", therapeutic_area: ta, value: 499, currency: "USD" });
}

export function ga4EmailCapture(source: string) {
  ga4Event("generate_lead", { event_category: "conversion", source });
}

export function ga4PaywallHit(feature: string) {
  ga4Event("paywall_hit", { event_category: "engagement", feature });
}

export function ga4ContactSubmit() {
  ga4Event("contact_form_submit", { event_category: "conversion" });
}
