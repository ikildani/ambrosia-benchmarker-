/**
 * Competitor content monitoring via RSS feeds.
 * Fetches recent articles from biopharma news sources and deduplicates
 * against previously ingested entries.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorEntry {
  source: string;
  url: string;
  title: string;
  description: string;
  publishedAt: string | null;
}

// ── RSS feed sources ─────────────────────────────────────────────────────────

const COMPETITOR_FEEDS: { name: string; url: string }[] = [
  { name: 'Endpoints News', url: 'https://endpts.com/feed/' },
  { name: 'Fierce Pharma', url: 'https://www.fiercepharma.com/rss/xml' },
  { name: 'BioPharma Dive', url: 'https://www.biopharmadive.com/feeds/news/' },
  { name: 'STAT News', url: 'https://www.statnews.com/feed/' },
];

// ── RSS parsing helpers ──────────────────────────────────────────────────────

function extractItems(xml: string): { title: string; link: string; description: string; pubDate: string }[] {
  const items: { title: string; link: string; description: string; pubDate: string }[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
    const descMatch = block.match(/<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i);
    const pubDateMatch = block.match(/<pubDate(?:\s[^>]*)?>([\s\S]*?)<\/pubDate>/i);

    const title = stripCdata(titleMatch?.[1] || '').trim();
    const link = stripCdata(linkMatch?.[1] || '').trim();

    if (!title || !link) continue;

    items.push({
      title,
      link,
      description: stripCdata(descMatch?.[1] || '')
        .replace(/<[^>]+>/g, '')
        .trim()
        .slice(0, 500),
      pubDate: pubDateMatch?.[1]?.trim() || '',
    });
  }

  return items;
}

function stripCdata(str: string): string {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function isWithin48Hours(dateStr: string): boolean {
  if (!dateStr) return true; // Include items without a date
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return true;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    return date.getTime() > cutoff;
  } catch {
    return true;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch recent content from competitor RSS feeds.
 * Returns entries from the last 48 hours. Handles fetch failures gracefully.
 */
export async function fetchCompetitorContent(): Promise<CompetitorEntry[]> {
  const allEntries: CompetitorEntry[] = [];

  for (const feed of COMPETITOR_FEEDS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(feed.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AmbrosiaBot/1.0 (+https://calculator.ambrosiaventures.co)',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[competitor-monitor] ${feed.name}: HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const items = extractItems(xml);

      for (const item of items) {
        if (!isWithin48Hours(item.pubDate)) continue;

        allEntries.push({
          source: feed.name,
          url: item.link,
          title: item.title,
          description: item.description,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        });
      }

      console.log(`[competitor-monitor] ${feed.name}: ${items.length} items fetched`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[competitor-monitor] ${feed.name}: fetch failed — ${msg}`);
    }
  }

  return allEntries;
}

/**
 * Filter out entries already stored in the competitor_content table.
 */
export async function filterNewEntries(
  supabase: SupabaseClient,
  entries: CompetitorEntry[]
): Promise<CompetitorEntry[]> {
  if (entries.length === 0) return [];

  const urls = entries.map((e) => e.url);

  const { data: existing } = await supabase
    .from('competitor_content')
    .select('url')
    .in('url', urls);

  const existingUrls = new Set((existing || []).map((r) => r.url));

  return entries.filter((e) => !existingUrls.has(e.url));
}
