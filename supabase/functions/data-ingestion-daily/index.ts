// Supabase Edge Function: Daily Data Ingestion
// Runs daily at 6 AM UTC via pg_cron
// Sources: SEC EDGAR (8-K filings)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

// SEC EDGAR full-text search endpoint
const SEC_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';

// Deal search terms
const DEAL_SEARCH_TERMS = [
  '"license agreement"',
  '"collaboration agreement"',
  '"exclusive license"',
  '"option agreement"',
  '"co-development agreement"',
];

interface SECFiling {
  accessionNumber: string;
  cik: string;
  companyName: string;
  filingDate: string;
  form: string;
  documentUrl: string;
}

interface ExtractedDeal {
  licensor: string;
  licensee: string;
  asset_name: string | null;
  modality: string;
  indication_category: string | null;
  indication_specific: string | null;
  phase_at_signing: string;
  territory: string | null;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  confidence_score: number;
}

Deno.serve(async (req) => {
  // Verify authorization - use SERVICE_ROLE_KEY (not SUPABASE_ prefix which is reserved)
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');

  const isValidAuth =
    authHeader === `Bearer ${serviceRoleKey}` ||
    authHeader === `Bearer ${cronSecret}`;

  if (!isValidAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey!
  );

  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Log ingestion start
  const { data: logEntry } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'sec_edgar',
      run_type: 'scheduled',
      parameters: { daysBack: 1 },
    })
    .select('id')
    .single();

  const logId = logEntry?.id;
  const errors: string[] = [];
  let processed = 0;
  let dealsExtracted = 0;
  let skipped = 0;

  try {
    // Search for recent filings
    const filings = await searchRecentFilings(1);
    console.log(`Found ${filings.length} potential filings`);

    for (const filing of filings) {
      try {
        // Check if already processed
        const { data: existing } = await supabase
          .from('deals')
          .select('id')
          .eq('source_filing_id', filing.accessionNumber)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Fetch filing content
        const content = await fetchFilingContent(filing.documentUrl);

        // Extract deal using Claude
        const deal = await extractDealFromFiling(content, anthropicApiKey);

        if (deal && deal.confidence_score >= 50) {
          // Find or create companies
          const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
          const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);

          // Insert deal
          const { error: insertError } = await supabase.from('deals').insert({
            licensor_name: deal.licensor,
            licensor_id: licensorId,
            licensee_name: deal.licensee,
            licensee_id: licenseeId,
            asset_name: deal.asset_name,
            modality: deal.modality,
            indication_category: deal.indication_category,
            indication_specific: deal.indication_specific,
            phase_at_signing: deal.phase_at_signing,
            territory: deal.territory,
            deal_type: deal.deal_type,
            upfront_usd: deal.upfront_usd,
            milestones_total_usd: deal.milestones_total_usd,
            royalty_low_pct: deal.royalty_low_pct,
            royalty_high_pct: deal.royalty_high_pct,
            announced_date: filing.filingDate,
            source_type: 'sec_8k',
            source_url: filing.documentUrl,
            source_filing_id: filing.accessionNumber,
            terms_disclosed: deal.upfront_usd !== null,
            confidence_score: deal.confidence_score,
            extraction_model: 'claude-sonnet-4-20250514',
            extraction_timestamp: new Date().toISOString(),
          });

          if (insertError) {
            errors.push(`Insert error: ${insertError.message}`);
          } else {
            dealsExtracted++;
            console.log(`Extracted: ${deal.licensor} -> ${deal.licensee}`);
          }
        }

        processed++;

        // Rate limiting
        await sleep(1000);

      } catch (error) {
        errors.push(`Error processing ${filing.accessionNumber}: ${error}`);
      }
    }

    // Update log
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          records_fetched: filings.length,
          records_processed: processed,
          records_inserted: dealsExtracted,
          records_skipped: skipped,
          records_failed: errors.length,
          errors: errors.slice(0, 20),
          status: errors.length > 0 ? 'partial' : 'completed',
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({
      success: true,
      filings_found: filings.length,
      processed,
      deals_extracted: dealsExtracted,
      skipped,
      errors: errors.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          errors: [String(error)],
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function searchRecentFilings(daysBack: number): Promise<SECFiling[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const allFilings: SECFiling[] = [];
  const seenAccessions = new Set<string>();

  for (const term of DEAL_SEARCH_TERMS) {
    try {
      const params = new URLSearchParams({
        q: term,
        dateRange: 'custom',
        startdt: formatDate(startDate),
        enddt: formatDate(endDate),
        forms: '8-K,8-K/A',
        from: '0',
        size: '50',
      });

      const response = await fetch(`${SEC_SEARCH_URL}?${params}`, {
        headers: {
          'User-Agent': 'Ambrosia Ventures research@ambrosiaventures.co',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          const accession = hit._source.accession_number;
          if (seenAccessions.has(accession)) continue;
          seenAccessions.add(accession);

          const accessionFormatted = accession.replace(/-/g, '');

          allFilings.push({
            accessionNumber: accession,
            cik: hit._source.cik,
            companyName: hit._source.display_names?.[0] || 'Unknown',
            filingDate: hit._source.file_date,
            form: hit._source.form,
            documentUrl: `https://www.sec.gov/Archives/edgar/data/${hit._source.cik}/${accessionFormatted}/${hit._source.file_name}`,
          });
        }
      }

      await sleep(200);
    } catch (error) {
      console.error(`Search error for "${term}":`, error);
    }
  }

  return allFilings;
}

async function fetchFilingContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Ambrosia Ventures research@ambrosiaventures.co',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filing: ${response.status}`);
  }

  const html = await response.text();

  // Extract text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  return text.substring(0, 15000);
}

async function extractDealFromFiling(
  filingText: string,
  apiKey: string
): Promise<ExtractedDeal | null> {
  const anthropic = new Anthropic({ apiKey });

  const prompt = `Extract licensing deal info from this SEC 8-K filing. Return ONLY JSON.

If NOT a biopharma licensing deal, return: {"is_deal": false}

If it IS a deal, return:
{
  "licensor": "company granting rights",
  "licensee": "company receiving rights",
  "asset_name": "drug name or null",
  "modality": "small_molecule|antibody|adc|bispecific|car_t|cell_therapy|gene_therapy|mrna|radiopharm|other",
  "indication_category": "solid_tumor|hematological|autoimmune|cns|rare_disease|infectious|other|null",
  "indication_specific": "specific disease or null",
  "phase_at_signing": "preclinical|phase_1|phase_2|phase_3|approved|unknown",
  "territory": "global|us|ex_us|china|japan|regional|null",
  "deal_type": "license|option|collaboration|acquisition|other",
  "upfront_usd": number or null,
  "milestones_total_usd": number or null,
  "royalty_low_pct": decimal (0.10 for 10%) or null,
  "royalty_high_pct": decimal or null,
  "confidence_score": 0-100
}

Filing:
${filingText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.is_deal === false) return null;

    return parsed as ExtractedDeal;
  } catch (error) {
    console.error('Extraction error:', error);
    return null;
  }
}

async function findOrCreateCompany(
  supabase: any,
  companyName: string,
  isLicensee: boolean
): Promise<string | null> {
  if (!companyName) return null;

  const normalizedName = companyName
    .replace(/,?\s*(Inc\.?|Corp\.?|Ltd\.?|LLC|LP)$/i, '')
    .trim();

  // Try to find existing
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', `%${normalizedName}%`)
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new
  const { data: newCompany } = await supabase
    .from('companies')
    .insert({
      name: companyName,
      name_variations: [companyName],
      actively_acquiring: isLicensee,
      data_sources: ['sec_edgar'],
    })
    .select('id')
    .single();

  return newCompany?.id || null;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
