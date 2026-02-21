// OpenFDA Drug Approvals Ingestion Pipeline
// Fetches recent drug approvals, NDAs, and BLAs from the FDA's public API
// Matches approved drugs to tracked companies and records approval milestones

import type { SupabaseClient } from '@supabase/supabase-js';

// OpenFDA API endpoint for drug approvals (drugsfda)
const OPENFDA_BASE = 'https://api.fda.gov/drug/drugsfda.json';

interface OpenFDAProduct {
  brand_name?: string;
  generic_name?: string;
  dosage_form?: string;
  route?: string;
  marketing_status?: string;
  te_code?: string;
}

interface OpenFDASubmission {
  submission_type?: string; // ORIG, SUPPL
  submission_number?: string;
  submission_status?: string; // AP (approved)
  submission_status_date?: string; // YYYYMMDD
  submission_class_code?: string;
  submission_class_code_description?: string;
  application_docs?: Array<{
    id: string;
    url: string;
    date: string;
    type: string;
    title?: string;
  }>;
}

interface OpenFDAResult {
  application_number?: string;
  sponsor_name?: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    route?: string[];
    substance_name?: string[];
    pharm_class_epc?: string[];
    pharm_class_moa?: string[];
  };
  products?: OpenFDAProduct[];
  submissions?: OpenFDASubmission[];
}

// Map sponsor names to our company names
const SPONSOR_TO_COMPANY: Record<string, string> = {
  'PFIZER INC': 'Pfizer',
  'PFIZER LABS': 'Pfizer',
  'MERCK SHARP DOHME': 'Merck',
  'MERCK SHARP AND DOHME': 'Merck',
  'MERCK AND CO INC': 'Merck',
  'ABBVIE INC': 'AbbVie',
  'ABBVIE': 'AbbVie',
  'GILEAD SCIENCES INC': 'Gilead Sciences',
  'GILEAD SCIENCES': 'Gilead Sciences',
  'AMGEN INC': 'Amgen',
  'REGENERON PHARMS INC': 'Regeneron',
  'REGENERON PHARMACEUTICALS': 'Regeneron',
  'ELI LILLY AND CO': 'Eli Lilly',
  'LILLY': 'Eli Lilly',
  'BRISTOL MYERS SQUIBB CO': 'Bristol-Myers Squibb',
  'BRISTOL MYERS SQUIBB': 'Bristol-Myers Squibb',
  'JOHNSON AND JOHNSON': 'Johnson & Johnson',
  'JANSSEN BIOTECH INC': 'Johnson & Johnson',
  'JANSSEN PHARMS INC': 'Johnson & Johnson',
  'ASTRAZENECA PHARMS LP': 'AstraZeneca',
  'ASTRAZENECA': 'AstraZeneca',
  'NOVARTIS PHARMS CORP': 'Novartis',
  'NOVARTIS': 'Novartis',
  'ROCHE': 'Roche',
  'GENENTECH INC': 'Roche',
  'SANOFI AVENTIS US': 'Sanofi',
  'SANOFI': 'Sanofi',
  'GLAXOSMITHKLINE': 'GSK',
  'GSK': 'GSK',
  'NOVO NORDISK INC': 'Novo Nordisk',
  'NOVO NORDISK': 'Novo Nordisk',
  'TAKEDA PHARMS USA INC': 'Takeda',
  'TAKEDA': 'Takeda',
  'MODERNA INC': 'Moderna',
  'MODERNA': 'Moderna',
  'VERTEX PHARMS INC': 'Vertex Pharmaceuticals',
  'VERTEX': 'Vertex Pharmaceuticals',
  'BIOGEN INC': 'Biogen',
  'BIOGEN': 'Biogen',
  'BIOMARIN PHARM INC': 'BioMarin',
  'BIOMARIN': 'BioMarin',
  'INCYTE CORP': 'Incyte',
  'JAZZ PHARMS INC': 'Jazz Pharmaceuticals',
  'JAZZ PHARMACEUTICALS': 'Jazz Pharmaceuticals',
  'NEUROCRINE BIOSCIENCES': 'Neurocrine',
  'ULTRAGENYX PHARM INC': 'Ultragenyx',
  'SAREPTA THERAPEUTICS INC': 'Sarepta Therapeutics',
  'SAREPTA': 'Sarepta Therapeutics',
  'ALEXION PHARMS INC': 'Alexion',
  'ALEXION': 'Alexion',
  'SEAGEN INC': 'Seattle Genetics',
  'SEATTLE GENETICS': 'Seattle Genetics',
  'DAIICHI SANKYO INC': 'Daiichi Sankyo',
  'DAIICHI SANKYO': 'Daiichi Sankyo',
  'BIONTECH': 'BioNTech',
  'ARGENX': 'Argenx',
  'ARGENX US INC': 'Argenx',
  'ALNYLAM PHARMS INC': 'Alnylam Pharmaceuticals',
  'ALNYLAM': 'Alnylam Pharmaceuticals',
  'IONIS PHARMS INC': 'Ionis Pharmaceuticals',
  'IONIS': 'Ionis Pharmaceuticals',
  'BEIGENE USA INC': 'BeiGene',
  'BEIGENE': 'BeiGene',
  'TEVA PHARMS USA INC': 'Teva',
  'TEVA': 'Teva',
  'ORGANON': 'Organon',
  'ORGANON LLC': 'Organon',
  'INSMED INC': 'Insmed',
  'MADRIGAL PHARMS INC': 'Madrigal Pharmaceuticals',
  'BRIDGEBIO PHARMA': 'BridgeBio Pharma',
  'INTRA CELLULAR THERAPIES': 'Intra-Cellular Therapies',
  'EXELIXIS INC': 'Exelixis',
  'IOVANCE BIOTHERAPEUTICS': 'Iovance Biotherapeutics',
  'LANTHEUS MEDICAL IMAGING': 'Lantheus',
  'RECURSION PHARMS': 'Recursion Pharmaceuticals',
  'ALCON LABS INC': 'Alcon',
  'APELLIS PHARMS INC': 'Apellis Pharmaceuticals',
  'SUN PHARMA': 'Sun Pharma',
  'SUN PHARMACEUTICAL': 'Sun Pharma',
  'CIPLA': 'Cipla',
  'DR REDDYS LABS': 'Dr. Reddy\'s',
  'LUPIN LTD': 'Lupin',
  'CELLTRION': 'Celltrion',
};

