/**
 * API Route: High-Volume SEC EDGAR 8-K Deal Backfill
 *
 * Unlike backfill-ta which searches for TA-specific terms (low yield),
 * this route searches for GENERIC deal terms filtered by Item 1.01
 * (Material Definitive Agreement) — the SEC form item specifically
 * for announcing new deals. Claude determines the TA from the content.
 *
 * This yields 3,500+ filings vs ~50 per TA with the old approach.
 *
 * POST /api/deals/backfill-8k?page=0&dealType=license
 *
 * dealType options: license, collaboration, option, acquisition
 * page: pagination offset (0-based, 20 results per page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  fetchFilingContent,
  extractDealFromFiling,
  findOrCreateCompany,
  deriveTherapeuticArea,
} from '@/lib/ingestion/sec-edgar';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_RUNTIME_MS = 260_000;
const SEC_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

// Generic deal search queries — Item 1.01 filtering ensures these are actual deals
const DEAL_SEARCHES: Record<string, string> = {
  license: '"license agreement" "upfront" "milestone"',
  collaboration: '"collaboration agreement" "upfront"',
  option: '"option agreement" "pharma"',
  acquisition: '"acquisition" "merger agreement" "pharma"',
  codevelopment: '"co-development" "agreement" "pharma"',
  royalty: '"royalty" "license" "pharma" "milestone"',
};

interface Filing {
  accession: string;
  company: string;
  date: string;
  url: string;
  items: string[];
}

async function searchDealFilings(
  query: string,
  page: number = 0,
  size: number = 20
): Promise<{ total: number; filings: Filing[] }> {
  const params = new URLSearchParams({
    q: query,
    forms: '8-K,8-K/A,6-K',
    items: '1.01',
    from: String(page * size),
    size: String(size),
  });

  const response = await fetchWithTimeout(`${SEC_SEARCH}?${params}`, {
    headers: {
      'User-Agent': 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co',
      'Accept': 'application/json',
    },
    timeoutMs: 20_000,
    retries: 1,
  });

  if (!response.ok) return { total: 0, filings: [] };

  const data = await response.json();
  const total = data.hits?.total?.value || 0;
  const hits = data.hits?.hits || [];

  const filings = hits.map((hit: Record<string, any>) => {
    const docId = hit._id || '';
    const parts = docId.split(':');
    const accession = parts[0] || hit._source?.adsh || '';
    const fileName = parts[1] || '';
    const cik = (hit._source?.ciks?.[0] || '').replace(/^0+/, '');
    const accessionFormatted = accession.replace(/-/g, '');

    return {
      accession,
      company: hit._source?.display_names?.[0] || '',
      date: hit._source?.file_date || '',
      url: cik && accessionFormatted && fileName
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionFormatted}/${fileName}`
        : '',
      items: hit._source?.items || [],
    };
  });

  return { total, filings };
}

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const startTime = Date.now();

  const url = new URL(request.url);
  const dealType = url.searchParams.get('dealType') || 'license';
  const page = parseInt(url.searchParams.get('page') || '0', 10);

  const query = DEAL_SEARCHES[dealType];
  if (!query) {
    return NextResponse.json({
      error: `Invalid dealType. Options: ${Object.keys(DEAL_SEARCHES).join(', ')}`,
    }, { status: 400 });
  }

  console.log(`[backfill-8k] Searching "${dealType}" deals, page ${page}...`);

  const { total, filings } = await searchDealFilings(query, page);
  console.log(`[backfill-8k] Found ${total} total filings, processing page ${page} (${filings.length} filings)`);

  const result = {
    dealType,
    page,
    totalAvailable: total,
    searched: filings.length,
    fetched: 0,
    extracted: 0,
    inserted: 0,
    skipped_existing: 0,
    skipped_short: 0,
    skipped_not_deal: 0,
    byTA: {} as Record<string, number>,
    byDealType: {} as Record<string, number>,
    errors: [] as string[],
  };

  for (const filing of filings) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log(`[backfill-8k] Time budget exceeded, stopping`);
      break;
    }

    if (!filing.url) continue;

    // Check if already processed
    const { data: existing } = await supabase
      .from('deals')
      .select('id')
      .eq('source_url', filing.url)
      .limit(1)
      .single();

    if (existing) {
      result.skipped_existing++;
      continue;
    }

    try {
      const content = await fetchFilingContent(filing.url);
      result.fetched++;

      if (content.length < 500) {
        result.skipped_short++;
        continue;
      }

      const deal = await extractDealFromFiling(content, anthropicApiKey);

      if (!deal || deal.confidence_score < 75 || !deal.licensor || !deal.licensee) {
        result.skipped_not_deal++;
        continue;
      }

      result.extracted++;

      const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
      const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);
      const ta = deriveTherapeuticArea(deal.indication_category);

      const { error: insertError } = await supabase.from('deals').insert({
        licensor_name: deal.licensor,
        licensor_id: licensorId,
        licensee_name: deal.licensee,
        licensee_id: licenseeId,
        asset_name: deal.asset_name,
        asset_description: deal.extraction_notes,
        modality: deal.modality,
        indication_category: deal.indication_category,
        indication_specific: deal.indication_specific,
        target: deal.target,
        mechanism_of_action: deal.mechanism_of_action,
        phase_at_signing: deal.phase_at_signing,
        territory: deal.territory || 'global',
        deal_type: deal.deal_type,
        upfront_usd: deal.upfront_usd,
        milestones_total_usd: deal.milestones_total_usd,
        milestones_development_usd: deal.milestones_development_usd,
        milestones_regulatory_usd: deal.milestones_regulatory_usd,
        milestones_commercial_usd: deal.milestones_commercial_usd,
        royalty_low_pct: deal.royalty_low_pct,
        royalty_high_pct: deal.royalty_high_pct,
        total_deal_value_usd: deal.total_deal_value_usd,
        announced_date: filing.date || new Date().toISOString().split('T')[0],
        source_type: 'sec_8k',
        source_url: filing.url,
        terms_disclosed: deal.upfront_usd !== null || deal.milestones_total_usd !== null,
        confidence_score: deal.confidence_score,
        extraction_notes: deal.extraction_notes,
        extraction_model: 'claude-sonnet-4-20250514',
        extraction_timestamp: new Date().toISOString(),
        therapeutic_area: ta,
        milestone_details: deal.milestone_details,
        research_funding_usd: deal.research_funding_usd,
        profit_share_pct: deal.profit_share_pct,
        cost_share_ratio: deal.cost_share_ratio,
        opt_in_rights: deal.opt_in_rights,
        opt_in_stage: deal.opt_in_stage,
        regulatory_designations: deal.regulatory_designations,
        term_years: deal.term_years,
        sublicense_rights: deal.sublicense_rights,
        rights_retained: deal.rights_retained,
        indications_licensed: deal.indications_licensed,
        includes_diagnostics: deal.includes_diagnostics,
      });

      if (insertError) {
        if (insertError.code !== '23505') {
          result.errors.push(insertError.message);
        }
      } else {
        result.inserted++;
        result.byTA[ta] = (result.byTA[ta] || 0) + 1;
        result.byDealType[deal.deal_type || 'unknown'] = (result.byDealType[deal.deal_type || 'unknown'] || 0) + 1;
        console.log(`[backfill-8k] +1 ${ta} ${deal.deal_type}: ${deal.licensor} → ${deal.licensee} (${deal.indication_specific || deal.indication_category})`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      result.errors.push(`${filing.url}: ${err}`);
    }
  }

  // Log
  await supabase.from('data_ingestion_log').insert({
    source: 'backfill_8k_item101',
    run_type: 'manual',
    parameters: { dealType, page, query },
    records_fetched: result.fetched,
    records_processed: result.extracted,
    records_inserted: result.inserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, ...result });
}
