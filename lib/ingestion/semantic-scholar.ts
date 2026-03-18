/**
 * Semantic Scholar API Integration
 *
 * Free alternative to Google Scholar with structured data, citation graphs,
 * and 100 req/sec rate limit. Used for academic publication tracking
 * relevant to biopharma deal intelligence.
 *
 * API: https://api.semanticscholar.org/graph/v1
 * Rate limit: 100 requests/sec (unauthenticated)
 * Data: 200M+ papers with citations, abstracts, authors, venues
 *
 * Use cases:
 * - Track publications for drugs involved in deals (clinical readouts)
 * - Identify early-stage science signals before deals happen
 * - Enrich company profiles with publication count and impact
 */

import { fetchWithTimeout } from '../fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const S2_API = 'https://api.semanticscholar.org/graph/v1';

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number;
  citationCount: number;
  authors: Array<{ name: string; authorId: string }>;
  publicationDate: string | null;
  venue: string;
  externalIds: Record<string, string>;
  fieldsOfStudy: string[];
}

/**
 * Search Semantic Scholar for papers relevant to biopharma deals.
 * More comprehensive than PubMed for non-US and preprint literature.
 */
async function searchPapers(
  query: string,
  limit: number = 20,
  year?: string,
): Promise<S2Paper[]> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: 'title,abstract,year,citationCount,authors,publicationDate,venue,externalIds,fieldsOfStudy',
  });
  if (year) params.set('year', year);

  const response = await fetchWithTimeout(`${S2_API}/paper/search?${params}`, {
    timeoutMs: 15_000,
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return (data.data || []) as S2Paper[];
}

// Pharma-relevant search queries per therapeutic area
const TA_QUERIES: Record<string, string[]> = {
  neurology: ['Alzheimer drug licensing clinical trial', 'Parkinson disease therapy partnership', 'epilepsy novel treatment collaboration'],
  immunology: ['autoimmune disease biologic licensing', 'inflammatory bowel disease drug collaboration', 'rheumatoid arthritis novel therapy'],
  cardiovascular: ['heart failure novel therapy licensing', 'ATTR cardiomyopathy gene therapy', 'hypertension drug development collaboration'],
  metabolic: ['GLP-1 obesity drug development', 'NASH MASH liver disease therapy', 'diabetes novel treatment licensing'],
  infectiousDisease: ['antiviral drug licensing', 'antibiotic resistance novel drug', 'mRNA vaccine development'],
  rareDisease: ['gene therapy rare disease clinical', 'orphan drug development licensing', 'enzyme replacement therapy'],
  hematology: ['CAR-T cell therapy lymphoma', 'sickle cell gene therapy', 'myelofibrosis novel treatment'],
  ophthalmology: ['retinal gene therapy clinical', 'macular degeneration novel treatment', 'dry eye disease drug development'],
  dermatology: ['atopic dermatitis biologic therapy', 'psoriasis novel oral treatment', 'alopecia areata drug development'],
  gastroenterology: ['IBD novel biologic therapy', 'celiac disease drug development', 'eosinophilic esophagitis treatment'],
  womensHealth: ['endometriosis novel treatment', 'uterine fibroids drug development', 'menopause vasomotor therapy'],
};

/**
 * Run Semantic Scholar ingestion for pharma-relevant publications.
 * Stores in research_signals table alongside PubMed and bioRxiv.
 */
export async function runSemanticScholarIngestion(
  supabase: SupabaseClient,
  options?: { therapeuticAreas?: string[]; maxPerTA?: number; yearFilter?: string }
): Promise<{ queries_run: number; papers_found: number; papers_stored: number; errors: string[] }> {
  const tas = options?.therapeuticAreas || Object.keys(TA_QUERIES);
  const maxPerTA = options?.maxPerTA || 10;
  const year = options?.yearFilter || `${new Date().getFullYear() - 1}-${new Date().getFullYear()}`;

  let queriesRun = 0;
  let papersFound = 0;
  let papersStored = 0;
  const errors: string[] = [];

  for (const ta of tas) {
    const queries = TA_QUERIES[ta];
    if (!queries) continue;

    for (const query of queries.slice(0, 2)) {
      try {
        const papers = await searchPapers(query, maxPerTA, year);
        queriesRun++;
        papersFound += papers.length;

        for (const paper of papers) {
          if (!paper.title || !paper.paperId) continue;

          // Map to therapeutic area
          const { error } = await supabase.from('research_signals').upsert({
            source_type: 'semantic_scholar',
            source_id: paper.paperId,
            title: paper.title,
            abstract: paper.abstract?.substring(0, 5000) || null,
            authors: paper.authors?.slice(0, 10).map(a => a.name) || [],
            published_date: paper.publicationDate || (paper.year ? `${paper.year}-01-01` : null),
            journal: paper.venue || null,
            doi: paper.externalIds?.DOI || null,
            therapeutic_area: ta,
            signal_type: 'publication',
          }, { onConflict: 'source_type,source_id' });

          if (!error) papersStored++;
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        errors.push(`${ta}/${query}: ${err}`);
      }
    }
  }

  console.log(`[Semantic Scholar] ${queriesRun} queries, ${papersFound} papers found, ${papersStored} stored`);
  return { queries_run: queriesRun, papers_found: papersFound, papers_stored: papersStored, errors };
}
