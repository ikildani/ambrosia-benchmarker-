// USPTO PatentsView API Ingestion
// Tracks recent pharma patent filings and expirations
// Provides patent cliff analysis and IP landscape for deal context

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const PATENTSVIEW_API = 'https://api.patentsview.org/patents/query';

// Top pharma/biotech assignees to track
const TRACKED_ASSIGNEES = [
  'Pfizer', 'Merck', 'AbbVie', 'Gilead Sciences', 'Amgen', 'Regeneron',
  'Eli Lilly', 'Bristol-Myers Squibb', 'AstraZeneca', 'Novartis', 'Roche',
  'Genentech', 'Sanofi', 'GlaxoSmithKline', 'Moderna', 'Vertex',
  'BioMarin', 'Incyte', 'Biogen', 'Alnylam', 'Ionis',
  'CRISPR Therapeutics', 'Intellia', 'Editas', 'Beam Therapeutics',
  'Sarepta', 'Ultragenyx', 'Argenx', 'Jazz Pharmaceuticals',
  'Neurocrine', 'Blueprint Medicines', 'Seagen',
  'BeiGene', 'Legend Biotech', 'Daiichi Sankyo',
];

// CPC codes for pharma-relevant patent classes
const PHARMA_CPC_CODES = [
  'A61K', // Preparations for medical/dental/toilet purposes
  'A61P', // Therapeutic activity of chemical compounds
  'C07K', // Peptides (antibodies, proteins)
  'C12N', // Microorganisms/enzymes (gene therapy, cell therapy)
  'C07D', // Heterocyclic compounds (small molecules)
  'C07H', // Sugars/nucleosides (oligonucleotides)
  'G01N', // Investigating materials (diagnostics/biomarkers)
];

export interface PatentRecord {
  patent_number: string;
  patent_title: string;
  patent_date: string;
  patent_type: string;
  assignee_organization: string;
  assignee_country: string;
  inventors: string[];
  cpc_codes: string[];
  abstract: string;
  claims_count: number;
  therapeutic_area: string | null;
}

// Therapeutic area classification based on patent content
const TA_KEYWORDS: Record<string, string[]> = {
  oncology: ['cancer', 'tumor', 'oncolog', 'carcinoma', 'lymphoma', 'leukemia', 'melanoma', 'anti-tumor', 'antineoplastic', 'checkpoint inhibitor', 'car-t', 'adc'],
  neurology: ['neurodegenerat', 'alzheimer', 'parkinson', 'multiple sclerosis', 'epilepsy', 'amyotrophic', 'huntington', 'central nervous system', 'cns'],
  immunology: ['autoimmune', 'rheumatoid', 'lupus', 'inflammatory', 'immune', 'immunomodulat', 'anti-inflammatory'],
  rare_disease: ['rare disease', 'orphan', 'muscular dystrophy', 'cystic fibrosis', 'sickle cell', 'lysosomal', 'gene therapy'],
  metabolic: ['diabetes', 'obesity', 'metabolic', 'insulin', 'glp-1', 'dyslipidemia', 'lipid'],
  cardiovascular: ['cardiovascular', 'heart', 'atherosclerosis', 'thrombosis', 'hypertension', 'anticoagulant'],
  infectious_disease: ['infectious', 'antiviral', 'antibacterial', 'antibiotic', 'vaccine', 'hiv', 'hepatitis'],
  ophthalmology: ['ophthalm', 'retinal', 'macular', 'glaucoma', 'ocular'],
  hematology: ['hemophilia', 'anemia', 'thalassemia', 'coagulation', 'blood disorder'],
  dermatology: ['dermatolog', 'skin', 'psoriasis', 'eczema', 'topical'],
};

