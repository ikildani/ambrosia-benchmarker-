// SEC EDGAR XBRL CompanyFacts Revenue Pipeline
// Fetches company-level annual revenue from structured XBRL filings

import type { SupabaseClient } from '@supabase/supabase-js';
import { PHARMA_CIKS } from './sec-edgar';

const SEC_XBRL_API = 'https://data.sec.gov/api/xbrl/companyfacts';
const USER_AGENT = 'Solidus research@ambrosiaventures.co';

// Revenue tags to try, in priority order
const REVENUE_TAGS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet',
  'SalesRevenueGoodsNet',
] as const;

interface XBRLUnit {
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

    // Try each revenue tag in priority order
    for (const tag of REVENUE_TAGS) {
      const tagData = usGaap[tag];
      if (!tagData?.units?.USD) continue;

      const units: XBRLUnit[] = tagData.units.USD;

      // Filter for annual 10-K filings only
      const annualFilings = units.filter(
        (u) => u.form === '10-K' && u.fp === 'FY'
      );

      if (annualFilings.length === 0) continue;

      // Sort by fiscal year descending, take most recent
      annualFilings.sort((a, b) => b.fy - a.fy);
      const mostRecent = annualFilings[0];

      return {
        cik,
        companyName,
        totalRevenue: mostRecent.val,
        fiscalYear: mostRecent.fy,
        fiscalPeriod: mostRecent.fp,
        revenueTag: tag,
        filedDate: mostRecent.filed,
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
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name, name_variations, sec_cik, total_annual_revenue');

  // Build lookup maps
  const nameToCompany = new Map<string, { id: string; name: string; sec_cik: string | null; total_annual_revenue: number | null }>();
  for (const c of allCompanies || []) {
    nameToCompany.set(c.name.toLowerCase(), c);
    for (const v of c.name_variations || []) {
      nameToCompany.set(v.toLowerCase(), c);
    }
  }

  const cikToCompany = new Map<string, { id: string; name: string; sec_cik: string | null; total_annual_revenue: number | null }>();
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

      // Backfill sec_cik if not already set
      if (!company.sec_cik) {
        await supabase
          .from('companies')
          .update({ sec_cik: cik, updated_at: new Date().toISOString() })
          .eq('id', company.id);
      }

      // Anomaly check: if new revenue > 10x existing AND existing is not null, flag and skip
      if (
        company.total_annual_revenue !== null &&
        company.total_annual_revenue > 0 &&
        revenue.totalRevenue > 10 * company.total_annual_revenue
      ) {
        console.warn(
          `ANOMALY: ${companyName} revenue ${revenue.totalRevenue} is >10x existing ${company.total_annual_revenue}. Skipping.`
        );
        result.skipped_anomalies++;
        continue;
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
