// NIH RePORTER API Ingestion
// Tracks NIH-funded research projects relevant to pharma companies and indications
// Provides funding signals that inform deal valuations

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const NIH_REPORTER_API = 'https://api.reporter.nih.gov/v2/projects/search';

// Top pharma/biotech companies to track NIH-funded collaborations
const TRACKED_ORGANIZATIONS = [
  'Pfizer', 'Merck', 'AbbVie', 'Gilead', 'Amgen', 'Regeneron', 'Eli Lilly',
  'Bristol-Myers Squibb', 'AstraZeneca', 'Novartis', 'Roche', 'Sanofi', 'GSK',
  'Moderna', 'Vertex', 'BioMarin', 'Incyte', 'Biogen', 'Alnylam', 'Ionis',
  'CRISPR Therapeutics', 'Intellia', 'Editas', 'Beam Therapeutics',
  'Bluebird Bio', 'Sarepta', 'Ultragenyx', 'Argenx',
  'Jazz Pharmaceuticals', 'Neurocrine', 'Blueprint Medicines',
];

// Disease-focused searches for deal-relevant research
const INDICATION_SEARCHES = [
  { term: 'CAR-T cell therapy', ta: 'oncology' },
  { term: 'bispecific antibody', ta: 'oncology' },
  { term: 'antibody drug conjugate', ta: 'oncology' },
  { term: 'immune checkpoint', ta: 'oncology' },
  { term: 'gene therapy rare disease', ta: 'rare_disease' },
  { term: 'CRISPR gene editing', ta: 'rare_disease' },
  { term: 'GLP-1 receptor agonist', ta: 'metabolic' },
  { term: 'antisense oligonucleotide', ta: 'neurology' },
  { term: 'siRNA therapeutics', ta: 'rare_disease' },
  { term: 'mRNA vaccine', ta: 'infectious_disease' },
  { term: 'radiopharmaceutical', ta: 'oncology' },
  { term: 'biologic autoimmune', ta: 'immunology' },
];

export interface NIHProject {
  project_num: string;
  project_title: string;
  abstract_text: string | null;
  pi_names: string[];
  organization_name: string;
  organization_city: string;
  organization_state: string;
  fiscal_year: number;
  award_amount: number;
  funding_mechanism: string;
  nih_institute: string;
  project_start_date: string | null;
  project_end_date: string | null;
  therapeutic_area: string | null;
}

