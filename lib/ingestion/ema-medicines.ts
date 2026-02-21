// EMA European Medicines Agency Regulatory Data Pipeline
// Ingests CHMP recommendations and marketing authorization decisions
// Enriches existing deals with EU territory data or creates new records

import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveTherapeuticArea } from './sec-edgar';

// === EMA RSS Feed ===

const EMA_CHMP_FEED = 'https://www.ema.europa.eu/en/rss/human-medicines/recommendations.xml';

interface EMAItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

interface ParsedEMAMedicine {
  medicineName: string;
  activeSubstance: string | null;
  therapeuticArea: string | null;
  opinionDate: string;
  mah: string | null;
  indication: string | null;
  isPositiveOpinion: boolean;
  sourceUrl: string;
  guid: string;
}

// === RSS Parsing (same pattern as press-releases.ts) ===

async function fetchEMARSSFeed(): Promise<EMAItem[]> {
  try {
    const response = await fetch(EMA_CHMP_FEED, {
      headers: {
        'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      console.warn(`[ema] RSS feed HTTP ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return parseRSSItems(xml);
  } catch (error) {
    console.warn('[ema] RSS feed fetch error:', error);
    return [];
  }
}

function parseRSSItems(xml: string): EMAItem[] {
  const items: EMAItem[] = [];

  // Simple XML parser for RSS items (same approach as press-releases.ts)
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

// === EMA-Specific Parsing ===

/**
 * Parse an EMA RSS item into structured medicine data.
 * EMA titles typically follow patterns like:
 *   "Positive opinion on Medicine Name (active substance) for treatment of..."
 *   "Refusal of Marketing Authorisation for Medicine Name"
 *   "New medicine recommendation: Medicine Name"
 */
function parseEMAItem(item: EMAItem): ParsedEMAMedicine {
  const text = `${item.title} ${item.description}`;
  const titleLower = item.title.toLowerCase();

  // Determine if positive opinion/authorization
  const isPositiveOpinion =
    titleLower.includes('positive opinion') ||
    titleLower.includes('new medicine') ||
    titleLower.includes('marketing authorisation granted') ||
    titleLower.includes('marketing authorization granted') ||
    titleLower.includes('recommendation for approval') ||
    titleLower.includes('recommended for approval') ||
    (titleLower.includes('recommend') && !titleLower.includes('refus'));

  // Extract medicine name - try common EMA title patterns
  let medicineName = '';

  // Pattern: "... on MedicineName (active substance)..."
  const onPattern = /(?:opinion on|recommendation[:\s]+|authorisation for|authorization for)\s+([A-Z][A-Za-z0-9\-]+)/i;
  const onMatch = text.match(onPattern);
  if (onMatch) {
    medicineName = onMatch[1].trim();
  }

  // Pattern: medicine name at start of title before dash or parenthesis
  if (!medicineName) {
    const startPattern = /^([A-Z][A-Za-z0-9\-]+)\s*(?:\(|-|:)/;
    const startMatch = item.title.match(startPattern);
    if (startMatch) {
      medicineName = startMatch[1].trim();
    }
  }

  // Fallback: first capitalized word that looks like a drug name
  if (!medicineName) {
    const drugPattern = /\b([A-Z][a-z]+(?:mab|nib|lib|tib|zumab|ximab|lumab|tinib|ciclib|rafenib|lisib|parin|vir|stat|pril|sartan|olol|dipine|oxacin|mycin|cillin|azole|prazole|tadine|lukast|pramine|oxetine|azepam|barbital|fentanil|morphone|done|phine|codone|bital|zolam|topic)\b)/;
    const drugMatch = text.match(drugPattern);
    if (drugMatch) {
      medicineName = drugMatch[1];
    }
  }

  // Last resort: use the first significant word from title
  if (!medicineName) {
    medicineName = item.title.split(/[\s\-:(]/)[0] || item.title;
  }

  // Extract active substance from parentheses
  const substanceMatch = text.match(/\(([^)]+)\)/);
  const activeSubstance = substanceMatch ? substanceMatch[1].trim() : null;

  // Extract MAH (Marketing Authorization Holder)
  let mah: string | null = null;
  const mahPatterns = [
    /(?:marketing authoris?ation holder|applicant|mah)[:\s]+([A-Z][A-Za-z\s&,.]+?)(?:\.|,|\s{2})/i,
    /(?:developed by|manufactured by|from)\s+([A-Z][A-Za-z\s&,.]+?)(?:\.|,|\s{2})/i,
  ];
  for (const pattern of mahPatterns) {
    const mahMatch = text.match(pattern);
    if (mahMatch) {
      mah = mahMatch[1].trim();
      break;
    }
  }

  // Extract therapeutic area hints from EMA categories
  let therapeuticArea: string | null = null;
  const taLower = text.toLowerCase();
  if (taLower.includes('oncology') || taLower.includes('cancer') || taLower.includes('tumour') || taLower.includes('tumor') || taLower.includes('leukaemia') || taLower.includes('leukemia') || taLower.includes('lymphoma') || taLower.includes('myeloma')) {
    therapeuticArea = 'oncology';
  } else if (taLower.includes('neurology') || taLower.includes('neurological') || taLower.includes('alzheimer') || taLower.includes('parkinson') || taLower.includes('epilepsy') || taLower.includes('multiple sclerosis')) {
    therapeuticArea = 'neurology';
  } else if (taLower.includes('immunology') || taLower.includes('autoimmune') || taLower.includes('rheumatoid') || taLower.includes('psoriasis') || taLower.includes('lupus')) {
    therapeuticArea = 'immunology';
  } else if (taLower.includes('metabolic') || taLower.includes('diabetes') || taLower.includes('obesity')) {
    therapeuticArea = 'metabolic';
  }

  // Extract indication text from description
  let indication: string | null = null;
  const indicationPatterns = [
    /(?:for the treatment of|indicated for|for treating|for use in)\s+(.+?)(?:\.|$)/i,
    /(?:treatment of)\s+(.+?)(?:\.|,|$)/i,
  ];
  for (const pattern of indicationPatterns) {
    const indMatch = item.description.match(pattern);
    if (indMatch) {
      indication = indMatch[1].trim().substring(0, 500);
      break;
    }
  }
  if (!indication) {
    for (const pattern of indicationPatterns) {
      const indMatch = item.title.match(pattern);
      if (indMatch) {
        indication = indMatch[1].trim().substring(0, 500);
        break;
      }
    }
  }

  // Parse date
  let opinionDate = new Date().toISOString().split('T')[0];
  try {
    const d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) opinionDate = d.toISOString().split('T')[0];
  } catch { /* use fallback */ }

  return {
    medicineName,
    activeSubstance,
    therapeuticArea,
    opinionDate,
    mah,
    indication,
    isPositiveOpinion,
    sourceUrl: item.link,
    guid: item.guid,
  };
}

// === Indication Category Mapping ===

/**
 * Map EMA therapeutic area and indication text to our indication_category enum.
 * Returns the category string used by deriveTherapeuticArea.
 */
function mapToIndicationCategory(medicine: ParsedEMAMedicine): string | null {
  const text = `${medicine.therapeuticArea || ''} ${medicine.indication || ''}`.toLowerCase();

  if (text.includes('solid tumour') || text.includes('solid tumor') || text.includes('nsclc') || text.includes('breast cancer') || text.includes('lung cancer') || text.includes('colorectal') || text.includes('melanoma') || text.includes('renal') || text.includes('hepatocellular') || text.includes('gastric') || text.includes('ovarian') || text.includes('prostate') || text.includes('pancreatic')) {
    return 'solid_tumor';
  }
  if (text.includes('leukaemia') || text.includes('leukemia') || text.includes('lymphoma') || text.includes('myeloma') || text.includes('myeloid') || text.includes('myelofibrosis')) {
    return 'hematological';
  }
  if (text.includes('autoimmune') || text.includes('rheumatoid') || text.includes('psoriasis') || text.includes('lupus') || text.includes('crohn') || text.includes('ulcerative colitis') || text.includes('atopic dermatitis')) {
    return 'autoimmune';
  }
  if (text.includes('alzheimer') || text.includes('parkinson') || text.includes('epilepsy') || text.includes('multiple sclerosis') || text.includes('migraine') || text.includes('neuropath') || text.includes('neurology') || text.includes('cns')) {
    return 'cns';
  }
  if (text.includes('cardiovascular') || text.includes('heart failure') || text.includes('hypertension') || text.includes('atrial fibrillation') || text.includes('thrombosis')) {
    return 'cardiovascular';
  }
  if (text.includes('hiv') || text.includes('hepatitis') || text.includes('infection') || text.includes('covid') || text.includes('influenza') || text.includes('bacterial') || text.includes('antiviral') || text.includes('antibiotic')) {
    return 'infectious';
  }
  if (text.includes('diabetes') || text.includes('metabolic') || text.includes('obesity') || text.includes('lipodystrophy')) {
    return 'metabolic';
  }
  if (text.includes('rare disease') || text.includes('orphan') || text.includes('rare condition')) {
    return 'rare_disease';
  }
  if (text.includes('asthma') || text.includes('copd') || text.includes('respiratory') || text.includes('pulmonary')) {
    return 'respiratory';
  }

  return null;
}

// === Company Matching ===

/**
 * Match an EMA MAH name to an existing company in the companies table.
 * Searches by name and name_variations (case-insensitive).
 */
async function matchMAHToCompany(
  supabase: SupabaseClient,
  mahName: string
): Promise<string | null> {
  if (!mahName) return null;

  // Normalize: strip common suffixes
  const normalized = mahName
    .replace(/,?\s*(Ltd\.?|Limited|GmbH|S\.?A\.?|B\.?V\.?|Inc\.?|Corp\.?|PLC|AB|AG|N\.?V\.?|SE|KGaA|Oyj|A\/S)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Escape special characters for LIKE/array queries
  const safeName = normalized.replace(/[%_\\]/g, '\\$&');
  const safeArrayName = mahName.replace(/[{}"\\,]/g, '\\$&');

  const { data: existing } = await supabase
    .from('companies')
    .select('id, name, name_variations')
    .or(`name.ilike.%${safeName}%,name_variations.cs.{${safeArrayName}}`)
    .limit(1)
    .single();

  return existing?.id || null;
}

// === Deal Matching & Enrichment ===

/**
 * Try to find an existing deal that matches this EMA-approved medicine.
 * Matches by asset_name or drug name similarity.
 */
async function findMatchingDeal(
  supabase: SupabaseClient,
  medicine: ParsedEMAMedicine
): Promise<{ id: string; territories_included: string[] } | null> {
  const nameToSearch = medicine.medicineName;
  if (!nameToSearch) return null;

  // Escape special chars for LIKE query
  const safeName = nameToSearch.replace(/[%_\\]/g, '\\$&');

  // Search by asset_name (case-insensitive)
  const { data: byAssetName } = await supabase
    .from('deals')
    .select('id, territories_included')
    .ilike('asset_name', `%${safeName}%`)
    .limit(1)
    .single();

  if (byAssetName) return byAssetName;

  // Also try active substance if available
  if (medicine.activeSubstance) {
    const safeSubstance = medicine.activeSubstance.replace(/[%_\\]/g, '\\$&');
    const { data: bySubstance } = await supabase
      .from('deals')
      .select('id, territories_included')
      .ilike('asset_name', `%${safeSubstance}%`)
      .limit(1)
      .single();

    if (bySubstance) return bySubstance;
  }

  return null;
}

/**
 * Enrich an existing deal by adding 'EU' to territories_included.
 */
async function enrichDealWithEU(
  supabase: SupabaseClient,
  dealId: string,
  currentTerritories: string[]
): Promise<boolean> {
  const territories = currentTerritories || [];

  // Skip if EU is already included
  if (territories.includes('EU') || territories.includes('europe') || territories.includes('eu')) {
    return false;
  }

  const updatedTerritories = [...territories, 'EU'];

  const { error } = await supabase
    .from('deals')
    .update({
      territories_included: updatedTerritories,
      extraction_notes: `EU territory added via EMA CHMP positive opinion. Updated ${new Date().toISOString().split('T')[0]}.`,
    })
    .eq('id', dealId);

  if (error) {
    console.error(`[ema] Failed to enrich deal ${dealId}:`, error.message);
    return false;
  }

  return true;
}

// === Main Ingestion Function ===

export async function runEMAIngestion(
  supabase: SupabaseClient,
  options?: { daysBack?: number }
): Promise<{
  processed: number;
  inserted: number;
  enriched: number;
  errors: string[];
}> {
  const daysBack = options?.daysBack ?? 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const errors: string[] = [];
  let processed = 0;
  let inserted = 0;
  let enriched = 0;

  console.log(`[ema] Starting EMA ingestion (last ${daysBack} days)...`);

  // Fetch RSS feed
  const items = await fetchEMARSSFeed();
  console.log(`[ema] Fetched ${items.length} RSS items`);

  if (items.length === 0) {
    console.log('[ema] No items from RSS feed, finishing.');
    await logIngestion(supabase, 0, 0, 0, 0, errors);
    return { processed: 0, inserted: 0, enriched: 0, errors };
  }

  for (const item of items) {
    try {
      const medicine = parseEMAItem(item);

      // Filter by date window
      const itemDate = new Date(medicine.opinionDate);
      if (itemDate < cutoffDate) continue;

      // Only process positive opinions/authorizations
      if (!medicine.isPositiveOpinion) continue;

      processed++;

      // Check if we've already processed this item (by source_url or source_filing_id)
      const { data: existingBySource } = await supabase
        .from('deals')
        .select('id')
        .eq('source_filing_id', medicine.guid)
        .limit(1)
        .single();

      if (existingBySource) continue;

      // Try to find a matching existing deal
      const existingDeal = await findMatchingDeal(supabase, medicine);

      if (existingDeal) {
        // Enrich existing deal with EU territory
        const wasEnriched = await enrichDealWithEU(
          supabase,
          existingDeal.id,
          existingDeal.territories_included
        );
        if (wasEnriched) {
          enriched++;
          console.log(`[ema] Enriched deal ${existingDeal.id} with EU territory for ${medicine.medicineName}`);
        }
      } else {
        // Insert as new deal
        const indicationCategory = mapToIndicationCategory(medicine);
        const therapeuticArea = deriveTherapeuticArea(indicationCategory);

        // Try to match MAH to a company
        const mahCompanyId = medicine.mah ? await matchMAHToCompany(supabase, medicine.mah) : null;

        const { error: insertError } = await supabase.from('deals').insert({
          licensor_name: medicine.mah || 'Unknown',
          licensor_id: mahCompanyId,
          licensee_name: 'EMA Approval',
          licensee_id: null,
          asset_name: medicine.medicineName,
          asset_description: medicine.activeSubstance
            ? `${medicine.activeSubstance} - ${medicine.indication || 'EMA approved medicine'}`
            : medicine.indication || 'EMA approved medicine',
          modality: 'other',
          indication_category: indicationCategory,
          indication_specific: medicine.indication ? medicine.indication.substring(0, 255) : null,
          target: null,
          mechanism_of_action: null,
          phase_at_signing: 'approved',
          territory: 'europe',
          territories_included: ['EU'],
          exclusivity: 'unknown',
          deal_type: 'other',
          upfront_usd: null,
          milestones_total_usd: null,
          milestones_development_usd: null,
          milestones_regulatory_usd: null,
          milestones_commercial_usd: null,
          royalty_low_pct: null,
          royalty_high_pct: null,
          total_deal_value_usd: null,
          equity_investment_usd: null,
          includes_manufacturing: false,
          includes_co_development: false,
          includes_co_promotion: false,
          option_exercise_fee: null,
          announced_date: medicine.opinionDate,
          source_type: 'ema_opinion',
          source_url: medicine.sourceUrl,
          source_filing_id: medicine.guid,
          terms_disclosed: false,
          confidence_score: 90,
          extraction_notes: `EMA CHMP positive opinion. MAH: ${medicine.mah || 'unknown'}. Active substance: ${medicine.activeSubstance || 'unknown'}.`,
          extraction_model: null,
          extraction_timestamp: new Date().toISOString(),
          therapeutic_area: therapeuticArea,
        });

        if (insertError) {
          if (insertError.code !== '23505') {
            // Skip duplicate key errors
            errors.push(`Insert error for ${medicine.medicineName}: ${insertError.message}`);
          }
        } else {
          inserted++;
          console.log(`[ema] Inserted new deal: ${medicine.medicineName} (MAH: ${medicine.mah || 'unknown'})`);
        }
      }

      // Rate limiting - be respectful to EMA servers
      await sleep(500);
    } catch (error) {
      const errorMsg = `[ema] Error processing item "${item.title}": ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  // Log ingestion to data_ingestion_log
  await logIngestion(supabase, items.length, processed, inserted, errors.length, errors);

  console.log(`[ema] Done: ${items.length} fetched, ${processed} positive opinions, ${inserted} inserted, ${enriched} enriched, ${errors.length} errors`);

  return { processed, inserted, enriched, errors };
}

// === Helpers ===

async function logIngestion(
  supabase: SupabaseClient,
  fetched: number,
  processed: number,
  inserted: number,
  failed: number,
  errors: string[]
): Promise<void> {
  try {
    await supabase.from('data_ingestion_log').insert({
      source: 'ema',
      run_type: 'scheduled',
      parameters: { feed: EMA_CHMP_FEED },
      records_fetched: fetched,
      records_processed: processed,
      records_inserted: inserted,
      records_failed: failed,
      errors: errors.slice(0, 50),
      status: failed > 0 ? 'partial' : 'completed',
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ema] Failed to write ingestion log:', error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
