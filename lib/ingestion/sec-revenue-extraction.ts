// SEC 10-K Product-Level Revenue Extraction
// Uses Claude Sonnet to extract per-drug revenue from 10-K filing text

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const SEC_SUBMISSIONS_API = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co';

export interface ProductRevenue {
  drug_name: string;
  revenue_usd: number;
  fiscal_year: number;
  confidence: number;
}

export interface ProductRevenueExtractionResult {
  companies_processed: number;
  products_extracted: number;
  patent_cliffs_updated: number;
  errors: string[];
}

/**
 * Use Claude Sonnet to extract per-product revenue from a 10-K filing excerpt.
 */
export async function extractProductRevenue(params: {
  filingText: string;
  anthropicApiKey: string;
  companyName: string;
  knownDrugs: string[];
}): Promise<ProductRevenue[]> {
  const { filingText, anthropicApiKey, companyName, knownDrugs } = params;

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const systemPrompt = `You are a pharmaceutical financial analyst extracting product-level revenue data from SEC 10-K filings. Be precise and conservative. Only extract revenue figures that are clearly and explicitly stated in the filing text.`;

  const userPrompt = `Extract product-level revenue from this 10-K filing excerpt for ${companyName}. Known drug names: ${knownDrugs.join(', ')}. Return JSON array of {"drug_name", "revenue_usd" (annual, in USD not millions), "fiscal_year", "confidence" (0-100)}. Only include drugs with clearly stated revenue figures.

Filing text:
${filingText.substring(0, 30000)}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    // Parse JSON array from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as ProductRevenue[];

    // Validate each entry
    return parsed.filter(
      (p) =>
        typeof p.drug_name === 'string' &&
        typeof p.revenue_usd === 'number' &&
        p.revenue_usd > 0 &&
        typeof p.fiscal_year === 'number' &&
        typeof p.confidence === 'number' &&
        p.confidence >= 0 &&
        p.confidence <= 100
    );
  } catch (error) {
    console.error(`Product revenue extraction error for ${companyName}:`, error);
    return [];
  }
}

/**
 * Fetch the text content of a 10-K filing from SEC EDGAR.
 */
async function fetchFilingText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filing: ${response.status}`);
  }

  const html = await response.text();

  // Strip HTML to plain text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.substring(0, 30000);
}

/**
 * Search SEC EFTS for a company's most recent 10-K filing containing revenue data.
 */
async function findLatest10K(cik: string): Promise<{ url: string; filedDate: string } | null> {
  const paddedCik = cik.padStart(10, '0');

  try {
    const response = await fetch(`${SEC_SUBMISSIONS_API}/CIK${paddedCik}.json`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`SEC submissions API failed for CIK ${cik}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const recent = data.filings?.recent;
    if (!recent?.form?.length) return null;

    // Find most recent 10-K filing
    const forms: string[] = recent.form;
    const idx = forms.findIndex((f: string) => f === '10-K');
    if (idx === -1) return null;

    const accession = recent.accessionNumber[idx];
    const primaryDoc = recent.primaryDocument[idx];
    const filedDate = recent.filingDate[idx];
    const accessionFormatted = accession.replace(/-/g, '');

    return {
      url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionFormatted}/${primaryDoc}`,
      filedDate,
    };
  } catch (error) {
    console.error(`SEC submissions lookup error for CIK ${cik}:`, error);
    return null;
  }
}

/**
 * Run product-level revenue extraction for top companies.
 * Fetches 10-K filings, extracts per-drug revenue via Claude, and updates drug_revenues + patent_cliffs.
 */
