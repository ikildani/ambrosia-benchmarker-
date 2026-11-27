// Coarse visitor classification for session_started events, so traffic reports can
// separate people from crawlers, monitors and headless browsers.
const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|scan|python|curl|wget|axios|node-fetch|go-http|java\/|okhttp|phantom|puppeteer|playwright|selenium|vercel|facebookexternalhit|embedly|quora link|whatsapp|telegram/i;

export type UaClass = 'human' | 'bot' | 'unknown';

export function classifyUserAgent(ua: string | null | undefined, webdriver = false): UaClass {
  if (webdriver) return 'bot';
  if (!ua) return 'unknown';
  if (BOT_RE.test(ua)) return 'bot';
  if (!/mozilla\//i.test(ua)) return 'bot';
  return 'human';
}