// Derive therapeutic area from FDA pharmacological class
function deriveTherapeuticAreaFromFDA(pharmClasses: string[]): string {
  const text = pharmClasses.join(' ').toLowerCase();

  if (text.includes('antineoplastic') || text.includes('kinase inhibitor') || text.includes('tumor')) return 'oncology';
  if (text.includes('immunosuppressant') || text.includes('anti-inflammatory') || text.includes('tnf')) return 'immunology';
  if (text.includes('cns') || text.includes('antipsychotic') || text.includes('anticonvulsant') || text.includes('dopamine') || text.includes('serotonin') || text.includes('neurological')) return 'neurology';
  if (text.includes('cardiovascular') || text.includes('antihypertensive') || text.includes('anticoagulant')) return 'cardiovascular';
  if (text.includes('antiviral') || text.includes('antibiotic') || text.includes('antifungal') || text.includes('anti-infective')) return 'infectious';
  if (text.includes('metabolic') || text.includes('antidiabetic') || text.includes('insulin') || text.includes('lipid')) return 'metabolic';
  if (text.includes('respiratory') || text.includes('bronchodilator') || text.includes('pulmonary')) return 'respiratory';
  if (text.includes('dermatolog') || text.includes('topical')) return 'dermatology';
  if (text.includes('ophthalm') || text.includes('ocular')) return 'ophthalmology';

  return 'other';
}

// Derive indication category from pharm classes
function deriveIndicationCategory(pharmClasses: string[]): string | null {
  const text = pharmClasses.join(' ').toLowerCase();

  if (text.includes('antineoplastic')) return 'solid_tumor';
  if (text.includes('kinase inhibitor') && !text.includes('cns')) return 'solid_tumor';
  if (text.includes('immunosuppressant') || text.includes('anti-inflammatory')) return 'autoimmune';
  if (text.includes('cns') || text.includes('antipsychotic') || text.includes('anticonvulsant')) return 'cns';
  if (text.includes('cardiovascular') || text.includes('antihypertensive')) return 'cardiovascular';
  if (text.includes('antiviral') || text.includes('antibiotic')) return 'infectious';
  if (text.includes('antidiabetic') || text.includes('metabolic')) return 'metabolic';
  if (text.includes('respiratory') || text.includes('bronchodilator')) return 'respiratory';
  if (text.includes('dermatolog')) return 'dermatology';
  if (text.includes('ophthalm')) return 'ophthalmology';

  return null;
}

