/**
 * View classifier for share-view events.
 *
 * Classifies a single view as one of:
 *   - 'human'      — likely a real person on a residential/corp network
 *   - 'datacenter' — known cloud provider IP (Outlook Safe Links, Slack
 *                    unfurler, Gmail scanner, AWS-hosted bot, etc.)
 *   - 'bot'        — UA matched a known crawler/bot pattern
 *   - 'unknown'    — couldn't determine; treated as datacenter for alert gating
 *                    (fail-closed: when in doubt, suppress alerts to avoid
 *                    polluting the prospect engagement signal with false positives)
 *
 * Used by:
 *   - app/api/events/share-view/route.ts (insert + Slack alert gating)
 *   - app/api/events/share-view-end/route.ts (engagement timing)
 *
 * Built 2026-04-10 after the QNBPUbTI3gfY incident: that one share token got
 * 16 view events but ~14 of them were datacenter rescans (Microsoft Defender,
 * Outlook Safe Links, GCP scanners), making it look like a hot prospect was
 * engaged when in reality only ~2 views were real human interactions.
 */

import { isDatacenterIp } from './datacenter-ips';

export type ViewClassification = 'human' | 'datacenter' | 'bot' | 'unknown';

export interface ClassifyViewInput {
  ip: string;          // Already normalized (may be anonymized prefix like '34.118***')
  ua: string | null;   // User agent
  referrer: string | null;
}

export interface ClassifyViewResult {
  classification: ViewClassification;
  isBot: boolean;
  isDatacenter: boolean;
  /** Whether this view should fire a Slack alert. Only true for confirmed humans. */
  shouldAlertSlack: boolean;
  reason: string;
}

// UA patterns matching known scrapers / crawlers / preview bots.
// Source: actual UAs observed in the events table + standard bot lists.
const BOT_UA_PATTERNS = [
  'bot', 'crawl', 'spider', 'slurp', 'feed', 'prerender', 'headless',
  'phantom', 'puppet', 'selenium', 'playwright', 'monitor', 'scan',
  // Specific link unfurlers
  'slackbot', 'linkedin', 'facebookexternalhit', 'twitterbot', 'discordbot',
  'whatsapp', 'telegram', 'skypeuripreview', 'imessagepreview',
  // Email security scanners
  'safelinks', 'urldefense', 'mimecast', 'proofpoint', 'mxtoolbox',
  'symantec', 'barracuda', 'forcepoint', 'fireeye',
  // Search engine bots
  'googlebot', 'bingbot', 'yandex', 'duckduck', 'baidu', 'applebot',
  // SEO / monitoring
  'semrush', 'ahrefs', 'mj12', 'majestic', 'screaming frog', 'pingdom',
  'uptimerobot', 'gtmetrix', 'lighthouse',
];

const BOT_UA_REGEX = new RegExp(BOT_UA_PATTERNS.join('|'), 'i');

// Referrer patterns that indicate scanner/preview origin (not real prospect navigation).
const SCANNER_REFERRER_PATTERNS = [
  'safelinks.protection.outlook.com',
  'urldefense.proofpoint.com',
  'urldefense.com',
  'protect-eu.mimecast.com',
  'safebrowsing.googleusercontent.com',
];

export function classifyView(input: ClassifyViewInput): ClassifyViewResult {
  const { ip, ua, referrer } = input;

  // ── Bot UA check ──
  if (ua && BOT_UA_REGEX.test(ua)) {
    return {
      classification: 'bot',
      isBot: true,
      isDatacenter: false,
      shouldAlertSlack: false,
      reason: `UA matched bot pattern: ${ua.slice(0, 60)}`,
    };
  }

  // ── Datacenter IP check ──
  if (isDatacenterIp(ip)) {
    return {
      classification: 'datacenter',
      isBot: false,
      isDatacenter: true,
      shouldAlertSlack: false,
      reason: `IP ${ip} matches known datacenter range`,
    };
  }

  // ── Scanner referrer check ──
  if (referrer && SCANNER_REFERRER_PATTERNS.some((p) => referrer.includes(p))) {
    return {
      classification: 'bot',
      isBot: true,
      isDatacenter: false,
      shouldAlertSlack: false,
      reason: `Referrer matches email scanner: ${referrer.slice(0, 60)}`,
    };
  }

  // ── No bot signal — likely human ──
  if (ua && ua.length > 10) {
    return {
      classification: 'human',
      isBot: false,
      isDatacenter: false,
      shouldAlertSlack: true,
      reason: 'No bot signal detected',
    };
  }

  // ── No UA at all is suspicious; treat as unknown ──
  return {
    classification: 'unknown',
    isBot: false,
    isDatacenter: false,
    shouldAlertSlack: false,
    reason: 'No UA provided — fail-closed to suppress alert',
  };
}
