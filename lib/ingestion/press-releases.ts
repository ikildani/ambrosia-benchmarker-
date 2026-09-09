// Multi-Source Deal Intelligence Pipeline
// Ingests deal announcements from press release wires and biotech news RSS feeds
// Uses Claude AI to extract structured deal data (same pattern as SEC EDGAR)

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedDeal } from './sec-edgar';
import { fetchWithTimeout } from '../fetch-with-timeout';
import { validateExtractedDeal, extractAuditExcerpt, normalizeRoyaltyPct } from './deal-extraction-validator';
import { readSyncCursor, writeSyncCursor } from '../radar/sync-cursor';

// === RSS Feed Sources ===
// Each source provides deal announcements that we filter and extract from.
//
// Every fetched item is ALSO persisted to `press_releases` (migration 109) so
// the licensing-intent detectors in lib/radar/signal-detection.ts have data.
//
// Backfill support, probed 2026-09-08 by requesting pages 1-3 of each feed:
//   wordpress  `?paged=N` returns older pages — Endpoints_News, Labiotech_EU, STAT_News.
//   (none)     GlobeNewswire (all subject feeds), PR_Newswire_*, Business_Wire,
//              BioSpace_Deals, BioPharma_Dive_Deals, FierceBiotech, FiercePharma,
//              BioWorld_Deals, Reuters_Healthcare return the same page for any
//              ?page= value. GlobeNewswire's search archive
//              (/search/subject/25-Licensing%20Agreements?page=N) is a
//              client-rendered React app with no server-side item HTML, so a
//              24-month GlobeNewswire backfill needs the headless-browser runner
//              planned for the ex-US registries (gap register Phase 2 item 5).

/** Wire family stored in press_releases.source (CHECK constraint, migration 109). */
export type PressSourceFamily = 'globenewswire' | 'businesswire' | 'prnewswire' | 'company' | 'news' | 'other';

interface FeedSource {
  name: string;
  url: string;
  type: 'rss' | 'atom';
  dealKeywords: string[]; // Must contain at least one to be considered a potential deal
  family: PressSourceFamily;
  /** How older items can be fetched; undefined = feed does not page. */
  paging?: 'wordpress';
}

