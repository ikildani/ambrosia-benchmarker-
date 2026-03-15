// PubMed E-utilities Ingestion
// Fetches recent peer-reviewed publications relevant to pharma deal intelligence
// Uses ESearch → EFetch workflow to find and retrieve article metadata

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Search terms for deal-relevant publications
const SEARCH_QUERIES = [
  // Clinical trial results that impact deal valuations
  '"phase 3"[Title] AND ("primary endpoint"[Title/Abstract] OR "pivotal trial"[Title/Abstract])',
  '"licensing agreement"[Title/Abstract] AND (pharma*[Title/Abstract] OR biotech*[Title/Abstract])',
  '"drug development"[Title] AND ("collaboration"[Title/Abstract] OR "partnership"[Title/Abstract])',
  // Regulatory milestones
  '"FDA approval"[Title] AND (202[4-6][Date - Publication])',
  '"breakthrough therapy"[Title/Abstract] AND "designation"[Title/Abstract]',
  // Market access / pricing
  '"market access"[Title] AND (pharma*[Title/Abstract] OR oncolog*[Title/Abstract] OR immuno*[Title/Abstract])',
];

// Therapeutic area keywords for classification
const TA_KEYWORDS: Record<string, string[]> = {
  oncology: ['oncology', 'cancer', 'tumor', 'carcinoma', 'lymphoma', 'leukemia', 'melanoma', 'sarcoma', 'glioma', 'myeloma'],
  neurology: ['neurology', 'neurodegenerat', 'alzheimer', 'parkinson', 'multiple sclerosis', 'epilepsy', 'migraine', 'neuropath'],
  immunology: ['immunology', 'autoimmune', 'rheumatoid', 'lupus', 'psoriasis', 'atopic dermatitis', 'inflammatory bowel', 'crohn'],
  rare_disease: ['rare disease', 'orphan drug', 'rare genetic', 'lysosomal', 'muscular dystrophy', 'cystic fibrosis', 'sickle cell'],
  cardiovascular: ['cardiovascular', 'heart failure', 'atherosclerosis', 'hypertension', 'thrombosis', 'atrial fibrillation'],
  metabolic: ['metabolic', 'diabetes', 'obesity', 'NASH', 'MASH', 'dyslipidemia', 'gout'],
  infectious_disease: ['infectious', 'antibiotic', 'antiviral', 'HIV', 'hepatitis', 'antimicrobial', 'vaccine'],
  hematology: ['hematology', 'hemophilia', 'thalassemia', 'anemia', 'coagulation'],
  ophthalmology: ['ophthalmology', 'retinal', 'macular degeneration', 'glaucoma', 'uveitis', 'dry eye'],
  dermatology: ['dermatology', 'psoriasis', 'eczema', 'acne', 'vitiligo', 'alopecia'],
  pulmonology: ['pulmonology', 'respiratory', 'asthma', 'COPD', 'idiopathic pulmonary fibrosis', 'cough'],
};

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  pub_date: string;
  doi: string | null;
  mesh_terms: string[];
  therapeutic_area: string | null;
}

