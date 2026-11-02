// SEC EDGAR XBRL CompanyFacts Revenue Pipeline
// Fetches company-level annual revenue from structured XBRL filings

import type { SupabaseClient } from '@supabase/supabase-js';
import { PHARMA_CIKS } from './sec-edgar';
import { secNameMatches } from './sec-name-match';

const SEC_XBRL_API = 'https://data.sec.gov/api/xbrl/companyfacts';
const USER_AGENT = 'Solidus research@ambrosiaventures.co';

// Revenue tags to try, in priority order
const REVENUE_TAGS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet',
  'SalesRevenueGoodsNet',
] as const;

export interface XBRLUnit {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;    // FY, Q1, Q2, Q3, Q4
  form: string;  // 10-K, 10-Q
  filed: string;
}

export interface CompanyRevenue {
  cik: string;
  companyName: string;
  totalRevenue: number;
  fiscalYear: number;
  fiscalPeriod: string;
  revenueTag: string;
  filedDate: string;
}

export interface XBRLResult {
  processed: number;
  updated: number;
  skipped_anomalies: number;
  errors: string[];
}

const DAY_MS = 86_400_000;

/**
 * The latest full-year revenue fact across REVENUE_TAGS, by period end. `fy` is the fiscal year of
 * the filing, not of the figure (each 10-K restates two prior years under the same fy), and a
 * company that moved from Revenues to RevenueFromContractWithCustomer... keeps its old tag's last
 * year forever (Amgen and Gilead showed FY2020 on Nov 2 2026). Tag order only breaks ties.
 */
export function latestAnnualRevenue(usGaap: Record<string, { units?: { USD?: XBRLUnit[] } }>): { tag: string; fact: XBRLUnit } | null {
  let best: { tag: string; fact: XBRLUnit; rank: number } | null = null;
  for (const [rank, tag] of REVENUE_TAGS.entries()) {
    for (const u of usGaap[tag]?.units?.USD ?? []) {
      if (!/^10-K/.test(u.form) || !u.start || !(u.val > 0)) continue;
      const days = (Date.parse(u.end) - Date.parse(u.start)) / DAY_MS;
      if (!(days >= 350 && days <= 380)) continue;
      const better = !best
        || u.end > best.fact.end
        || (u.end === best.fact.end && (rank < best.rank || (rank === best.rank && u.filed > best.fact.filed)));
      if (better) best = { tag, fact: u, rank };
    }
  }
  return best ? { tag: best.tag, fact: best.fact } : null;
}

/**
 * Fetch the most recent annual revenue for a company from SEC XBRL CompanyFacts API.
 */