export async function runProductRevenueExtraction(
  supabase: SupabaseClient,
  options?: { topCompanies?: number }
): Promise<ProductRevenueExtractionResult> {
  const topN = options?.topCompanies ?? 20;
  console.log(`Starting product revenue extraction for top ${topN} companies...`);

  const result: ProductRevenueExtractionResult = {
    companies_processed: 0,
    products_extracted: 0,
    patent_cliffs_updated: 0,
    errors: [],
  };

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    result.errors.push('ANTHROPIC_API_KEY not configured');
    return result;
  }

  // Get top N companies by total_annual_revenue
  const { data: companies, error: companiesError } = await supabase
    .from('companies')
    .select('id, name, sec_cik, total_annual_revenue, patent_cliffs')
    .not('total_annual_revenue', 'is', null)
    .order('total_annual_revenue', { ascending: false })
    .limit(topN);

  if (companiesError || !companies) {
    result.errors.push(`Failed to fetch companies: ${companiesError?.message}`);
    return result;
  }

  // Log ingestion start
  const { data: logEntry } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'sec_xbrl',
      run_type: 'product_extraction',
      parameters: { top_companies: topN },
    })
    .select('id')
    .single();

  const logId = logEntry?.id;

  for (const company of companies) {
    try {
      if (!company.sec_cik) {
        console.log(`Skipping ${company.name}: no sec_cik`);
        continue;
      }

      // Find latest 10-K filing
      const filing = await findLatest10K(company.sec_cik);
      if (!filing) {
        console.log(`No recent 10-K found for ${company.name}`);
        continue;
      }

      // Fetch filing text
      const filingText = await fetchFilingText(filing.url);
      if (filingText.length < 500) {
        console.log(`Filing text too short for ${company.name}, skipping`);
        continue;
      }

      // Get known drug names from patent_cliffs JSONB
      const knownDrugs: string[] = [];
      if (Array.isArray(company.patent_cliffs)) {
        for (const cliff of company.patent_cliffs) {
          if (cliff.drug_name) {
            knownDrugs.push(cliff.drug_name);
          }
        }
      }

      // Extract product revenue via Claude
      const products = await extractProductRevenue({
        filingText,
        anthropicApiKey,
        companyName: company.name,
        knownDrugs,
      });

      result.companies_processed++;

      if (products.length === 0) {
        console.log(`No product revenue extracted for ${company.name}`);
        continue;
      }

      console.log(`Extracted ${products.length} products for ${company.name}`);

      // Upsert results into drug_revenues table
      for (const product of products) {
        const { error: upsertError } = await supabase
          .from('drug_revenues')
          .upsert(
            {
              company_id: company.id,
              company_name: company.name,
              drug_name: product.drug_name,
              drug_name_normalized: product.drug_name.toUpperCase().trim(),
              revenue_usd: product.revenue_usd,
              fiscal_year: product.fiscal_year,
              fiscal_period: 'FY',
              confidence_score: product.confidence,
              source: 'claude_extraction',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'company_id,drug_name_normalized,fiscal_year,fiscal_period' }
          );

        if (upsertError) {
          result.errors.push(`Upsert error for ${company.name}/${product.drug_name}: ${upsertError.message}`);
        } else {
          result.products_extracted++;
        }
      }

      // Update patent_cliffs with matched revenue data
      if (Array.isArray(company.patent_cliffs) && company.patent_cliffs.length > 0) {
        let cliffUpdated = false;
        const updatedCliffs = company.patent_cliffs.map((cliff: Record<string, unknown>) => {
          const match = products.find(
            (p) => p.drug_name.toLowerCase() === String(cliff.drug_name || '').toLowerCase()
          );
          if (match) {
            cliffUpdated = true;
            return { ...cliff, revenue_usd: match.revenue_usd };
          }
          return cliff;
        });

        if (cliffUpdated) {
          const { error: cliffError } = await supabase
            .from('companies')
            .update({
              patent_cliffs: updatedCliffs,
              updated_at: new Date().toISOString(),
            })
            .eq('id', company.id);

          if (cliffError) {
            result.errors.push(`Patent cliff update error for ${company.name}: ${cliffError.message}`);
          } else {
            result.patent_cliffs_updated++;
          }
        }
      }

      // Rate limiting between companies
      await sleep(500);
    } catch (error) {
      const errorMsg = `Error processing ${company.name}: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }
  }

  // Update log entry
  if (logId) {
    await supabase
      .from('data_ingestion_log')
      .update({
        completed_at: new Date().toISOString(),
        records_fetched: companies.length,
        records_processed: result.companies_processed,
        records_inserted: result.products_extracted,
        records_failed: result.errors.length,
        errors: result.errors.slice(0, 50),
        status: result.errors.length > 0 ? 'partial' : 'completed',
      })
      .eq('id', logId);
  }

  console.log(
    `Product revenue extraction complete: ${result.companies_processed} companies, ${result.products_extracted} products, ${result.patent_cliffs_updated} cliffs updated`
  );

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