const FEED_SOURCES: FeedSource[] = [
  // === Tier 1: Dedicated Deals Feeds (highest signal, every item is a deal) ===
  {
    name: 'BioSpace_Deals',
    family: 'news',
    url: 'https://www.biospace.com/deals.rss',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'billion', 'million'],
  },
  {
    name: 'BioPharma_Dive_Deals',
    family: 'news',
    url: 'https://www.biopharmadive.com/feeds/topic/deals/',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'billion', 'million'],
  },

  // === Tier 2: Deal-Type Wire Feeds (high volume, filtered by deal category) ===
  {
    name: 'GlobeNewswire_Licensing',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/feedTitle/GlobeNewswire%20-%20Licensing%20Agreements',
    type: 'rss',
    dealKeywords: ['pharma', 'biotech', 'therapeutic', 'clinical', 'drug', 'oncology', 'antibody', 'gene therapy', 'license', 'collaboration', 'fda', 'pipeline', 'biologic'],
  },
  {
    name: 'GlobeNewswire_MA',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/27-Mergers%20And%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20And%20Acquisitions',
    type: 'rss',
    dealKeywords: ['pharma', 'biotech', 'therapeutic', 'clinical', 'drug', 'oncology', 'antibody', 'gene therapy', 'pipeline', 'biologic', 'pharmaceutical'],
  },
  {
    name: 'GlobeNewswire_Partnerships',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/29-Partnerships/feedTitle/GlobeNewswire%20-%20Partnerships',
    type: 'rss',
    dealKeywords: ['pharma', 'biotech', 'therapeutic', 'clinical', 'drug', 'oncology', 'antibody', 'gene therapy', 'license', 'collaboration', 'fda', 'pipeline', 'biologic'],
  },
  {
    name: 'PR_Newswire_Biotech',
    family: 'prnewswire',
    url: 'https://www.prnewswire.com/rss/health-latest-news/biotechnology-list.rss',
    type: 'rss',
    dealKeywords: ['license agreement', 'collaboration agreement', 'exclusive license', 'acquisition', 'deal', 'partnership', 'co-develop', 'option agreement', 'milestone', 'royalt'],
  },
  {
    name: 'PR_Newswire_Pharma',
    family: 'prnewswire',
    url: 'https://www.prnewswire.com/rss/health-latest-news/pharmaceuticals-list.rss',
    type: 'rss',
    dealKeywords: ['license agreement', 'collaboration agreement', 'exclusive license', 'acquisition', 'deal', 'partnership', 'co-develop', 'option agreement', 'milestone', 'royalt'],
  },

  // === Tier 3: Industry News Feeds (need keyword filtering for deals) ===
  {
    name: 'FierceBiotech',
    family: 'news',
    url: 'https://www.fiercebiotech.com/rss/xml',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'co-develop', 'co-promote'],
  },
  {
    name: 'FiercePharma',
    family: 'news',
    url: 'https://www.fiercepharma.com/rss/xml',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'co-develop', 'co-promote'],
  },
  {
    name: 'Endpoints_News',
    family: 'news',
    paging: 'wordpress',
    url: 'https://endpoints.news/feed/',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'upfront', 'milestone', 'billion', 'million'],
  },
  {
    name: 'BioWorld_Deals',
    family: 'news',
    url: 'https://www.bioworld.com/rss/14',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'merger', 'agreement'],
  },

  // === Tier 4: Additional Industry Publications & Press Wires ===
  {
    name: 'STAT_News',
    family: 'news',
    paging: 'wordpress',
    url: 'https://www.statnews.com/feed/',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'upfront', 'milestone', 'billion', 'million', 'buyout'],
  },
  {
    name: 'Business_Wire_LifeSciences',
    family: 'businesswire',
    url: 'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeGVtSWg==',
    type: 'rss',
    dealKeywords: ['license agreement', 'collaboration agreement', 'exclusive license', 'acquisition', 'deal', 'partnership', 'co-develop', 'option agreement', 'milestone', 'royalt'],
  },
  {
    name: 'Reuters_Healthcare',
    family: 'news',
    url: 'https://www.reuters.com/arc/outboundfeeds/v3/all/healthcare-pharmaceuticals/?outputType=xml',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'acquisition', 'acquire', 'merger', 'agreement', 'upfront', 'milestone', 'billion', 'million', 'buyout', 'takeover'],
  },
  {
    name: 'Labiotech_EU',
    family: 'news',
    paging: 'wordpress',
    url: 'https://www.labiotech.eu/feed/',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'upfront', 'milestone', 'billion', 'million'],
  },

  // === Tier 5: TA-Specific GlobeNewswire Feeds (diversify away from oncology) ===
  {
    name: 'GlobeNewswire_Cardiology',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5001-Cardiology/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['cardiovascular', 'cardiac', 'heart', 'cardiomyopathy', 'hypertension', 'thrombosis', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_Neurology',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5006-Neurology/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['neurology', 'cns', 'alzheimer', 'parkinson', 'epilepsy', 'migraine', 'neurodegenerat', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_Immunology',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5004-Immunology/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['autoimmune', 'immunology', 'rheumatoid', 'lupus', 'psoriasis', 'inflammatory', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_InfectiousDisease',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5005-Infectious%20Disease/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['infectious', 'antibiotic', 'antiviral', 'vaccine', 'hiv', 'hepatitis', 'rsv', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_RareDisease',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5009-Rare%20Disease/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['rare disease', 'orphan', 'gene therapy', 'enzyme replacement', 'cystic fibrosis', 'sma', 'muscular dystrophy', 'license', 'collaboration', 'deal', 'agreement'],
  },
  {
    name: 'GlobeNewswire_Metabolic',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5003-Endocrinology/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['metabolic', 'diabetes', 'obesity', 'nash', 'mash', 'glp-1', 'insulin', 'dyslipidemia', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_Ophthalmology',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5007-Ophthalmology/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['ophthalmology', 'retinal', 'macular', 'glaucoma', 'ocular', 'eye', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_Dermatology',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5002-Dermatology/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['dermatology', 'psoriasis', 'eczema', 'acne', 'skin', 'atopic', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
  {
    name: 'GlobeNewswire_Respiratory',
    family: 'globenewswire',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/industry/5008-Respiratory/feedTitle/GlobeNewswire',
    type: 'rss',
    dealKeywords: ['respiratory', 'asthma', 'copd', 'pulmonary', 'cough', 'ipf', 'license', 'collaboration', 'deal', 'agreement', 'milestone'],
  },
];

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  guid: string;
}

// === RSS Parsing ===

export async function fetchRSSFeed(source: FeedSource): Promise<RSSItem[]> {
  try {
    const response = await fetchWithTimeout(source.url, {
      timeoutMs: 15_000,
      headers: {
        'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      console.warn(`[press-releases] ${source.name}: HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return parseRSSItems(xml, source.name);
  } catch (error) {
    console.warn(`[press-releases] ${source.name} fetch error:`, error);
    return [];
  }
}

function parseRSSItems(xml: string, sourceName: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Simple XML parser for RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const guid = extractTag(itemXml, 'guid') || link;

    if (title) {
      items.push({
        title: stripHtml(title),
        link: link || '',
        description: stripHtml(description || ''),
        pubDate: pubDate || '',
        source: sourceName,
        guid: guid || '',
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular tags
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// === Press-release classification (keyword classifier) ===

export type PressCategory =
  | 'licensing' | 'm&a' | 'financing' | 'clinical' | 'regulatory'
  | 'executive_hire' | 'conference' | 'layoffs' | 'strategic_review';

export const PRESS_CATEGORIES: readonly PressCategory[] = [
  'licensing', 'm&a', 'financing', 'clinical', 'regulatory', 'executive_hire', 'conference', 'layoffs', 'strategic_review',
];

const CATEGORY_RULES: Record<PressCategory, RegExp> = {
  licensing: /\b(licens(?:e|es|ed|ing)|in-licens\w*|out-licens\w*|collaboration|co-develop\w*|option agreement|exclusive rights|worldwide rights|global rights|commerciali[sz]ation rights|partnership agreement|strategic partnership|partner(?:s|ed)? with|co-promot\w*|royalty agreement)\b/i,
  'm&a': /\b(acqui(?:re|res|red|ring|sition)|merger|merges?|merged|buyout|takeover|to be acquired|tender offer|definitive (?:merger )?agreement to acquire|business combination)\b/i,
  financing: /\b(financing|raises|raised|series [a-e]\b|seed (?:round|financing)|ipo|initial public offering|public offering|private placement|pipe financing|convertible notes?|debt facility|loan agreement|term loan|royalty financing|credit facility|closes (?:its )?(?:oversubscribed )?(?:\$[\d.,]+ ?(?:million|billion|m|b) )?(?:round|offering|financing)|\$[\d.,]+ ?(?:million|billion|m|b) (?:financing|round|offering|investment))\b/i,
  clinical: /\b(phase [1-4](?:[ab/]\w*)?|phase i{1,3}v?\b|topline|top-line|primary endpoint|first patient|last patient|dosed|enrol(?:l|ls|led|ment)|clinical trial|clinical study|interim (?:data|results|analysis)|data readout|clinical data|pivotal|study results|proof[- ]of[- ]concept)\b/i,
  regulatory: /\b(fda|ema|mhra|pmda|nmpa|chmp|approval|approves|approved|breakthrough therapy|fast track|orphan drug|priority review|accelerated approval|rmat|prime designation|nda|bla|maa|ind (?:clearance|application|filing)|ind-enabling|complete response letter|crl|pdufa|marketing authori[sz]ation|regulatory (?:submission|filing|approval))\b/i,
  executive_hire: /\b(appoints|appointed|appointment of|joins .{0,50}\bas\b|hires|hired|promotes|promoted|names .{0,60}\b(?:as|to)\b .{0,20}(?:chief|ceo|cfo|cmo|cso|coo|cbo|president|vp|vice president|head of|board)|chief (?:executive|medical|scientific|business|financial|operating|commercial|development) officer|to (?:its )?board of directors|new (?:ceo|cfo|cmo|cso|coo|cbo))\b/i,
  conference: /\b(conference|congress|symposium|annual meeting|poster(?:s| presentation)?|oral presentation|late-breaking|abstracts?|to present|will present|presents? (?:new |updated |positive )?(?:data|results|at)|fireside chat|investor day|r&d day|asco|aacr|esmo|ash annual|sitc|jpm|j\.p\. morgan|bio international|bio-europe|healthcare conference)\b/i,
  layoffs: /\b(layoffs?|workforce reduction|reduction in (?:its )?(?:workforce|force)|reduc(?:e|es|ed|ing) (?:its )?(?:workforce|headcount)|restructuring|cost[- ]reduction|cost[- ]cutting|wind(?:ing)? down|cease operations|discontinu(?:e|es|ed|ing) (?:its |the )?(?:program|development|clinical))\b/i,
  strategic_review: /\b(strategic alternatives?|strategic review|strategic options?|exploring alternatives|evaluating strategic|special committee|sale process|reverse merger|going concern|maximi[sz]e (?:shareholder|stockholder) value|review of strategic)\b/i,
};

/** Categories (fixed order) whose keyword rule matches the title or summary. */
export function classifyPressRelease(title: string, description: string = ''): PressCategory[] {
  const text = `${title || ''} ${description || ''}`.replace(/\s+/g, ' ');
  return PRESS_CATEGORIES.filter(cat => CATEGORY_RULES[cat].test(text));
}

// === Company mention resolution ===
// companies_mentioned must hold canonical companies.name values because
// lib/radar/signal-detection.ts filters with .overlaps('companies_mentioned', [company.name]).

export interface CompanyMentionEntry {
  /** lower-case text pattern */
  pattern: string;
  regex: RegExp;
  name: string;
  id: string;
}

export interface CompanyMentionIndex {
  entries: CompanyMentionEntry[];
}

const MENTION_LEGAL_SUFFIX_RE =
  /[,\s]+(inc\.?|incorporated|corp\.?|corporation|ltd\.?|limited|plc|llc|lp|co\.?|company|ag|sa|s\.a\.?|nv|n\.v\.?|se|gmbh|a\/s|ab|oy|kk|pty|holdings?)\s*$/i;

/** Words that, on their own, never identify a company. */
const GENERIC_NAME_WORDS = new Set([
  'bio', 'pharma', 'pharmaceutical', 'pharmaceuticals', 'therapeutics', 'therapeutic', 'biotech', 'biotechnology',
  'biosciences', 'bioscience', 'sciences', 'science', 'global', 'health', 'healthcare', 'medical', 'medicine', 'medicines',
  'life', 'group', 'international', 'national', 'american', 'european', 'china', 'chinese', 'japan', 'korea', 'first',
  'new', 'one', 'united', 'general', 'advanced', 'precision', 'cell', 'gene', 'immune', 'oncology', 'vaccine', 'vaccines',
  'molecular', 'clinical', 'research', 'capital', 'partners', 'ventures', 'holdings', 'technologies', 'technology',
  'systems', 'solutions', 'labs', 'laboratories', 'the', 'and', 'of', 'for', 'company', 'inc', 'corp', 'ltd',
  'genetics', 'genomics', 'diagnostics', 'devices', 'discovery', 'innovations', 'innovation', 'biologics', 'biopharma',
]);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionPattern(raw: string): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) s = s.replace(MENTION_LEGAL_SUFFIX_RE, '');
  s = s.toLowerCase().replace(/[.,]+$/, '').trim();
  if (s.length < 4 || !/[a-z]/.test(s)) return null;
  const words = s.split(/[^a-z0-9&]+/).filter(Boolean);
  if (words.length === 0 || words.every(w => GENERIC_NAME_WORDS.has(w))) return null;
  return s;
}

export function buildCompanyMentionIndex(
  rows: { id: string; name: string; name_variations?: string[] | null }[],
): CompanyMentionIndex {
  const seen = new Set<string>();
  const entries: CompanyMentionEntry[] = [];
  for (const row of rows) {
    if (!row?.name) continue;
    for (const raw of [row.name, ...(row.name_variations ?? [])]) {
      const pattern = mentionPattern(raw);
      if (!pattern || seen.has(pattern)) continue;
      seen.add(pattern);
      entries.push({
        pattern,
        regex: new RegExp(`(^|[^a-z0-9])${escapeRegExp(pattern)}([^a-z0-9]|$)`, 'i'),
        name: row.name,
        id: row.id,
      });
    }
  }
  // Longest patterns first so 'merck kgaa' is tested before 'merck'
  entries.sort((a, b) => b.pattern.length - a.pattern.length);
  return { entries };
}

/** Canonical company names (+ ids, same order) mentioned in the text. */
export function resolveCompanyMentions(text: string, index: CompanyMentionIndex): { names: string[]; ids: string[] } {
  const lower = (text || '').toLowerCase();
  const names: string[] = [];
  const ids: string[] = [];
  const seenIds = new Set<string>();
  if (!lower) return { names, ids };
  for (const entry of index.entries) {
    if (seenIds.has(entry.id)) continue;
    if (!lower.includes(entry.pattern)) continue;
    if (!entry.regex.test(lower)) continue;
    seenIds.add(entry.id);
    names.push(entry.name);
    ids.push(entry.id);
  }
  return { names, ids };
}

/** One paged query over companies(id, name, name_variations). */
export async function loadCompanyMentionIndex(supabase: SupabaseClient): Promise<CompanyMentionIndex> {
  const rows: { id: string; name: string; name_variations: string[] | null }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, name_variations')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`companies read failed: ${error.message}`);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE) break;
  }
  return buildCompanyMentionIndex(rows);
}

// === Persistence into press_releases ===

export interface PressReleaseRow {
  source: PressSourceFamily;
  feed: string;
  source_url: string;
  source_id: string | null;
  headline: string;
  body_text: string | null;
  published_at: string;
  companies_mentioned: string[];
  company_ids: string[];
  categories: PressCategory[];
  is_deal_announcement: boolean;
  raw: Record<string, unknown>;
  content_hash: string;
}

export function pressContentHash(source: string, title: string, pubDate: string): string {
  return createHash('sha1').update(`${source}|${(title || '').trim().toLowerCase()}|${pubDate || ''}`).digest('hex');
}

function parsePubDate(raw: string, fallback: Date): string {
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback.toISOString();
}

/** Build the press_releases row for one RSS item. Pure. */
export function pressItemToRow(
  item: RSSItem,
  source: Pick<FeedSource, 'name' | 'family'>,
  index: CompanyMentionIndex,
  opts: { page?: number; now?: Date } = {},
): PressReleaseRow {
  const hash = pressContentHash(source.name, item.title, item.pubDate);
  const categories = classifyPressRelease(item.title, item.description);
  const mentions = resolveCompanyMentions(`${item.title} ${item.description}`, index);
  const link = (item.link || '').trim();
  return {
    source: source.family,
    feed: source.name,
    source_url: /^https?:\/\//i.test(link) ? link : `urn:press:${hash}`,
    source_id: item.guid || null,
    headline: (item.title || '').slice(0, 500),
    body_text: item.description ? item.description.slice(0, 8000) : null,
    published_at: parsePubDate(item.pubDate, opts.now ?? new Date()),
    companies_mentioned: mentions.names,
    company_ids: mentions.ids,
    categories,
    is_deal_announcement: categories.includes('licensing') || categories.includes('m&a'),
    raw: { title: item.title, link: item.link, guid: item.guid, pubDate: item.pubDate, feed: source.name, ...(opts.page ? { page: opts.page } : {}) },
    content_hash: hash,
  };
}

const PERSIST_CHUNK = 100;

/**
 * Upsert rows on source_url (unique index, migration 109). Never throws; the
 * deal-extraction path must keep running when persistence fails.
 */
export async function persistPressItems(
  supabase: SupabaseClient,
  rows: PressReleaseRow[],
): Promise<{ upserted: number; errors: string[] }> {
  const byUrl = new Map<string, PressReleaseRow>();
  for (const r of rows) if (!byUrl.has(r.source_url)) byUrl.set(r.source_url, r);
  const unique = [...byUrl.values()];
  let upserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < unique.length; i += PERSIST_CHUNK) {
    const slice = unique.slice(i, i + PERSIST_CHUNK);
    try {
      const { error } = await supabase
        .from('press_releases')
        .upsert(slice, { onConflict: 'source_url', ignoreDuplicates: false });
      if (error) errors.push(`press_releases upsert failed (${slice[0]?.feed}): ${error.message}`);
      else upserted += slice.length;
    } catch (err) {
      errors.push(`press_releases upsert threw (${slice[0]?.feed}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { upserted, errors };
}

/** Link a persisted press release to the deal extracted from it. Never throws. */
async function linkPressReleaseToDeal(supabase: SupabaseClient, sourceUrl: string, dealId: string): Promise<void> {
  try {
    await supabase
      .from('press_releases')
      .update({ deal_id: dealId, is_deal_announcement: true, processed: true })
      .eq('source_url', sourceUrl);
  } catch { /* additive only */ }
}

// === Deal Filtering ===

function isPotentialDeal(item: RSSItem, keywords: string[]): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();

  // Must contain at least one deal keyword
  return keywords.some(kw => text.includes(kw.toLowerCase()));
}

// === Full Article Fetching ===

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: 15_000,
      headers: {
        'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) return '';

    const html = await response.text();

    // Extract text content
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Return first 15000 chars to manage token usage
    return text.substring(0, 15000);
  } catch {
    return '';
  }
}

// === Deal Extraction (reuses SEC EDGAR pattern) ===

async function extractDealFromArticle(
  title: string,
  content: string,
  source: string,
  anthropicApiKey: string
): Promise<ExtractedDeal | null> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const systemPrompt = `You are an expert biopharma deal analyst extracting licensing deal information from press releases and news articles. You extract deal terms at the depth a BD professional needs for benchmarking and term sheet structuring.

Your task is to identify and extract structured deal data. Be precise and conservative:
- Only extract information that is explicitly stated
- Use null for fields that are not clearly disclosed
- Financial values should be in USD (convert millions/billions to full numbers)
- Royalty percentages should be decimals (e.g., 0.15 for 15%)
- Be especially careful with party roles: licensor grants rights, licensee receives rights

MODALITY VALUES: small_molecule, antibody, adc, bispecific, car_t, cell_therapy, gene_therapy, mrna, radiopharm, peptide, oligonucleotide, vaccine, other
INDICATION CATEGORIES: solid_tumor, hematological, autoimmune, cns, cardiovascular, infectious, metabolic, rare_disease, respiratory, dermatology, ophthalmology, other
PHASE VALUES: discovery, preclinical, phase_1, phase_2, phase_3, approved, unknown
TERRITORY VALUES: global, us, ex_us, us_eu, us_eu_japan, china, japan, asia_pacific, europe, regional, other
DEAL TYPE VALUES: license, option, collaboration, acquisition, co_development, co_promotion, other
EXCLUSIVITY VALUES: exclusive, co_exclusive, non_exclusive, unknown
REGULATORY DESIGNATIONS: breakthrough, fast_track, orphan, priority_review, rmat, prime, accelerated

MILESTONE EXTRACTION: Extract individual milestones when disclosed. Classify as development (IND, Phase starts), regulatory (filing, approval), commercial (revenue-based), or sales (net sales thresholds).
DEAL STRUCTURE: Look for opt-in/opt-out provisions, profit-sharing vs royalty, cost-sharing ratios, research funding, rights retained by licensor, sublicense rights, contract duration, companion diagnostic rights.`;

  const userPrompt = `Extract the biopharma licensing/collaboration deal from this article. Return ONLY valid JSON.

If this is NOT a biopharma licensing/collaboration deal, return: {"is_deal": false, "reason": "brief explanation"}

If it IS a deal, return:
{
  "licensor": "company name granting rights",
  "licensee": "company name receiving rights",
  "asset_name": "drug/compound name or code, or null",
  "asset_description": "brief description, or null",
  "modality": "one of the modality values",
  "indication_category": "one of the indication categories, or null",
  "indication_specific": "specific disease, or null",
  "target": "molecular target, or null",
  "mechanism_of_action": "brief MOA, or null",
  "phase_at_signing": "one of the phase values",
  "territory": "one of the territory values, or null",
  "territories_included": ["array", "of", "territories"],
  "exclusivity": "one of the exclusivity values",
  "deal_type": "one of the deal type values",
  "upfront_usd": number or null,
  "milestones_total_usd": number or null,
  "milestones_development_usd": number or null,
  "milestones_regulatory_usd": number or null,
  "milestones_commercial_usd": number or null,
  "royalty_low_pct": whole percent number or null (e.g., 10 for 10%, never 0.10),
  "royalty_high_pct": whole percent number or null (e.g., 20 for 20%, never 0.20),
  "total_deal_value_usd": number or null,
  "equity_investment_usd": number or null,
  "includes_manufacturing": boolean,
  "includes_co_development": boolean,
  "includes_co_promotion": boolean,
  "option_exercise_fee": number or null,
  "milestone_details": [{"description": "milestone name", "amount_usd": number, "type": "development|regulatory|commercial|sales"}] or null,
  "sales_milestones": [{"threshold_usd": number, "payment_usd": number}] or null,
  "research_funding_usd": number or null,
  "profit_share_pct": decimal or null,
  "cost_share_ratio": decimal or null,
  "opt_in_rights": "opt-in/opt-out provision description, or null",
  "opt_in_stage": "phase for opt-in, or null",
  "regulatory_designations": ["array of designations"],
  "term_years": number or null,
  "sublicense_rights": boolean or null,
  "rights_retained": "what licensor retains, or null",
  "indications_licensed": number or null,
  "includes_diagnostics": boolean,
  "confidence_score": 0-100,
  "extraction_notes": "any caveats"
}

Title: ${title}
Source: ${source}

Article text:
${content}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') return null;

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.is_deal === false) return null;

    return parsed as ExtractedDeal;
  } catch (error) {
    console.error(`[press-releases] Extraction error for "${title}":`, error);
    return null;
  }
}

// === Main Ingestion Function ===

export interface PressReleaseIngestionOptions {
  maxArticlesPerSource?: number;
  timeBudgetMs?: number;
  /**
   * Backfill mode: page older items from every feed that supports paging and
   * persist them to press_releases (no Claude deal extraction). Wire from the
   * cron route as `?backfill=true&months=24`.
   */
  backfill?: boolean;
  /** Backfill depth in months (default 24). */
  months?: number;
  /** Backfill: max pages fetched per source per run (default 40). */
  maxPagesPerSource?: number;
  /**
   * Fetch and persist every feed item without Claude deal extraction. Wire
   * from the cron route as `?persist_only=true` for a cheap 2-hourly run.
   */
  persistOnly?: boolean;
}

export interface PressReleaseIngestionResult {
  sources_checked: number;
  articles_found: number;
  potential_deals: number;
  deals_extracted: number;
  deals_inserted: number;
  /** Rows upserted into press_releases (every fetched item, not only deals). */
  press_releases_persisted: number;
  errors: string[];
}

export async function runPressReleaseIngestion(
  supabase: SupabaseClient,
  anthropicApiKey: string,
  options?: PressReleaseIngestionOptions
): Promise<PressReleaseIngestionResult> {
  if (options?.backfill) {
    const b = await runPressReleaseBackfill(supabase, {
      months: options.months,
      timeBudgetMs: options.timeBudgetMs,
      maxPagesPerSource: options.maxPagesPerSource,
    });
    return {
      sources_checked: b.sources.length,
      articles_found: b.items_fetched,
      potential_deals: 0,
      deals_extracted: 0,
      deals_inserted: 0,
      press_releases_persisted: b.persisted,
      errors: b.errors,
    };
  }

  const maxPerSource = options?.maxArticlesPerSource || 10;
  const timeBudget = options?.timeBudgetMs || 250_000; // 250s default (safe for 300s Vercel limit)
  const startTime = Date.now();
  const errors: string[] = [];
  let articlesFound = 0;
  let potentialDeals = 0;
  let dealsExtracted = 0;
  let dealsInserted = 0;
  let persisted = 0;

  console.log(`[press-releases] Starting ingestion from ${FEED_SOURCES.length} sources (budget: ${timeBudget}ms)...`);

  // Company index for companies_mentioned resolution (additive; never blocks deal extraction)
  let mentionIndex: CompanyMentionIndex = { entries: [] };
  try {
    mentionIndex = await loadCompanyMentionIndex(supabase);
  } catch (err) {
    errors.push(`company mention index failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const source of FEED_SOURCES) {
    if (Date.now() - startTime > timeBudget) {
      console.log(`[press-releases] Time budget exceeded after ${FEED_SOURCES.indexOf(source)} sources, stopping`);
      break;
    }
    try {
      console.log(`[press-releases] Fetching ${source.name}...`);
      const items = await fetchRSSFeed(source);
      articlesFound += items.length;

      // Persist EVERY item to press_releases (Phase 3 data source). Failures are logged, never thrown.
      if (items.length > 0) {
        const rows = items.map(item => pressItemToRow(item, source, mentionIndex));
        const persistResult = await persistPressItems(supabase, rows);
        persisted += persistResult.upserted;
        errors.push(...persistResult.errors);
      }

      // Filter for potential deals
      const dealItems = options?.persistOnly
        ? []
        : items
          .filter(item => isPotentialDeal(item, source.dealKeywords))
          .slice(0, maxPerSource);

      potentialDeals += dealItems.length;
      console.log(`[press-releases] ${source.name}: ${items.length} items, ${dealItems.length} potential deals`);

      for (const item of dealItems) {
        if (Date.now() - startTime > timeBudget) break;
        try {
          // Check if we've already processed this article
          const guid = item.guid || item.link;
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .eq('source_url', item.link)
            .limit(1)
            .single();

          if (existing) continue;

          // Fetch full article content for better extraction
          let content = item.description;
          if (item.link) {
            const fullContent = await fetchArticleContent(item.link);
            if (fullContent.length > content.length) {
              content = fullContent;
            }
          }

          if (content.length < 100) continue;

          // Extract deal using Claude
          const deal = await extractDealFromArticle(item.title, content, source.name, anthropicApiKey);

          if (deal && deal.confidence_score >= 85 && deal.licensor && deal.licensee) {
            // Phase 4 (2026-04-14): shared fabrication validator.
            const validation = validateExtractedDeal({
              licensor: deal.licensor,
              licensee: deal.licensee,
              modality: deal.modality,
              asset_name: deal.asset_name,
              indication_specific: deal.indication_specific,
              upfront_usd: deal.upfront_usd,
              total_deal_value_usd: deal.total_deal_value_usd,
              confidence_score: deal.confidence_score,
              source_url: item.link,
              source_filing_id: guid,
            });
            if (!validation.valid) {
              console.warn(
                `[press-releases] Rejected pre-insert [${validation.rejectCode}]: ` +
                `${deal.licensor} → ${deal.licensee} — ${validation.rejectReason}`
              );
              errors.push(
                `Validation-rejected (${validation.rejectCode}) ${guid}: ${validation.rejectReason}`
              );
              continue;
            }
            dealsExtracted++;

            // Find or create companies
            const { findOrCreateCompany, deriveTherapeuticArea } = await import('./sec-edgar');
            const { classifyAndEnrichDeal, classifyCompanyCountry } = await import('./company-geography');
            const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
            const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
            const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
            const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);

            // Update company HQ if not already set
            if (licensorId) {
              const licGeo = classifyCompanyCountry(deal.licensor);
              if (licGeo.confidence !== 'low') {
                await supabase.from('companies').update({
                  headquarters_country: licGeo.country, headquarters_region: licGeo.region,
                }).eq('id', licensorId).is('headquarters_country', null);
              }
            }
            if (licenseeId) {
              const licnGeo = classifyCompanyCountry(deal.licensee);
              if (licnGeo.confidence !== 'low') {
                await supabase.from('companies').update({
                  headquarters_country: licnGeo.country, headquarters_region: licnGeo.region,
                }).eq('id', licenseeId).is('headquarters_country', null);
              }
            }

            // Parse pub date (fallback to today if RSS item has no date)
            let announcedDate: string = new Date().toISOString().split('T')[0];
            try {
              const d = new Date(item.pubDate);
              if (!isNaN(d.getTime())) announcedDate = d.toISOString().split('T')[0];
            } catch { /* ignore */ }

            const { data: insertedDeal, error: insertError } = await supabase.from('deals').insert({
              licensor_name: deal.licensor,
              licensor_id: licensorId,
              licensee_name: deal.licensee,
              licensee_id: licenseeId,
              licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : null,
              licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
              licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : null,
              licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
              cross_border: geo.cross_border,
              deal_corridor: geo.deal_corridor,
              asset_name: deal.asset_name,
              asset_description: deal.asset_description,
              modality: deal.modality,
              indication_category: deal.indication_category,
              indication_specific: deal.indication_specific,
              target: deal.target,
              mechanism_of_action: deal.mechanism_of_action,
              phase_at_signing: deal.phase_at_signing,
              territory: deal.territory,
              territories_included: deal.territories_included || [],
              exclusivity: deal.exclusivity,
              deal_type: deal.deal_type,
              upfront_usd: deal.upfront_usd,
              milestones_total_usd: deal.milestones_total_usd,
              milestones_development_usd: deal.milestones_development_usd,
              milestones_regulatory_usd: deal.milestones_regulatory_usd,
              milestones_commercial_usd: deal.milestones_commercial_usd,
              royalty_low_pct: normalizeRoyaltyPct(deal.royalty_low_pct),
              royalty_high_pct: normalizeRoyaltyPct(deal.royalty_high_pct),
              total_deal_value_usd: deal.total_deal_value_usd,
              equity_investment_usd: deal.equity_investment_usd,
              includes_manufacturing: deal.includes_manufacturing,
              includes_co_development: deal.includes_co_development,
              includes_co_promotion: deal.includes_co_promotion,
              option_exercise_fee: deal.option_exercise_fee,
              // Rich term fields
              milestone_details: deal.milestone_details || [],
              sales_milestones: deal.sales_milestones || [],
              research_funding_usd: deal.research_funding_usd,
              profit_share_pct: deal.profit_share_pct,
              cost_share_ratio: deal.cost_share_ratio,
              opt_in_rights: deal.opt_in_rights,
              opt_in_stage: deal.opt_in_stage,
              regulatory_designations: deal.regulatory_designations || [],
              term_years: deal.term_years,
              sublicense_rights: deal.sublicense_rights,
              rights_retained: deal.rights_retained,
              indications_licensed: deal.indications_licensed,
              includes_diagnostics: deal.includes_diagnostics || false,
              announced_date: announcedDate,
              source_type: 'press_release',
              source_url: item.link,
              source_filing_id: guid,
              terms_disclosed: deal.upfront_usd !== null || deal.milestones_total_usd !== null,
              confidence_score: deal.confidence_score,
              extraction_notes: `Source: ${source.name}. ${deal.extraction_notes || ''}`.trim(),
              extraction_model: 'claude-opus-4-6',
              extraction_timestamp: new Date().toISOString(),
              therapeutic_area: therapeuticArea,
              verification_status: 'pending',
              raw_text_excerpt: extractAuditExcerpt(content, deal.licensee ?? '', 500),
            }).select('id').single();

            if (insertError) {
              if (insertError.code !== '23505') { // Skip duplicate errors
                errors.push(`Insert error: ${insertError.message}`);
              }
            } else {
              dealsInserted++;
              console.log(`[press-releases] Extracted: ${deal.licensor} → ${deal.licensee} (${deal.modality}) from ${source.name}`);
              if (insertedDeal?.id && item.link) await linkPressReleaseToDeal(supabase, item.link, insertedDeal.id);
            }
          }

          // Rate limiting
          await sleep(1500);

        } catch (error) {
          errors.push(`${source.name} item error: ${error}`);
        }
      }

      // Rate limiting between sources
      await sleep(options?.persistOnly ? 500 : 2000);

    } catch (error) {
      errors.push(`${source.name} error: ${error}`);
    }
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'press_releases',
    run_type: 'scheduled',
    parameters: { sources: FEED_SOURCES.length, maxPerSource, press_releases_persisted: persisted, persist_only: !!options?.persistOnly },
    records_fetched: articlesFound,
    records_processed: potentialDeals,
    records_inserted: dealsInserted,
    records_updated: persisted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[press-releases] Done: ${articlesFound} articles, ${persisted} persisted, ${potentialDeals} potential deals, ${dealsExtracted} extracted, ${dealsInserted} inserted`);

  return {
    sources_checked: FEED_SOURCES.length,
    articles_found: articlesFound,
    potential_deals: potentialDeals,
    deals_extracted: dealsExtracted,
    deals_inserted: dealsInserted,
    press_releases_persisted: persisted,
    errors,
  };
}

// === Backfill (persistence only; no Claude extraction) ===

export interface PressReleaseBackfillResult {
  sources: { name: string; pages_fetched: number; items_fetched: number; persisted: number; done: boolean; oldest: string | null }[];
  /** Feeds that do not page (see the FEED_SOURCES header comment). */
  unsupported: string[];
  items_fetched: number;
  persisted: number;
  errors: string[];
  timed_out: boolean;
}

function pagedUrl(source: FeedSource, page: number): string {
  if (source.paging === 'wordpress') return `${source.url}${source.url.includes('?') ? '&' : '?'}paged=${page}`;
  return source.url;
}

/**
 * Page older items from every feed that supports paging until the items are
 * older than `months`, persisting each page to press_releases. Progress is
 * kept in radar_sync_cursors (`press_backfill:<feed>` -> state.page) so a
 * time-boxed run resumes where the previous one stopped; delete the row to
 * restart a feed.
 */
export async function runPressReleaseBackfill(
  supabase: SupabaseClient,
  options: { months?: number; timeBudgetMs?: number; maxPagesPerSource?: number; now?: Date } = {},
): Promise<PressReleaseBackfillResult> {
  const months = Math.max(1, Math.min(options.months ?? 24, 120));
  const timeBudget = options.timeBudgetMs ?? 250_000;
  const maxPages = Math.max(1, options.maxPagesPerSource ?? 40);
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - months);
  const startTime = Date.now();
  const errors: string[] = [];
  const sources: PressReleaseBackfillResult['sources'] = [];
  const unsupported = FEED_SOURCES.filter(s => !s.paging).map(s => s.name);
  let itemsFetched = 0;
  let persisted = 0;
  let timedOut = false;

  let mentionIndex: CompanyMentionIndex = { entries: [] };
  try {
    mentionIndex = await loadCompanyMentionIndex(supabase);
  } catch (err) {
    errors.push(`company mention index failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const source of FEED_SOURCES.filter(s => s.paging)) {
    if (Date.now() - startTime > timeBudget) { timedOut = true; break; }
    const cursorKey = `press_backfill:${source.name}`;
    const summary = { name: source.name, pages_fetched: 0, items_fetched: 0, persisted: 0, done: false, oldest: null as string | null };
    sources.push(summary);
    try {
      const cursor = await readSyncCursor<{ page?: number; done?: boolean; months?: number }>(supabase, cursorKey);
      let page = Math.max(1, Number(cursor.state.page ?? 1));
      if (cursor.state.done && (cursor.state.months ?? 0) >= months) { summary.done = true; continue; }

      while (summary.pages_fetched < maxPages) {
        if (Date.now() - startTime > timeBudget) { timedOut = true; break; }
        const items = await fetchRSSFeed({ ...source, url: pagedUrl(source, page) });
        summary.pages_fetched++;
        if (items.length === 0) { summary.done = true; break; }
        summary.items_fetched += items.length;
        itemsFetched += items.length;

        const rows = items.map(item => pressItemToRow(item, source, mentionIndex, { page, now }));
        const res = await persistPressItems(supabase, rows);
        summary.persisted += res.upserted;
        persisted += res.upserted;
        errors.push(...res.errors);

        const dates = rows.map(r => r.published_at).sort();
        summary.oldest = dates[0] ?? summary.oldest;
        page++;
        await writeSyncCursor(supabase, cursorKey, String(page), { page, done: false, months });
        if (summary.oldest && new Date(summary.oldest) < cutoff) { summary.done = true; break; }
        await sleep(1000);
      }
      if (summary.done) await writeSyncCursor(supabase, cursorKey, String(page), { page, done: true, months });
    } catch (err) {
      errors.push(`${source.name} backfill error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await supabase.from('data_ingestion_log').insert({
    source: 'press_releases',
    run_type: 'backfill',
    parameters: { months, sources: sources.map(s => s.name), unsupported, timed_out: timedOut },
    records_fetched: itemsFetched,
    records_processed: itemsFetched,
    records_inserted: 0,
    records_updated: persisted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 || timedOut ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  return { sources, unsupported, items_fetched: itemsFetched, persisted, errors, timed_out: timedOut };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