export async function fetchCompanyRevenue(cik: string): Promise<CompanyRevenue | null> {
  const paddedCik = cik.padStart(10, '0');
  const url = `${SEC_XBRL_API}/CIK${paddedCik}.json`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No XBRL data for CIK ${cik}`);
        return null;
      }
      throw new Error(`XBRL API returned ${response.status} for CIK ${cik}`);
    }

    const data = await response.json();
    const companyName = data.entityName || PHARMA_CIKS[cik] || 'Unknown';
    const usGaap = data.facts?.['us-gaap'];

    if (!usGaap) {
      console.log(`No us-gaap facts for CIK ${cik} (${companyName})`);
      return null;
    }

    const latest = latestAnnualRevenue(usGaap);
    if (latest) {
      return {
        cik,
        companyName,
        totalRevenue: latest.fact.val,
        fiscalYear: Number(latest.fact.end.slice(0, 4)),
        fiscalPeriod: 'FY',
        revenueTag: latest.tag,
        filedDate: latest.fact.filed,
      };
    }

    console.log(`No revenue tags found for CIK ${cik} (${companyName})`);
    return null;
  } catch (error) {
    console.error(`Error fetching XBRL for CIK ${cik}:`, error);
    return null;
  }
}

/**
 * Batch runner: fetch XBRL revenue for all tracked pharma companies
 * and update the companies table in Supabase.
 */
export async function runXBRLRevenueUpdate(supabase: SupabaseClient): Promise<XBRLResult> {
  console.log('Starting XBRL revenue update...');

  const result: XBRLResult = {
    processed: 0,
    updated: 0,
    skipped_anomalies: 0,
    errors: [],
  };

  // Log ingestion start
  const { data: logEntry } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'sec_xbrl',
      run_type: 'scheduled',
      parameters: { cik_count: Object.keys(PHARMA_CIKS).length },
    })
    .select('id')
    .single();

  const logId = logEntry?.id;

  // Fetch all companies with their name variations for matching
  // Paged: a bare select stops at PostgREST's 1,000-row cap, which left all but a handful of the
  // ~36k companies unmatched (Nov 2 2026: 2 of 180 filers updated).
  const allCompanies: Array<{ id: string; name: string; name_variations: string[] | null; sec_cik: string | null; total_annual_revenue: number | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error: pageError } = await supabase
      .from('companies')
      .select('id, name, name_variations, sec_cik, total_annual_revenue')
      .is('merged_into', null)
      .order('id')
      .range(from, from + 999);
    if (pageError) {
      result.errors.push(`companies read: ${pageError.message}`);
      break;
    }
    allCompanies.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }

  // Build lookup maps
  const nameToCompany = new Map<string, { id: string; name: string; name_variations: string[] | null; sec_cik: string | null; total_annual_revenue: number | null }>();
  for (const c of allCompanies || []) {
    nameToCompany.set(c.name.toLowerCase(), c);
    for (const v of c.name_variations || []) {
      nameToCompany.set(v.toLowerCase(), c);
    }
  }

  const cikToCompany = new Map<string, { id: string; name: string; name_variations: string[] | null; sec_cik: string | null; total_annual_revenue: number | null }>();
  for (const c of allCompanies || []) {
    if (c.sec_cik) {
      cikToCompany.set(c.sec_cik, c);
    }
  }

  const cikEntries = Object.entries(PHARMA_CIKS);

  for (let i = 0; i < cikEntries.length; i++) {
    const [cik, companyName] = cikEntries[i];

    try {
      // Rate limiting: 100ms between requests
      if (i > 0) {
        await sleep(100);
      }

      const revenue = await fetchCompanyRevenue(cik);
      result.processed++;

      if (!revenue) continue;

      // Match to companies table: first try CIK, then name matching
      let company = cikToCompany.get(cik);
      if (!company) {
        // Try direct name match
        company = nameToCompany.get(companyName.toLowerCase());
      }
      if (!company) {
        // Try the name from SEC data
        company = nameToCompany.get(revenue.companyName.toLowerCase());
      }

      if (!company) {
        console.log(`No company match for ${companyName} (CIK ${cik})`);
        continue;
      }

      // The filer behind this CIK must be this company, or its revenue (and the CIK) would
      // land on the wrong row.
      if (!secNameMatches(revenue.companyName, [company.name, ...(company.name_variations ?? [])])) {
        console.warn(`CIK ${cik} files as "${revenue.companyName}", not ${company.name}. Skipping.`);
        result.skipped_anomalies++;
        continue;
      }

      // Backfill sec_cik if not already set
      if (!company.sec_cik) {
        await supabase
          .from('companies')
          .update({ sec_cik: cik, updated_at: new Date().toISOString() })
          .eq('id', company.id);
      }

      // A >10x jump used to be skipped as a likely wrong filer. The filer-name check above now
      // catches that directly, and the skip froze stale figures left by the old fy-based pick
      // (Vertex stored $1.0B against $12.0B filed), so the jump is only logged.
      if (
        company.total_annual_revenue !== null &&
        company.total_annual_revenue > 0 &&
        revenue.totalRevenue > 10 * company.total_annual_revenue
      ) {
        console.warn(`Revenue jump: ${companyName} ${company.total_annual_revenue} -> ${revenue.totalRevenue} (filer verified).`);
      }

      // Update company revenue
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          total_annual_revenue: revenue.totalRevenue,
          revenue_fiscal_year: revenue.fiscalYear,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id);

      if (updateError) {
        result.errors.push(`Update error for ${companyName}: ${updateError.message}`);
      } else {
        result.updated++;
        console.log(
          `Updated ${companyName}: $${(revenue.totalRevenue / 1e9).toFixed(2)}B (FY${revenue.fiscalYear}, tag: ${revenue.revenueTag})`
        );
      }
    } catch (error) {
      const errorMsg = `Error processing CIK ${cik} (${companyName}): ${error}`;
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
        records_fetched: result.processed,
        records_processed: result.processed,
        records_inserted: result.updated,
        records_skipped: result.skipped_anomalies,
        records_failed: result.errors.length,
        errors: result.errors.slice(0, 50),
        status: result.errors.length > 0 ? 'partial' : 'completed',
      })
      .eq('id', logId);
  }

  console.log(
    `XBRL revenue update complete: ${result.processed} processed, ${result.updated} updated, ${result.skipped_anomalies} anomalies skipped`
  );

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