export async function runOpenFDAIngestion(
  supabase: SupabaseClient,
  options?: { daysBack?: number }
): Promise<{
  approvals_fetched: number;
  matched_to_companies: number;
  inserted: number;
  errors: string[];
}> {
  const daysBack = options?.daysBack || 90;
  const errors: string[] = [];
  let approvalsFetched = 0;
  let matchedToCompanies = 0;
  let inserted = 0;

  console.log(`[openfda] Starting ingestion (${daysBack} days lookback)...`);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const startStr = formatFDADate(startDate);
  const endStr = formatFDADate(endDate);

  // Build name-to-id company lookup
  const { data: allCompanies } = await supabase
    .from('companies')
    .select('id, name, name_variations');

  const nameToId = new Map<string, string>();
  for (const c of allCompanies || []) {
    nameToId.set(c.name.toLowerCase(), c.id);
    for (const v of c.name_variations || []) {
      nameToId.set(v.toLowerCase(), c.id);
    }
  }

  try {
    // Query OpenFDA for recent original approvals (NDA/BLA)
    // Search for original submissions approved in the date range
    const searchQuery = `submissions.submission_type:"ORIG"+AND+submissions.submission_status:"AP"+AND+submissions.submission_status_date:[${startStr}+TO+${endStr}]`;
    const url = `${OPENFDA_BASE}?search=${searchQuery}&limit=100`;

    console.log(`[openfda] Fetching: ${url}`);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      errors.push(`OpenFDA API error: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
      console.error(`[openfda] API error: ${response.status}`);
      return { approvals_fetched: 0, matched_to_companies: 0, inserted: 0, errors };
    }

    const data = await response.json();
    const results: OpenFDAResult[] = data.results || [];
    approvalsFetched = results.length;
    console.log(`[openfda] Fetched ${approvalsFetched} approval records`);

    for (const result of results) {
      try {
        const sponsorRaw = result.sponsor_name || '';
        const sponsorUpper = sponsorRaw.toUpperCase().trim();

        // Try to match sponsor to a known company
        let companyName = SPONSOR_TO_COMPANY[sponsorUpper];
        if (!companyName) {
          // Try partial matching
          for (const [key, val] of Object.entries(SPONSOR_TO_COMPANY)) {
            if (sponsorUpper.includes(key) || key.includes(sponsorUpper)) {
              companyName = val;
              break;
            }
          }
        }

        if (!companyName) continue; // Skip if not a tracked company

        const companyId = nameToId.get(companyName.toLowerCase());
        if (!companyId) continue; // Skip if company not in our DB

        matchedToCompanies++;

        // Get the most recent original approval submission
        const approvalSubmission = (result.submissions || []).find(
          s => s.submission_type === 'ORIG' && s.submission_status === 'AP'
        );

        if (!approvalSubmission) continue;

        const approvalDate = parseSubmissionDate(approvalSubmission.submission_status_date);
        if (!approvalDate) continue;

        // Check for duplicates
        const sourceId = `openfda_${result.application_number}_${approvalSubmission.submission_number || 'ORIG'}`;
        const { data: existing } = await supabase
          .from('deals')
          .select('id')
          .eq('source_filing_id', sourceId)
          .limit(1)
          .single();

        if (existing) continue;

        // Extract drug info
        const brandName = result.openfda?.brand_name?.[0] || result.products?.[0]?.brand_name || null;
        const genericName = result.openfda?.generic_name?.[0] || result.products?.[0]?.generic_name || null;
        const substanceName = result.openfda?.substance_name?.[0] || null;
        const pharmClasses = [
          ...(result.openfda?.pharm_class_epc || []),
          ...(result.openfda?.pharm_class_moa || []),
        ];

        const therapeuticArea = deriveTherapeuticAreaFromFDA(pharmClasses);
        const indicationCategory = deriveIndicationCategory(pharmClasses);

        // Determine modality from product info
        const appNum = result.application_number || '';
        const isBiologic = appNum.startsWith('BLA');
        const modality = isBiologic ? 'antibody' : 'small_molecule';

        const assetName = brandName || genericName || substanceName;
        const assetDescription = [
          genericName && brandName ? `${genericName} (${brandName})` : (genericName || brandName),
          `FDA ${isBiologic ? 'BLA' : 'NDA'} ${result.application_number}`,
          pharmClasses.length > 0 ? `Class: ${pharmClasses[0]}` : null,
        ].filter(Boolean).join(' — ');

        const { error: insertError } = await supabase.from('deals').insert({
          licensor_name: companyName,
          licensor_id: companyId,
          licensee_name: 'FDA Approval', // Regulatory milestone, not a deal per se
          asset_name: assetName,
          asset_description: assetDescription,
          modality,
          indication_category: indicationCategory,
          phase_at_signing: 'approved',
          territory: 'us',
          territories_included: ['United States'],
          deal_type: 'other', // Regulatory milestone
          announced_date: approvalDate,
          source_type: 'openfda',
          source_url: `https://api.fda.gov/drug/drugsfda.json?search=application_number:${result.application_number}`,
          source_filing_id: sourceId,
          terms_disclosed: false,
          confidence_score: 95,
          extraction_model: 'openfda_api',
          extraction_timestamp: new Date().toISOString(),
          therapeutic_area: therapeuticArea,
        });

        if (insertError) {
          if (insertError.code !== '23505') { // Skip duplicates
            errors.push(`Insert ${sourceId}: ${insertError.message}`);
          }
        } else {
          inserted++;
          console.log(`[openfda] Inserted: ${companyName} — ${assetName} (${appNum})`);
        }
      } catch (error) {
        errors.push(`Processing error: ${error}`);
      }
    }

    // Also fetch supplemental approvals (sNDA/sBLA) for new indications
    const supplUrl = `${OPENFDA_BASE}?search=submissions.submission_type:"SUPPL"+AND+submissions.submission_status:"AP"+AND+submissions.submission_status_date:[${startStr}+TO+${endStr}]+AND+submissions.submission_class_code_description:"New+Indication"&limit=50`;

    try {
      const supplResponse = await fetch(supplUrl, {
        headers: { 'User-Agent': 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co' },
      });

      if (supplResponse.ok) {
        const supplData = await supplResponse.json();
        const supplResults: OpenFDAResult[] = supplData.results || [];
        console.log(`[openfda] Fetched ${supplResults.length} supplemental (new indication) records`);
        approvalsFetched += supplResults.length;

        for (const result of supplResults) {
          const sponsorRaw = result.sponsor_name || '';
          const sponsorUpper = sponsorRaw.toUpperCase().trim();
          let companyName = SPONSOR_TO_COMPANY[sponsorUpper];
          if (!companyName) {
            for (const [key, val] of Object.entries(SPONSOR_TO_COMPANY)) {
              if (sponsorUpper.includes(key) || key.includes(sponsorUpper)) {
                companyName = val;
                break;
              }
            }
          }
          if (!companyName) continue;
          const companyId = nameToId.get(companyName.toLowerCase());
          if (!companyId) continue;

          const newIndSubmission = (result.submissions || []).find(
            s => s.submission_type === 'SUPPL' &&
              s.submission_status === 'AP' &&
              s.submission_class_code_description?.includes('New Indication')
          );
          if (!newIndSubmission) continue;

          const approvalDate = parseSubmissionDate(newIndSubmission.submission_status_date);
          if (!approvalDate) continue;

          const sourceId = `openfda_${result.application_number}_SUPPL_${newIndSubmission.submission_number || 'NI'}`;
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .eq('source_filing_id', sourceId)
            .limit(1)
            .single();

          if (existing) continue;

          matchedToCompanies++;

          const brandName = result.openfda?.brand_name?.[0] || null;
          const genericName = result.openfda?.generic_name?.[0] || null;
          const pharmClasses = [
            ...(result.openfda?.pharm_class_epc || []),
            ...(result.openfda?.pharm_class_moa || []),
          ];

          const { error: insertError } = await supabase.from('deals').insert({
            licensor_name: companyName,
            licensor_id: companyId,
            licensee_name: 'FDA sNDA Approval',
            asset_name: brandName || genericName,
            asset_description: `New indication approval — ${genericName || brandName} (${result.application_number})`,
            modality: (result.application_number || '').startsWith('BLA') ? 'antibody' : 'small_molecule',
            indication_category: deriveIndicationCategory(pharmClasses),
            phase_at_signing: 'approved',
            territory: 'us',
            territories_included: ['United States'],
            deal_type: 'other',
            announced_date: approvalDate,
            source_type: 'openfda_suppl',
            source_url: `https://api.fda.gov/drug/drugsfda.json?search=application_number:${result.application_number}`,
            source_filing_id: sourceId,
            terms_disclosed: false,
            confidence_score: 95,
            extraction_model: 'openfda_api',
            extraction_timestamp: new Date().toISOString(),
            therapeutic_area: deriveTherapeuticAreaFromFDA(pharmClasses),
          });

          if (insertError && insertError.code !== '23505') {
            errors.push(`Suppl insert ${sourceId}: ${insertError.message}`);
          } else if (!insertError) {
            inserted++;
            console.log(`[openfda] New indication: ${companyName} — ${brandName || genericName}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Supplemental fetch error: ${error}`);
    }
  } catch (error) {
    errors.push(`OpenFDA fetch error: ${error}`);
  }

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'openfda',
    run_type: 'scheduled',
    parameters: { daysBack },
    records_fetched: approvalsFetched,
    records_processed: matchedToCompanies,
    records_inserted: inserted,
    records_failed: errors.length,
    errors: errors.slice(0, 50),
    status: errors.length > 0 ? 'partial' : 'completed',
    completed_at: new Date().toISOString(),
  });

  console.log(`[openfda] Done: ${approvalsFetched} fetched, ${matchedToCompanies} matched, ${inserted} inserted`);

  return {
    approvals_fetched: approvalsFetched,
    matched_to_companies: matchedToCompanies,
    inserted,
    errors,
  };
}

function formatFDADate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function parseSubmissionDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.length < 8) return null;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}