function formatDateForAPI(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function classifyTA(text: string): string | null {
  const lower = text.toLowerCase();
  let bestTA: string | null = null;
  let maxHits = 0;
  for (const [ta, keywords] of Object.entries(TA_KEYWORDS)) {
    const hits = keywords.filter(kw => lower.includes(kw)).length;
    if (hits > maxHits) {
      maxHits = hits;
      bestTA = ta;
    }
  }
  return bestTA;
}

async function searchPatents(
  assignee: string,
  daysBack: number,
  page: number = 1,
  perPage: number = 25
): Promise<PatentRecord[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const query = {
    _and: [
      { _gte: { patent_date: formatDateForAPI(startDate) } },
      { _contains: { assignees: { assignee_organization: assignee } } },
    ],
  };

  const params = new URLSearchParams({
    q: JSON.stringify(query),
    f: JSON.stringify([
      'patent_number', 'patent_title', 'patent_date', 'patent_type', 'patent_abstract',
      'assignees.assignee_organization', 'assignees.assignee_country',
      'inventors.inventor_first_name', 'inventors.inventor_last_name',
      'cpcs.cpc_group_id',
      'claims.claim_number',
    ]),
    o: JSON.stringify({ page, per_page: perPage }),
    s: JSON.stringify([{ patent_date: 'desc' }]),
  });

  const response = await fetchWithTimeout(`${PATENTSVIEW_API}?${params}`, {
    timeoutMs: 30_000,
    headers: {
      'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.warn(`[patents] PatentsView search failed for ${assignee}: HTTP ${response.status}`);
    return [];
  }

  const data = await response.json();
  const patents = data.patents || [];

  return patents.map((p: Record<string, any>) => {
    const title = p.patent_title || '';
    const abstract = p.patent_abstract || '';
    const cpcCodes = (p.cpcs || []).map((c: Record<string, string>) => c.cpc_group_id).filter(Boolean);

    // Check if pharma-relevant by CPC code
    const isPharmaRelevant = cpcCodes.some((code: string) =>
      PHARMA_CPC_CODES.some(pharmaCode => code.startsWith(pharmaCode))
    );

    if (!isPharmaRelevant) return null;

    return {
      patent_number: p.patent_number || '',
      patent_title: title,
      patent_date: p.patent_date || '',
      patent_type: p.patent_type || '',
      assignee_organization: (p.assignees || [])[0]?.assignee_organization || assignee,
      assignee_country: (p.assignees || [])[0]?.assignee_country || '',
      inventors: (p.inventors || []).map(
        (inv: Record<string, string>) => `${inv.inventor_last_name || ''} ${inv.inventor_first_name || ''}`.trim()
      ),
      cpc_codes: cpcCodes,
      abstract,
      claims_count: (p.claims || []).length,
      therapeutic_area: classifyTA(`${title} ${abstract}`),
    } as PatentRecord;
  }).filter(Boolean) as PatentRecord[];
}

// === Main Ingestion Function ===

export async function runPatentIngestion(
  supabase: SupabaseClient,
  options?: { daysBack?: number; maxPerAssignee?: number }
): Promise<{
  assignees_searched: number;
  patents_found: number;
  patents_inserted: number;
  errors: string[];
}> {
  const daysBack = options?.daysBack || 30; // Patents are filed less frequently
  const maxPerAssignee = options?.maxPerAssignee || 25;
  const errors: string[] = [];
  let totalFound = 0;
  let totalInserted = 0;

  console.log(`[patents] Starting ingestion (${daysBack} days back, ${TRACKED_ASSIGNEES.length} assignees)...`);

  for (const assignee of TRACKED_ASSIGNEES) {
    try {
      const patents = await searchPatents(assignee, daysBack, 1, maxPerAssignee);
      totalFound += patents.length;

      if (patents.length > 0) {
        console.log(`[patents] ${assignee}: ${patents.length} pharma patents`);
      }

      for (const patent of patents) {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('research_signals')
          .select('id')
          .eq('source_type', 'patent')
          .eq('source_id', patent.patent_number)
          .limit(1)
          .single();

        if (existing) continue;

        const { error: insertError } = await supabase.from('research_signals').insert({
          source_type: 'patent',
          source_id: patent.patent_number,
          source_url: `https://patents.google.com/patent/US${patent.patent_number}`,
          title: patent.patent_title,
          abstract: patent.abstract.substring(0, 5000),
          authors: patent.inventors.slice(0, 10),
          journal: patent.assignee_organization,
          published_date: patent.patent_date,
          doi: null,
          mesh_terms: patent.cpc_codes.slice(0, 20),
          therapeutic_area: patent.therapeutic_area,
          signal_type: 'patent',
          organization_name: patent.assignee_organization,
          ingested_at: new Date().toISOString(),
        });

        if (insertError) {
          if (insertError.code !== '23505') {
            errors.push(`Patent ${patent.patent_number}: ${insertError.message}`);
          }
        } else {
          totalInserted++;
        }
      }

      // Rate limit between assignees
      await new Promise(r => setTimeout(r, 1500));

    } catch (error) {
      errors.push(`${assignee}: ${error}`);
    }
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'patents',
    run_type: 'scheduled',
    parameters: { daysBack, assignees: TRACKED_ASSIGNEES.length },
    records_fetched: totalFound,
    records_processed: totalFound,
    records_inserted: totalInserted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[patents] Done: ${totalFound} found, ${totalInserted} inserted`);

  return {
    assignees_searched: TRACKED_ASSIGNEES.length,
    patents_found: totalFound,
    patents_inserted: totalInserted,
    errors,
  };
}
