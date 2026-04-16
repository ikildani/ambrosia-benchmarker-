// SEC EDGAR Real-Time Monitor — runs every 2 hours
// Fast, frequent check for new 8-K filings with deal keywords

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import {
  extractDealFromFiling,
  findOrCreateCompany,
  deriveTherapeuticArea,
} from '@/lib/ingestion/sec-edgar';
import { notifyHighValueDeal } from '@/lib/slack/notify';
import { isTimeBudgetExceeded, logCronRun } from '@/lib/cron-utils';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const SEC_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT = 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co';

const DEAL_KEYWORDS = [
  'license',
  'licensing',
  'collaboration',
  'acquisition',
  'milestone',
  'royalt',
  'upfront',
  'partnership',
];

export async function GET(request: NextRequest) {
  // Auth: require CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';

  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;

  const isValid =
    isValidLength &&
    timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const TIME_BUDGET = 100_000; // 100s safe margin for 120s Vercel limit
  const errors: string[] = [];
  let fetched = 0;
  let processed = 0;
  let inserted = 0;
  let skippedKeyword = 0;
  let skippedDuplicate = 0;
  let highValueAlerts = 0;

  try {
    const supabase = createServiceClient();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Query SEC EDGAR full-text search for today's 8-K filings
    const today = new Date().toISOString().split('T')[0];
    const searchUrl = `${SEC_SEARCH_URL}?q=%228-K%22&forms=8-K&dateRange=custom&startdt=${today}&enddt=${today}`;

    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });

    if (!searchResponse.ok) {
      const errText = await searchResponse.text().catch(() => 'unknown');
      console.error(`[edgar-realtime] SEC search failed: ${searchResponse.status} ${errText}`);
      await logCronRun(supabase, 'edgar_realtime', {
        fetched: 0,
        processed: 0,
        inserted: 0,
        errors: [`SEC search failed: ${searchResponse.status}`],
      });
      return NextResponse.json(
        { error: 'SEC EDGAR search failed', status: searchResponse.status },
        { status: 502 }
      );
    }

    const searchData = await searchResponse.json();
    const hits = searchData.hits?.hits || searchData.filings || [];
    fetched = hits.length;

    // Process each filing (time-budgeted)
    for (const hit of hits) {
      if (isTimeBudgetExceeded(startTime, TIME_BUDGET)) {
        break;
      }

      try {
        // SEC full-text search returns hits with _id = "{adsh}:{filename}"
        // and _source.ciks = ["0001234567"]. No direct URL — we construct:
        // https://www.sec.gov/Archives/edgar/data/{cik}/{adsh-no-dashes}/{filename}
        const accessionNumber =
          hit._source?.adsh ||
          hit._source?.accession_no ||
          hit.accession_no ||
          (typeof hit._id === 'string' ? hit._id.split(':')[0] : undefined);

        const filename =
          (typeof hit._id === 'string' && hit._id.includes(':')
            ? hit._id.split(':')[1]
            : undefined);

        const cikRaw: string | undefined = hit._source?.ciks?.[0] || hit._source?.cik;
        const cik = cikRaw ? String(cikRaw).replace(/^0+/, '') : undefined;

        // Legacy path kept as last-resort fallback
        const legacyUrl =
          hit._source?.file_url ||
          hit.file_url ||
          hit._source?.document_url ||
          hit.document_url ||
          hit.url;

        let filingUrl: string | undefined;
        if (cik && accessionNumber && filename) {
          const adshFlat = accessionNumber.replace(/-/g, '');
          filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${adshFlat}/${filename}`;
        } else if (legacyUrl) {
          filingUrl = legacyUrl;
        }

        if (!filingUrl || !accessionNumber) {
          errors.push(`Skipped hit without resolvable URL (id=${hit._id ?? 'unknown'})`);
          continue;
        }

        // Check if already processed
        const { data: existing } = await supabase
          .from('deals')
          .select('id')
          .eq('source_filing_id', accessionNumber)
          .limit(1)
          .maybeSingle();

        if (existing) {
          skippedDuplicate++;
          continue;
        }

        // Fetch filing text
        const fullUrl = filingUrl.startsWith('http')
          ? filingUrl
          : `https://www.sec.gov/Archives/${filingUrl}`;

        const filingResponse = await fetch(fullUrl, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(10_000),
        });

        if (!filingResponse.ok) {
          errors.push(`Failed to fetch filing ${accessionNumber}: ${filingResponse.status}`);
          continue;
        }

        let filingText = await filingResponse.text();

        // Strip HTML tags for keyword search
        const plainText = filingText.replace(/<[^>]*>/g, ' ').toLowerCase();

        // Quick keyword filter — skip if no deal-related terms
        const hasDealKeyword = DEAL_KEYWORDS.some((kw) => plainText.includes(kw));
        if (!hasDealKeyword) {
          skippedKeyword++;
          continue;
        }

        // Truncate for AI extraction (match existing pattern)
        filingText = filingText.substring(0, 20000);

        // Send to Claude for deal extraction
        const deal = await extractDealFromFiling(filingText, anthropicApiKey);
        processed++;

        if (deal && deal.confidence_score >= 75) {
          // Validate company names
          if (!deal.licensor?.trim() || !deal.licensee?.trim()) {
            continue;
          }

          // Check for duplicate by licensor + licensee match (same-day filings)
          const { data: duplicateDeal } = await supabase
            .from('deals')
            .select('id')
            .ilike('licensor_name', deal.licensor.trim())
            .ilike('licensee_name', deal.licensee.trim())
            .gte('announced_date', today)
            .limit(1)
            .maybeSingle();

          if (duplicateDeal) {
            skippedDuplicate++;
            continue;
          }

          // Find or create companies
          const licensorId = await findOrCreateCompany(supabase, deal.licensor.trim(), false);
          const licenseeId = await findOrCreateCompany(supabase, deal.licensee.trim(), true);
          const therapeuticArea = deriveTherapeuticArea(deal.indication_category);

          // Insert deal
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
            announced_date: today,
            source_type: 'sec_8k_realtime',
            source_url: fullUrl,
            source_filing_id: accessionNumber,
            terms_disclosed: deal.upfront_usd !== null || deal.milestones_total_usd !== null,
            confidence_score: deal.confidence_score,
            extraction_model: 'claude-opus-4-6',
            extraction_timestamp: new Date().toISOString(),
            therapeutic_area: therapeuticArea,
          });

          if (insertError) {
            // Skip duplicates silently (unique index catches them)
            if (insertError.code !== '23505') {
              errors.push(`Insert error for ${accessionNumber}: ${insertError.message}`);
            }
          } else {
            inserted++;

            // High-value deal alert: > $100M
            if (deal.total_deal_value_usd && deal.total_deal_value_usd > 100_000_000) {
              try {
                await notifyHighValueDeal({
                  licensee: deal.licensee,
                  licensor: deal.licensor,
                  asset: deal.asset_name || 'Undisclosed',
                  totalValue: deal.total_deal_value_usd,
                  dealType: deal.deal_type || 'unknown',
                  therapeuticArea,
                  announcedDate: today,
                });
                highValueAlerts++;
              } catch (slackErr) {
                console.error('[edgar-realtime] Slack alert failed (non-fatal):', slackErr);
              }
            }
          }
        }

        // Rate limiting — SEC asks for max 10 req/sec
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (filingError) {
        const msg = `Filing processing error: ${filingError}`;
        console.error(`[edgar-realtime] ${msg}`);
        errors.push(msg);
      }
    }

    // Log cron run
    await logCronRun(supabase, 'edgar_realtime', {
      fetched,
      processed,
      inserted,
      errors,
      parameters: {
        date: today,
        skippedKeyword,
        skippedDuplicate,
        highValueAlerts,
      },
    });

    return NextResponse.json({
      success: true,
      date: today,
      fetched,
      processed,
      inserted,
      skippedKeyword,
      skippedDuplicate,
      highValueAlerts,
      errors: errors.length,
    });
  } catch (error) {
    console.error('[edgar-realtime] Fatal error:', error);

    try {
      const supabase = createServiceClient();
      await logCronRun(supabase, 'edgar_realtime', {
        fetched,
        processed,
        inserted,
        errors: [...errors, String(error)],
      });
    } catch {
      // logging failure is non-fatal
    }

    return NextResponse.json({ error: 'Edgar realtime monitor failed' }, { status: 500 });
  }
}