async function searchNIHProjects(
  searchText: string,
  fiscalYears: number[],
  limit: number = 50,
  offset: number = 0
): Promise<NIHProject[]> {
  const body = {
    criteria: {
      advanced_text_search: {
        operator: 'and',
        search_field: 'projecttitle,terms',
        search_text: searchText,
      },
      fiscal_years: fiscalYears,
      exclude_subprojects: true,
    },
    offset,
    limit,
    sort_field: 'award_amount',
    sort_order: 'desc',
  };

  const response = await fetchWithTimeout(NIH_REPORTER_API, {
    method: 'POST',
    timeoutMs: 30_000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.warn(`[nih-reporter] Search failed: HTTP ${response.status}`);
    return [];
  }

  const data = await response.json();
  const results = data.results || [];

  return results.map((r: Record<string, any>) => ({
    project_num: r.project_num || '',
    project_title: r.project_title || '',
    abstract_text: r.abstract_text || null,
    pi_names: (r.principal_investigators || []).map(
      (pi: Record<string, string>) => `${pi.last_name || ''} ${pi.first_name || ''}`.trim()
    ),
    organization_name: r.organization?.org_name || '',
    organization_city: r.organization?.org_city || '',
    organization_state: r.organization?.org_state || '',
    fiscal_year: r.fiscal_year || 0,
    award_amount: r.award_amount || 0,
    funding_mechanism: r.funding_mechanism || '',
    nih_institute: r.agency_ic_fundings?.[0]?.abbreviation || r.agency_code || '',
    project_start_date: r.project_start_date || null,
    project_end_date: r.project_end_date || null,
    therapeutic_area: null, // Set by caller
  }));
}

// === Main Ingestion Function ===

export async function runNIHReporterIngestion(
  supabase: SupabaseClient,
  options?: { fiscalYears?: number[]; maxPerSearch?: number }
): Promise<{
  searches_run: number;
  projects_found: number;
  projects_inserted: number;
  total_funding_usd: number;
  errors: string[];
}> {
  const currentYear = new Date().getFullYear();
  const fiscalYears = options?.fiscalYears || [currentYear, currentYear - 1];
  const maxPerSearch = options?.maxPerSearch || 50;
  const errors: string[] = [];
  let totalFound = 0;
  let totalInserted = 0;
  let totalFunding = 0;
  let searchesRun = 0;

  console.log(`[nih-reporter] Starting ingestion (FY ${fiscalYears.join(', ')})...`);

  // Search by indication/technology
  for (const { term, ta } of INDICATION_SEARCHES) {
    try {
      searchesRun++;
      const projects = await searchNIHProjects(term, fiscalYears, maxPerSearch);
      totalFound += projects.length;

      for (const project of projects) {
        project.therapeutic_area = ta;

        // Check for duplicates
        const { data: existing } = await supabase
          .from('research_signals')
          .select('id')
          .eq('source_type', 'nih_grant')
          .eq('source_id', project.project_num)
          .limit(1)
          .single();

        if (existing) continue;

        totalFunding += project.award_amount;

        const { error: insertError } = await supabase.from('research_signals').insert({
          source_type: 'nih_grant',
          source_id: project.project_num,
          source_url: `https://reporter.nih.gov/project-details/${project.project_num}`,
          title: project.project_title,
          abstract: (project.abstract_text || '').substring(0, 5000),
          authors: project.pi_names,
          journal: project.nih_institute,
          published_date: project.project_start_date || `${project.fiscal_year}-01-01`,
          doi: null,
          mesh_terms: [project.funding_mechanism, `FY${project.fiscal_year}`].filter(Boolean),
          therapeutic_area: project.therapeutic_area,
          signal_type: 'funding',
          funding_amount_usd: project.award_amount,
          organization_name: project.organization_name,
          ingested_at: new Date().toISOString(),
        });

        if (insertError) {
          if (insertError.code !== '23505') {
            errors.push(`Project ${project.project_num}: ${insertError.message}`);
          }
        } else {
          totalInserted++;
        }
      }

      // NIH rate limit: 1 req/second
      await new Promise(r => setTimeout(r, 1200));

    } catch (error) {
      errors.push(`Search "${term}": ${error}`);
    }
  }

  // Search by tracked organization names
  for (const org of TRACKED_ORGANIZATIONS) {
    try {
      searchesRun++;
      const projects = await searchNIHProjects(org, fiscalYears, 20);
      totalFound += projects.length;

      for (const project of projects) {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('research_signals')
          .select('id')
          .eq('source_type', 'nih_grant')
          .eq('source_id', project.project_num)
          .limit(1)
          .single();

        if (existing) continue;

        totalFunding += project.award_amount;

        const { error: insertError } = await supabase.from('research_signals').insert({
          source_type: 'nih_grant',
          source_id: project.project_num,
          source_url: `https://reporter.nih.gov/project-details/${project.project_num}`,
          title: project.project_title,
          abstract: (project.abstract_text || '').substring(0, 5000),
          authors: project.pi_names,
          journal: project.nih_institute,
          published_date: project.project_start_date || `${project.fiscal_year}-01-01`,
          doi: null,
          mesh_terms: [project.funding_mechanism, `FY${project.fiscal_year}`, org].filter(Boolean),
          therapeutic_area: project.therapeutic_area,
          signal_type: 'funding',
          funding_amount_usd: project.award_amount,
          organization_name: project.organization_name,
          ingested_at: new Date().toISOString(),
        });

        if (insertError) {
          if (insertError.code !== '23505') {
            errors.push(`Project ${project.project_num}: ${insertError.message}`);
          }
        } else {
          totalInserted++;
        }
      }

      // NIH rate limit
      await new Promise(r => setTimeout(r, 1200));

    } catch (error) {
      errors.push(`Org "${org}": ${error}`);
    }
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'nih_reporter',
    run_type: 'scheduled',
    parameters: { fiscalYears, searches: searchesRun },
    records_fetched: totalFound,
    records_processed: totalFound,
    records_inserted: totalInserted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[nih-reporter] Done: ${totalFound} found, ${totalInserted} inserted, $${(totalFunding / 1e6).toFixed(1)}M total funding`);

  return {
    searches_run: searchesRun,
    projects_found: totalFound,
    projects_inserted: totalInserted,
    total_funding_usd: totalFunding,
    errors,
  };
}