// Search PubMed for recent articles
async function searchPubMed(
  query: string,
  maxResults: number = 50,
  daysBack: number = 7
): Promise<string[]> {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() - daysBack);
  const minDateStr = `${minDate.getFullYear()}/${String(minDate.getMonth() + 1).padStart(2, '0')}/${String(minDate.getDate()).padStart(2, '0')}`;

  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: String(maxResults),
    retmode: 'json',
    datetype: 'pdat',
    mindate: minDateStr,
    sort: 'date',
  });

  const response = await fetchWithTimeout(`${EUTILS_BASE}/esearch.fcgi?${params}`, {
    timeoutMs: 20_000,
    headers: { 'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co' },
  });

  if (!response.ok) {
    console.warn(`[pubmed] ESearch failed: HTTP ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.esearchresult?.idlist || [];
}

// Fetch article details by PMIDs
async function fetchArticles(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  });

  const response = await fetchWithTimeout(`${EUTILS_BASE}/efetch.fcgi?${params}`, {
    timeoutMs: 30_000,
    headers: { 'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co' },
  });

  if (!response.ok) {
    console.warn(`[pubmed] EFetch failed: HTTP ${response.status}`);
    return [];
  }

  const xml = await response.text();
  return parsePubMedXML(xml);
}

function parsePubMedXML(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/gi;
  let match;

  while ((match = articleRegex.exec(xml)) !== null) {
    const articleXml = match[1];

    const pmid = extractXmlTag(articleXml, 'PMID') || '';
    const title = extractXmlTag(articleXml, 'ArticleTitle') || '';
    const abstract = extractXmlTag(articleXml, 'AbstractText') || '';
    const journal = extractXmlTag(articleXml, 'Title') || '';

    // Extract DOI
    const doiMatch = articleXml.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/i);
    const doi = doiMatch ? doiMatch[1].trim() : null;

    // Extract authors
    const authors: string[] = [];
    const authorRegex = /<Author[^>]*>([\s\S]*?)<\/Author>/gi;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(articleXml)) !== null) {
      const lastName = extractXmlTag(authorMatch[1], 'LastName');
      const foreName = extractXmlTag(authorMatch[1], 'ForeName');
      if (lastName) authors.push(`${lastName}${foreName ? ' ' + foreName : ''}`);
    }

    // Extract pub date
    const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>([\d]{4})<\/Year>/i);
    const monthMatch = articleXml.match(/<PubDate>[\s\S]*?<Month>(\w+)<\/Month>/i);
    const dayMatch = articleXml.match(/<PubDate>[\s\S]*?<Day>(\d+)<\/Day>/i);
    const pub_date = yearMatch
      ? `${yearMatch[1]}-${monthMatch ? monthToNum(monthMatch[1]) : '01'}-${dayMatch ? dayMatch[1].padStart(2, '0') : '01'}`
      : new Date().toISOString().split('T')[0];

    // Extract MeSH terms
    const meshTerms: string[] = [];
    const meshRegex = /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/gi;
    let meshMatch;
    while ((meshMatch = meshRegex.exec(articleXml)) !== null) {
      meshTerms.push(meshMatch[1].trim());
    }

    // Classify therapeutic area
    const fullText = `${title} ${abstract} ${meshTerms.join(' ')}`.toLowerCase();
    let therapeutic_area: string | null = null;
    let maxHits = 0;
    for (const [ta, keywords] of Object.entries(TA_KEYWORDS)) {
      const hits = keywords.filter(kw => fullText.includes(kw.toLowerCase())).length;
      if (hits > maxHits) {
        maxHits = hits;
        therapeutic_area = ta;
      }
    }

    if (pmid && title) {
      articles.push({
        pmid,
        title: cleanXmlText(title),
        abstract: cleanXmlText(abstract),
        authors: authors.slice(0, 10), // Cap at 10 authors
        journal,
        pub_date,
        doi,
        mesh_terms: meshTerms,
        therapeutic_area,
      });
    }
  }

  return articles;
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function cleanXmlText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function monthToNum(month: string): string {
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  return months[month.toLowerCase().slice(0, 3)] || '01';
}

// === Main Ingestion Function ===

export async function runPubMedIngestion(
  supabase: SupabaseClient,
  options?: { daysBack?: number; maxPerQuery?: number }
): Promise<{
  queries_run: number;
  articles_found: number;
  articles_inserted: number;
  errors: string[];
}> {
  const daysBack = options?.daysBack || 7;
  const maxPerQuery = options?.maxPerQuery || 50;
  const errors: string[] = [];
  let totalFound = 0;
  let totalInserted = 0;

  console.log(`[pubmed] Starting ingestion (${daysBack} days back, ${SEARCH_QUERIES.length} queries)...`);

  for (const query of SEARCH_QUERIES) {
    try {
      // Search
      const pmids = await searchPubMed(query, maxPerQuery, daysBack);
      totalFound += pmids.length;

      if (pmids.length === 0) continue;

      // Check which PMIDs we already have
      const { data: existing } = await supabase
        .from('research_signals')
        .select('source_id')
        .eq('source_type', 'pubmed')
        .in('source_id', pmids);

      const existingIds = new Set((existing || []).map((r: { source_id: string }) => r.source_id));
      const newPmids = pmids.filter(id => !existingIds.has(id));

      if (newPmids.length === 0) continue;

      // Fetch details
      const articles = await fetchArticles(newPmids);

      // Insert
      for (const article of articles) {
        const { error: insertError } = await supabase.from('research_signals').insert({
          source_type: 'pubmed',
          source_id: article.pmid,
          source_url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
          title: article.title,
          abstract: article.abstract.substring(0, 5000),
          authors: article.authors,
          journal: article.journal,
          published_date: article.pub_date,
          doi: article.doi,
          mesh_terms: article.mesh_terms,
          therapeutic_area: article.therapeutic_area,
          signal_type: 'publication',
          ingested_at: new Date().toISOString(),
        });

        if (insertError) {
          if (insertError.code !== '23505') {
            errors.push(`PMID ${article.pmid}: ${insertError.message}`);
          }
        } else {
          totalInserted++;
        }
      }

      // Rate limit: NCBI recommends max 3 requests/second without API key
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      errors.push(`Query error: ${error}`);
    }
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'pubmed',
    run_type: 'scheduled',
    parameters: { daysBack, queries: SEARCH_QUERIES.length },
    records_fetched: totalFound,
    records_processed: totalFound,
    records_inserted: totalInserted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[pubmed] Done: ${totalFound} found, ${totalInserted} inserted`);

  return {
    queries_run: SEARCH_QUERIES.length,
    articles_found: totalFound,
    articles_inserted: totalInserted,
    errors,
  };
}
