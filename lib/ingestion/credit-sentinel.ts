/**
 * Credit sentinel: reads recent ingestion errors and decides whether an AI
 * vendor (Perplexity, Anthropic) has run out of credit. Pure functions so the
 * cron route stays thin and the logic is testable.
 *
 * September 2026 lost roughly ten days of deal inflow to exhausted API
 * credits that nothing reported. This module exists so that never repeats.
 */

export type Vendor = 'perplexity' | 'anthropic';

export interface IngestionErrorRow {
  source: string;
  started_at: string;
  errors: unknown;
}

export interface VendorOutage {
  vendor: Vendor;
  failingRuns: number;
  sources: string[];
  firstSeen: string;
  lastSeen: string;
}

const PATTERNS: Record<Vendor, RegExp> = {
  perplexity: /perplexity[^]{0,200}?(insufficient_quota|exceeded your current quota|401)|(insufficient_quota|exceeded your current quota)[^]{0,120}?perplexity/i,
  anthropic: /credit balance is too low|anthropic[^]{0,200}?(credit balance|insufficient)/i,
};

function errorsToText(errors: unknown): string {
  if (!errors) return '';
  if (typeof errors === 'string') return errors;
  try { return JSON.stringify(errors); } catch { return String(errors); }
}

/** Group recent failing runs by vendor. Rows without a vendor signature are ignored. */
export function classifyCreditErrors(rows: IngestionErrorRow[]): VendorOutage[] {
  const out = new Map<Vendor, VendorOutage>();
  for (const row of rows) {
    const text = errorsToText(row.errors);
    if (!text) continue;
    for (const vendor of Object.keys(PATTERNS) as Vendor[]) {
      if (!PATTERNS[vendor].test(text)) continue;
      const cur = out.get(vendor);
      if (!cur) {
        out.set(vendor, { vendor, failingRuns: 1, sources: [row.source], firstSeen: row.started_at, lastSeen: row.started_at });
      } else {
        cur.failingRuns += 1;
        if (!cur.sources.includes(row.source)) cur.sources.push(row.source);
        if (row.started_at < cur.firstSeen) cur.firstSeen = row.started_at;
        if (row.started_at > cur.lastSeen) cur.lastSeen = row.started_at;
      }
    }
  }
  return [...out.values()].sort((a, b) => a.vendor.localeCompare(b.vendor));
}

export interface AlertState { [vendor: string]: string | undefined }

/** An outage is re-announced at most once per cooldown window. */
export function shouldAlert(state: AlertState, vendor: Vendor, now: Date, cooldownHours = 6): boolean {
  const last = state[vendor];
  if (!last) return true;
  const ms = now.getTime() - new Date(last).getTime();
  return ms >= cooldownHours * 3600_000;
}

const TOPUP: Record<Vendor, string> = {
  perplexity: 'https://www.perplexity.ai/settings/api',
  anthropic: 'https://console.anthropic.com/settings/billing',
};

export function buildCreditAlert(outages: VendorOutage[], context: { lastDealInsert: string | null; pendingVerification: number }): { text: string; blocks: object[] } {
  const names = outages.map(o => o.vendor === 'perplexity' ? 'Perplexity' : 'Anthropic').join(' and ');
  const staleDays = context.lastDealInsert ? Math.floor((Date.now() - new Date(context.lastDealInsert).getTime()) / 86400_000) : null;
  const lines = outages.map(o => `• *${o.vendor === 'perplexity' ? 'Perplexity' : 'Anthropic'}* out of credit since ${o.firstSeen.slice(0, 16).replace('T', ' ')} UTC — ${o.failingRuns} failing runs across ${o.sources.join(', ')}. Top up: ${TOPUP[o.vendor]}`);
  const tail = `Last deal inserted: ${context.lastDealInsert ? context.lastDealInsert.slice(0, 10) : 'never'}${staleDays !== null ? ` (${staleDays} days ago)` : ''} · pending verification: ${context.pendingVerification}`;
  return {
    text: `Solidus ingestion blocked: ${names} credits exhausted`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `Ingestion blocked: ${names} credits exhausted` } },
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: tail }] },
    ],
  };
}
