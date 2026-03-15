// bioRxiv / medRxiv Preprint Ingestion
// Fetches recent preprints relevant to pharma deal intelligence
// Early signal on emerging science — often precedes licensing deals

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const BIORXIV_API = 'https://api.biorxiv.org/details';

// Categories relevant to pharma deal intelligence
const SERVERS: Array<{ server: 'biorxiv' | 'medrxiv'; name: string }> = [
  { server: 'biorxiv', name: 'bioRxiv' },
  { server: 'medrxiv', name: 'medRxiv' },
];

// Keywords to filter preprints relevant to deal intelligence
const RELEVANCE_KEYWORDS = [
  'phase 1', 'phase 2', 'phase 3', 'clinical trial',
  'therapeutic', 'drug candidate', 'drug target',
  'antibody', 'bispecific', 'car-t', 'car t', 'gene therapy',
  'adc', 'antibody-drug conjugate',
  'mrna', 'oligonucleotide', 'sirna', 'antisense',
  'checkpoint inhibitor', 'immunotherapy',
  'small molecule', 'kinase inhibitor',
  'biomarker', 'companion diagnostic',
  'fda', 'regulatory', 'approval',
  'efficacy', 'safety', 'endpoint',
  'patient population', 'overall survival', 'progression-free',
  'licensing', 'collaboration', 'partnership',
];

// Therapeutic area classification
const TA_KEYWORDS: Record<string, string[]> = {
  oncology: ['cancer', 'tumor', 'oncolog', 'carcinoma', 'melanoma', 'lymphoma', 'leukemia', 'glioblastoma', 'sarcoma', 'myeloma', 'checkpoint', 'immuno-oncology'],
  neurology: ['neurodegen', 'alzheimer', 'parkinson', 'multiple sclerosis', 'epilepsy', 'amyotrophic', 'huntington', 'neuropath', 'brain', 'neurolog'],
  immunology: ['autoimmune', 'rheumatoid', 'lupus', 'inflammatory', 'crohn', 'ulcerative colitis', 'psoriasis', 'immunolog'],
  rare_disease: ['rare disease', 'orphan', 'muscular dystrophy', 'cystic fibrosis', 'sickle cell', 'lysosomal', 'spinal muscular'],
  cardiovascular: ['cardiovascular', 'heart failure', 'atherosclerosis', 'thrombosis', 'hypertension', 'cardiac'],
  metabolic: ['diabetes', 'obesity', 'NASH', 'MASH', 'metabolic', 'dyslipidemia'],
  infectious_disease: ['infectious', 'viral', 'bacterial', 'antibiotic', 'antiviral', 'vaccine', 'SARS', 'HIV', 'hepatitis', 'antimicrobial'],
  hematology: ['hemophilia', 'anemia', 'thalassemia', 'coagulation', 'platelet', 'hematolog'],
  ophthalmology: ['retinal', 'macular', 'glaucoma', 'ophthalm', 'uveitis', 'dry eye'],
};

