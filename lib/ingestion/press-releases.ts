// Multi-Source Deal Intelligence Pipeline
// Ingests deal announcements from press release wires and biotech news RSS feeds
// Uses Claude AI to extract structured deal data (same pattern as SEC EDGAR)

import Anthropic from '@anthropic-ai/sdk';
import type { ExtractedDeal } from './sec-edgar';
import { fetchWithTimeout } from '../fetch-with-timeout';

// === RSS Feed Sources ===
// Each source provides deal announcements that we filter and extract from

interface FeedSource {
  name: string;
  url: string;
  type: 'rss' | 'atom';
  dealKeywords: string[]; // Must contain at least one to be considered a potential deal
}

const FEED_SOURCES: FeedSource[] = [
  // === Tier 1: Dedicated Deals Feeds (highest signal, every item is a deal) ===
  {
    name: 'BioSpace_Deals',
    url: 'https://www.biospace.com/deals.rss',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'billion', 'million'],
  },
  {
    name: 'BioPharma_Dive_Deals',
    url: 'https://www.biopharmadive.com/feeds/topic/deals/',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'billion', 'million'],
  },

  // === Tier 2: Deal-Type Wire Feeds (high volume, filtered by deal category) ===
  {
    name: 'GlobeNewswire_Licensing',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/25-Licensing%20Agreements/feedTitle/GlobeNewswire%20-%20Licensing%20Agreements',
    type: 'rss',
    dealKeywords: ['pharma', 'biotech', 'therapeutic', 'clinical', 'drug', 'oncology', 'antibody', 'gene therapy', 'license', 'collaboration', 'fda', 'pipeline', 'biologic'],
  },
  {
    name: 'GlobeNewswire_MA',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/27-Mergers%20And%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20And%20Acquisitions',
    type: 'rss',
    dealKeywords: ['pharma', 'biotech', 'therapeutic', 'clinical', 'drug', 'oncology', 'antibody', 'gene therapy', 'pipeline', 'biologic', 'pharmaceutical'],
  },
  {
    name: 'GlobeNewswire_Partnerships',
    url: 'https://www.globenewswire.com/RssFeed/subjectcode/29-Partnerships/feedTitle/GlobeNewswire%20-%20Partnerships',
    type: 'rss',
    dealKeywords: ['pharma', 'biotech', 'therapeutic', 'clinical', 'drug', 'oncology', 'antibody', 'gene therapy', 'license', 'collaboration', 'fda', 'pipeline', 'biologic'],
  },
  {
    name: 'PR_Newswire_Biotech',
    url: 'https://www.prnewswire.com/rss/health-latest-news/biotechnology-list.rss',
    type: 'rss',
    dealKeywords: ['license agreement', 'collaboration agreement', 'exclusive license', 'acquisition', 'deal', 'partnership', 'co-develop', 'option agreement', 'milestone', 'royalt'],
  },
  {
    name: 'PR_Newswire_Pharma',
    url: 'https://www.prnewswire.com/rss/health-latest-news/pharmaceuticals-list.rss',
    type: 'rss',
    dealKeywords: ['license agreement', 'collaboration agreement', 'exclusive license', 'acquisition', 'deal', 'partnership', 'co-develop', 'option agreement', 'milestone', 'royalt'],
  },

  // === Tier 3: Industry News Feeds (need keyword filtering for deals) ===
  {
    name: 'FierceBiotech',
    url: 'https://www.fiercebiotech.com/rss/xml',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'co-develop', 'co-promote'],
  },
  {
    name: 'FiercePharma',
    url: 'https://www.fiercepharma.com/rss/xml',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'rights', 'option', 'milestone', 'royalt', 'upfront', 'co-develop', 'co-promote'],
  },
  {
    name: 'Endpoints_News',
    url: 'https://endpoints.news/feed/',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'acquire', 'merger', 'agreement', 'upfront', 'milestone', 'billion', 'million'],
  },
  {
    name: 'BioWorld_Deals',
    url: 'https://www.bioworld.com/rss/14',
    type: 'rss',
    dealKeywords: ['deal', 'license', 'collaboration', 'partnership', 'acquisition', 'merger', 'agreement'],
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
  "royalty_low_pct": decimal or null,
  "royalty_high_pct": decimal or null,
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
      model: 'claude-sonnet-4-20250514',
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

export async function runPressReleaseIngestion(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  anthropicApiKey: string,
  options?: { maxArticlesPerSource?: number }
): Promise<{
  sources_checked: number;
  articles_found: number;
  potential_deals: number;
  deals_extracted: number;
  deals_inserted: number;
  errors: string[];
}> {
  const maxPerSource = options?.maxArticlesPerSource || 10;
  const errors: string[] = [];
  let articlesFound = 0;
  let potentialDeals = 0;
  let dealsExtracted = 0;
  let dealsInserted = 0;

  console.log(`[press-releases] Starting ingestion from ${FEED_SOURCES.length} sources...`);

  for (const source of FEED_SOURCES) {
    try {
      console.log(`[press-releases] Fetching ${source.name}...`);
      const items = await fetchRSSFeed(source);
      articlesFound += items.length;

      // Filter for potential deals
      const dealItems = items
        .filter(item => isPotentialDeal(item, source.dealKeywords))
        .slice(0, maxPerSource);

      potentialDeals += dealItems.length;
      console.log(`[press-releases] ${source.name}: ${items.length} items, ${dealItems.length} potential deals`);

      for (const item of dealItems) {
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

          if (deal && deal.confidence_score >= 75 && deal.licensor && deal.licensee) {
            dealsExtracted++;

            // Find or create companies
            const { findOrCreateCompany, deriveTherapeuticArea } = await import('./sec-edgar');
            const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
            const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
            const therapeuticArea = deriveTherapeuticArea(deal.indication_category);

            // Parse pub date (fallback to today if RSS item has no date)
            let announcedDate: string = new Date().toISOString().split('T')[0];
            try {
              const d = new Date(item.pubDate);
              if (!isNaN(d.getTime())) announcedDate = d.toISOString().split('T')[0];
            } catch { /* ignore */ }

            const { error: insertError } = await supabase.from('deals').insert({
              licensor_name: deal.licensor,
              licensor_id: licensorId,
              licensee_name: deal.licensee,
              licensee_id: licenseeId,
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
              royalty_low_pct: deal.royalty_low_pct,
              royalty_high_pct: deal.royalty_high_pct,
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
              extraction_model: 'claude-sonnet-4-20250514',
              extraction_timestamp: new Date().toISOString(),
              therapeutic_area: therapeuticArea,
            });

            if (insertError) {
              if (insertError.code !== '23505') { // Skip duplicate errors
                errors.push(`Insert error: ${insertError.message}`);
              }
            } else {
              dealsInserted++;
              console.log(`[press-releases] Extracted: ${deal.licensor} → ${deal.licensee} (${deal.modality}) from ${source.name}`);
            }
          }

          // Rate limiting
          await sleep(1500);

        } catch (error) {
          errors.push(`${source.name} item error: ${error}`);
        }
      }

      // Rate limiting between sources
      await sleep(2000);

    } catch (error) {
      errors.push(`${source.name} error: ${error}`);
    }
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'press_releases',
    run_type: 'scheduled',
    parameters: { sources: FEED_SOURCES.length, maxPerSource },
    records_fetched: articlesFound,
    records_processed: potentialDeals,
    records_inserted: dealsInserted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[press-releases] Done: ${articlesFound} articles, ${potentialDeals} potential deals, ${dealsExtracted} extracted, ${dealsInserted} inserted`);

  return {
    sources_checked: FEED_SOURCES.length,
    articles_found: articlesFound,
    potential_deals: potentialDeals,
    deals_extracted: dealsExtracted,
    deals_inserted: dealsInserted,
    errors,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