export interface PreprintArticle {
  doi: string;
  title: string;
  authors: string;
  abstract: string;
  category: string;
  server: string;
  date: string;
  version: string;
  therapeutic_area: string | null;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchPreprints(
  server: 'biorxiv' | 'medrxiv',
  daysBack: number,
  cursor: number = 0
): Promise<PreprintArticle[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const interval = `${formatDate(startDate)}/${formatDate(endDate)}`;
  const url = `${BIORXIV_API}/${server}/${interval}/${cursor}/json`;

  const response = await fetchWithTimeout(url, {
    timeoutMs: 30_000,
    headers: { 'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co' },
  });

  if (!response.ok) {
    console.warn(`[biorxiv] ${server} fetch failed: HTTP ${response.status}`);
    return [];
  }

  const data = await response.json();
  const collection = data.collection || [];

  return collection
    .map((item: Record<string, string>) => {
      const text = `${item.title || ''} ${item.abstract || ''}`.toLowerCase();

      // Only keep pharma-relevant preprints
      const isRelevant = RELEVANCE_KEYWORDS.some(kw => text.includes(kw));
      if (!isRelevant) return null;

      // Classify therapeutic area
      let therapeutic_area: string | null = null;
      let maxHits = 0;
      for (const [ta, keywords] of Object.entries(TA_KEYWORDS)) {
        const hits = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
        if (hits > maxHits) {
          maxHits = hits;
          therapeutic_area = ta;
        }
      }

      return {
        doi: item.doi || '',
        title: item.title || '',
        authors: item.authors || '',
        abstract: (item.abstract || '').substring(0, 5000),
        category: item.category || '',
        server,
        date: item.date || '',
        version: item.version || '1',
        therapeutic_area,
      } as PreprintArticle;
    })
    .filter(Boolean) as PreprintArticle[];
}

// === Main Ingestion Function ===

export async function runBioRxivIngestion(
  supabase: SupabaseClient,
  options?: { daysBack?: number; maxPerServer?: number }
): Promise<{
  servers_checked: number;
  preprints_found: number;
  preprints_inserted: number;
  errors: string[];
}> {
  const daysBack = options?.daysBack || 7;
  const maxPerServer = options?.maxPerServer || 100;
  const errors: string[] = [];
  let totalFound = 0;
  let totalInserted = 0;

  console.log(`[biorxiv] Starting ingestion (${daysBack} days back)...`);

  for (const { server, name } of SERVERS) {
    try {
      console.log(`[biorxiv] Fetching ${name}...`);

      // Fetch preprints (may need multiple pages)
      let allPreprints: PreprintArticle[] = [];
      let cursor = 0;

      while (allPreprints.length < maxPerServer) {
        const batch = await fetchPreprints(server, daysBack, cursor);
        if (batch.length === 0) break;

        allPreprints = allPreprints.concat(batch);
        cursor += 100; // bioRxiv API returns up to 100 per page

        // Respect rate limits
        await new Promise(r => setTimeout(r, 1000));

        // Safety: max 5 pages
        if (cursor >= 500) break;
      }

      allPreprints = allPreprints.slice(0, maxPerServer);
      totalFound += allPreprints.length;

      console.log(`[biorxiv] ${name}: ${allPreprints.length} relevant preprints`);

      // Check which DOIs we already have
      const dois = allPreprints.map(p => p.doi).filter(Boolean);
      const { data: existing } = await supabase
        .from('research_signals')
        .select('source_id')
        .eq('source_type', 'preprint')
        .in('source_id', dois);

      const existingDois = new Set((existing || []).map((r: { source_id: string }) => r.source_id));

      // Insert new preprints
      for (const preprint of allPreprints) {
        if (!preprint.doi || existingDois.has(preprint.doi)) continue;

        const { error: insertError } = await supabase.from('research_signals').insert({
          source_type: 'preprint',
          source_id: preprint.doi,
          source_url: `https://doi.org/${preprint.doi}`,
          title: preprint.title,
          abstract: preprint.abstract,
          authors: preprint.authors.split(';').map((a: string) => a.trim()).filter(Boolean).slice(0, 10),
          journal: `${preprint.server} (preprint)`,
          published_date: preprint.date,
          doi: preprint.doi,
          mesh_terms: [preprint.category].filter(Boolean),
          therapeutic_area: preprint.therapeutic_area,
          signal_type: 'preprint',
          ingested_at: new Date().toISOString(),
        });

        if (insertError) {
          if (insertError.code !== '23505') {
            errors.push(`DOI ${preprint.doi}: ${insertError.message}`);
          }
        } else {
          totalInserted++;
        }
      }

      // Rate limit between servers
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      errors.push(`${name}: ${error}`);
    }
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'biorxiv',
    run_type: 'scheduled',
    parameters: { daysBack, servers: SERVERS.length },
    records_fetched: totalFound,
    records_processed: totalFound,
    records_inserted: totalInserted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[biorxiv] Done: ${totalFound} found, ${totalInserted} inserted`);

  return {
    servers_checked: SERVERS.length,
    preprints_found: totalFound,
    preprints_inserted: totalInserted,
    errors,
  };
}
