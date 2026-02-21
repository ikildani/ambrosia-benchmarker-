// FDA Orange Book Patent/Exclusivity Ingestion
// Enriches company patent_cliffs from publicly available FDA data
//
// Data source: https://www.fda.gov/drugs/drug-approvals-and-databases/orange-book-data-files
// Format: Tilde (~) delimited text files in a ZIP archive

import type { SupabaseClient } from '@supabase/supabase-js';
import { unzipSync } from 'fflate';

// Top blockbuster drugs with estimated annual revenue (from public 10-K disclosures, 2024-2025)
// Used to enrich patent cliff entries with revenue context
const BLOCKBUSTER_REVENUE: Record<string, { revenue_usd: number; indication: string }> = {
  // Oncology
  'KEYTRUDA': { revenue_usd: 25000000000, indication: 'Oncology (PD-1)' },
  'OPDIVO': { revenue_usd: 9000000000, indication: 'Oncology (PD-1)' },
  'IMFINZI': { revenue_usd: 4000000000, indication: 'Oncology (PD-L1)' },
  'TAGRISSO': { revenue_usd: 5800000000, indication: 'Oncology (EGFR)' },
  'IBRANCE': { revenue_usd: 5100000000, indication: 'Oncology (CDK4/6)' },
  'VERZENIO': { revenue_usd: 3500000000, indication: 'Oncology (CDK4/6)' },
  'REVLIMID': { revenue_usd: 6000000000, indication: 'Hematology (IMiD)' },
  'DARZALEX': { revenue_usd: 9700000000, indication: 'Hematology (CD38)' },
  'POMALYST': { revenue_usd: 3500000000, indication: 'Hematology' },
  'IMBRUVICA': { revenue_usd: 4200000000, indication: 'Hematology (BTK)' },
  'LYNPARZA': { revenue_usd: 2700000000, indication: 'Oncology (PARP)' },
  'ENHERTU': { revenue_usd: 2900000000, indication: 'Oncology (ADC)' },
  'PADCEV': { revenue_usd: 1200000000, indication: 'Oncology (ADC)' },
  'TECENTRIQ': { revenue_usd: 4100000000, indication: 'Oncology (PD-L1)' },
  'XTANDI': { revenue_usd: 5100000000, indication: 'Oncology (Prostate)' },
  'NUBEQA': { revenue_usd: 1200000000, indication: 'Oncology (Prostate)' },
  'ERLEADA': { revenue_usd: 2500000000, indication: 'Oncology (Prostate)' },
  'LIBTAYO': { revenue_usd: 900000000, indication: 'Oncology (PD-1)' },
  'TRODELVY': { revenue_usd: 1300000000, indication: 'Oncology (ADC)' },

  // Immunology/Autoimmune
  'HUMIRA': { revenue_usd: 14400000000, indication: 'Autoimmune (TNF)' },
  'DUPIXENT': { revenue_usd: 11500000000, indication: 'Autoimmune (IL-4/13)' },
  'STELARA': { revenue_usd: 11000000000, indication: 'Autoimmune (IL-12/23)' },
  'SKYRIZI': { revenue_usd: 7700000000, indication: 'Autoimmune (IL-23)' },
  'RINVOQ': { revenue_usd: 4500000000, indication: 'Autoimmune (JAK)' },
  'COSENTYX': { revenue_usd: 5400000000, indication: 'Autoimmune (IL-17)' },
  'TALTZ': { revenue_usd: 2700000000, indication: 'Autoimmune (IL-17)' },
  'XELJANZ': { revenue_usd: 1600000000, indication: 'Autoimmune (JAK)' },
  'OTEZLA': { revenue_usd: 2500000000, indication: 'Autoimmune (PDE4)' },
  'BENLYSTA': { revenue_usd: 1100000000, indication: 'Autoimmune (Lupus)' },
  'ENBREL': { revenue_usd: 4000000000, indication: 'Autoimmune (TNF)' },
  'ENTYVIO': { revenue_usd: 5700000000, indication: 'Autoimmune (GI)' },

  // Metabolic
  'OZEMPIC': { revenue_usd: 18200000000, indication: 'Metabolic (GLP-1)' },
  'WEGOVY': { revenue_usd: 6600000000, indication: 'Metabolic (GLP-1 Obesity)' },
  'MOUNJARO': { revenue_usd: 11300000000, indication: 'Metabolic (GIP/GLP-1)' },
  'ZEPBOUND': { revenue_usd: 4500000000, indication: 'Metabolic (GIP/GLP-1 Obesity)' },
  'TRULICITY': { revenue_usd: 7400000000, indication: 'Metabolic (GLP-1)' },
  'JARDIANCE': { revenue_usd: 2500000000, indication: 'Metabolic (SGLT2)' },
  'FARXIGA': { revenue_usd: 5900000000, indication: 'Metabolic (SGLT2)' },

  // Cardiovascular
  'ELIQUIS': { revenue_usd: 18000000000, indication: 'Anticoagulant' },
  'ENTRESTO': { revenue_usd: 6500000000, indication: 'Heart Failure (ARNI)' },
  'REPATHA': { revenue_usd: 1800000000, indication: 'Cardiovascular (PCSK9)' },

  // Respiratory
  'TRELEGY ELLIPTA': { revenue_usd: 3300000000, indication: 'Respiratory (COPD)' },
  'NUCALA': { revenue_usd: 1700000000, indication: 'Respiratory (Asthma)' },

  // Neuroscience
  'VRAYLAR': { revenue_usd: 2800000000, indication: 'Psychiatry (Schizophrenia)' },
  'OCREVUS': { revenue_usd: 7200000000, indication: 'Multiple Sclerosis' },
  'TECFIDERA': { revenue_usd: 1800000000, indication: 'Multiple Sclerosis' },
  'TYSABRI': { revenue_usd: 1900000000, indication: 'Multiple Sclerosis' },
  'SPINRAZA': { revenue_usd: 1700000000, indication: 'SMA (Rare Disease)' },
  'BOTOX': { revenue_usd: 5400000000, indication: 'Neurology (Migraine/Movement)' },

  // Rare Disease / Other
  'TRIKAFTA': { revenue_usd: 9000000000, indication: 'Cystic Fibrosis' },
  'SOLIRIS': { revenue_usd: 4000000000, indication: 'Rare Disease (Complement)' },
  'ULTOMIRIS': { revenue_usd: 3800000000, indication: 'Rare Disease (Complement)' },
  'EYLEA': { revenue_usd: 9800000000, indication: 'Ophthalmology (VEGF)' },
  'BIKTARVY': { revenue_usd: 12000000000, indication: 'HIV' },
  'DOVATO': { revenue_usd: 1900000000, indication: 'HIV' },
  'GARDASIL': { revenue_usd: 8900000000, indication: 'HPV Vaccine' },
  'PROLIA': { revenue_usd: 4300000000, indication: 'Bone Health' },
  'XGEVA': { revenue_usd: 2000000000, indication: 'Bone Health' },
};

// Map applicant names (as they appear in Orange Book) to our company names
const APPLICANT_TO_COMPANY: Record<string, string> = {
  'PFIZER': 'Pfizer',
  'PFIZER INC': 'Pfizer',
  'PFIZER LABS': 'Pfizer',
  'MERCK SHARP DOHME': 'Merck',
  'MERCK SHARP & DOHME': 'Merck',
  'MERCK AND CO INC': 'Merck',
  'ABBVIE': 'AbbVie',
  'ABBVIE INC': 'AbbVie',
  'LILLY': 'Eli Lilly',
  'ELI LILLY': 'Eli Lilly',
  'ELI LILLY AND CO': 'Eli Lilly',
  'BRISTOL MYERS SQUIBB': 'Bristol-Myers Squibb',
  'BRISTOL-MYERS SQUIBB': 'Bristol-Myers Squibb',
  'JANSSEN': 'Johnson & Johnson',
  'JANSSEN BIOTECH': 'Johnson & Johnson',
  'JANSSEN PRODS': 'Johnson & Johnson',
  'JANSSEN PHARMS': 'Johnson & Johnson',
  'JOHNSON AND JOHNSON': 'Johnson & Johnson',
  'AMGEN': 'Amgen',
  'AMGEN INC': 'Amgen',
  'GILEAD': 'Gilead Sciences',
  'GILEAD SCIENCES': 'Gilead Sciences',
  'GILEAD SCIENCES INC': 'Gilead Sciences',
  'REGENERON': 'Regeneron',
  'REGENERON PHARMS': 'Regeneron',
  'ASTRAZENECA': 'AstraZeneca',
  'ASTRAZENECA AB': 'AstraZeneca',
  'ASTRAZENECA PHARMS': 'AstraZeneca',
  'NOVARTIS': 'Novartis',
  'NOVARTIS PHARMS': 'Novartis',
  'ROCHE': 'Roche',
  'GENENTECH': 'Roche',
  'GENENTECH INC': 'Roche',
  'SANOFI': 'Sanofi',
  'SANOFI AVENTIS': 'Sanofi',
  'GSK': 'GSK',
  'GLAXOSMITHKLINE': 'GSK',
  'GLAXO SMITHKLINE': 'GSK',
  'BIOGEN': 'Biogen',
  'BIOGEN INC': 'Biogen',
  'TAKEDA': 'Takeda',
  'TAKEDA PHARMS': 'Takeda',
  'BAYER': 'Bayer',
  'BAYER HEALTHCARE': 'Bayer',
  'VERTEX': 'Vertex',
  'VERTEX PHARMS': 'Vertex',
  'NOVO NORDISK': 'Novo Nordisk',
  'NOVO NORDISK INC': 'Novo Nordisk',
  'ASTELLAS': 'Astellas',
  'ASTELLAS PHARMA': 'Astellas',
  'DAIICHI SANKYO': 'Daiichi Sankyo',
  'DAIICHI SANKYO INC': 'Daiichi Sankyo',
  'MODERNA': 'Moderna',
  'MODERNA INC': 'Moderna',
  'INCYTE': 'Incyte',
  'INCYTE CORP': 'Incyte',
  'JAZZ PHARMS': 'Jazz Pharmaceuticals',
  'JAZZ PHARMACEUTICALS': 'Jazz Pharmaceuticals',
  'ALEXION': 'Alexion',
  'ALEXION PHARMS': 'Alexion',
  'BIOMARIN': 'BioMarin',
  'BIOMARIN PHARM': 'BioMarin',
  'ULTRAGENYX': 'Ultragenyx',
  'ULTRAGENYX PHARM': 'Ultragenyx',
  'SAREPTA': 'Sarepta Therapeutics',
  'SAREPTA THERAPEUTICS': 'Sarepta Therapeutics',
  'NEUROCRINE': 'Neurocrine Biosciences',
  'NEUROCRINE BIOSCIENCES': 'Neurocrine Biosciences',
  'SEAGEN': 'Seagen',
  'SEATTLE GENETICS': 'Seagen',
  'BOEHRINGER INGELHEIM': 'Boehringer Ingelheim',
  'TEVA': 'Teva',
  'TEVA PHARMS': 'Teva',
};

interface OrangeBookPatent {
  appl_type: string;
  appl_no: string;
  product_no: string;
  patent_no: string;
  patent_expire_date: string;
  drug_substance_flag: string;
  drug_product_flag: string;
  patent_use_code: string;
  delist_flag: string;
  submission_date: string;
}

interface OrangeBookProduct {
  ingredient: string;
  df_route: string;
  trade_name: string;
  applicant: string;
  strength: string;
  appl_type: string;
  appl_no: string;
  product_no: string;
  te_code: string;
  approval_date: string;
  type: string;
  applicant_full_name: string;
}

interface PatentCliffEntry {
  drug_name: string;
  indication: string;
  revenue_usd: number;
  expiry_year: number;
}

// Check drug_revenues table for live-updated revenue before falling back to hardcoded values
async function loadLiveRevenues(supabase: SupabaseClient): Promise<Map<string, number>> {
  const revenueMap = new Map<string, number>();
  try {
    const { data } = await supabase
      .from('drug_revenues')
      .select('drug_name_normalized, revenue_usd, fiscal_year')
      .eq('fiscal_period', 'FY')
      .order('fiscal_year', { ascending: false });

    // Keep only the most recent FY entry per drug
    for (const row of data || []) {
      if (!revenueMap.has(row.drug_name_normalized)) {
        revenueMap.set(row.drug_name_normalized, Number(row.revenue_usd));
      }
    }
  } catch {
    // Fallback to hardcoded if table doesn't exist yet or query fails
  }
  return revenueMap;
}

export async function ingestOrangeBookPatents(supabase: SupabaseClient): Promise<{
  matched: number;
  unmatched: number;
  companies_updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const liveRevenues = await loadLiveRevenues(supabase);

  try {
    // Step 1: Download Orange Book ZIP from FDA
    console.log('[orange-book] Downloading Orange Book data...');
    const zipResponse = await fetch('https://www.fda.gov/media/76860/download', {
      headers: {
        'User-Agent': 'Ambrosia Ventures Research research@ambrosiaventures.co',
      },
    });

    if (!zipResponse.ok) {
      throw new Error(`FDA download failed: ${zipResponse.status}`);
    }

    const zipArrayBuffer = await zipResponse.arrayBuffer();
    const zipData = new Uint8Array(zipArrayBuffer);
    console.log(`[orange-book] Downloaded ${(zipData.length / 1024 / 1024).toFixed(1)}MB`);

    // Step 2: Extract patent.txt and products.txt from ZIP using fflate
    const unzipped = unzipSync(zipData);
    const fileNames = Object.keys(unzipped);
    console.log(`[orange-book] ZIP contains: ${fileNames.join(', ')}`);

    const patentFileName = fileNames.find(f => f.toLowerCase().includes('patent'));
    const productFileName = fileNames.find(f => f.toLowerCase().includes('product'));

    if (!patentFileName || !productFileName) {
      throw new Error(`Could not find patent.txt or products.txt in ZIP. Files: ${fileNames.join(', ')}`);
    }

    const patentContent = new TextDecoder().decode(unzipped[patentFileName]);
    const productContent = new TextDecoder().decode(unzipped[productFileName]);

    console.log(`[orange-book] Parsing ${patentFileName} (${patentContent.length} chars) and ${productFileName} (${productContent.length} chars)...`);

    // Step 3: Parse tilde-delimited files
    const patents = parseTildeDelimited<OrangeBookPatent>(patentContent, [
      'appl_type', 'appl_no', 'product_no', 'patent_no', 'patent_expire_date',
      'drug_substance_flag', 'drug_product_flag', 'patent_use_code', 'delist_flag',
      'submission_date',
    ]);

    const products = parseTildeDelimited<OrangeBookProduct>(productContent, [
      'ingredient', 'df_route', 'trade_name', 'applicant', 'strength',
      'appl_type', 'appl_no', 'product_no', 'te_code', 'approval_date',
      'rld', 'rs', 'type', 'applicant_full_name',
    ]);

    console.log(`[orange-book] Parsed ${patents.length} patents, ${products.length} products`);

    // Step 4: Build product lookup by appl_no
    const productByAppl = new Map<string, OrangeBookProduct>();
    for (const p of products) {
      const key = `${p.appl_type}${p.appl_no}`;
      // Keep the first product entry (NDA/BLA preferred over ANDA)
      if (!productByAppl.has(key)) {
        productByAppl.set(key, p);
      }
    }

    // Step 5: Join patents with products, match to companies
    // Group by company → trade_name → latest patent expiry
    const companyPatents = new Map<string, Map<string, { expiry: Date; indication: string; revenue_usd: number }>>();

    let matched = 0;
    let unmatched = 0;

    for (const patent of patents) {
      // Skip delisted patents
      if (patent.delist_flag === 'Y') continue;

      const key = `${patent.appl_type}${patent.appl_no}`;
      const product = productByAppl.get(key);
      if (!product) continue;

      // Match applicant to our company name
      const companyName = matchApplicant(product.applicant, product.applicant_full_name);
      if (!companyName) {
        unmatched++;
        continue;
      }
      matched++;

      // Parse patent expiry date
      const expiryDate = parseDate(patent.patent_expire_date);
      if (!expiryDate) continue;

      // Only include patents expiring 2024-2040
      const expiryYear = expiryDate.getFullYear();
      if (expiryYear < 2024 || expiryYear > 2040) continue;

      const tradeName = product.trade_name.toUpperCase().trim();

      // Get revenue: check live DB first, then hardcoded fallback
      const blockbuster = BLOCKBUSTER_REVENUE[tradeName];
      const liveRevenue = liveRevenues.get(tradeName);
      const revenue = liveRevenue ?? blockbuster?.revenue_usd ?? 0;
      const indication = blockbuster?.indication || categorizeIndication(product.ingredient, product.df_route);

      // Skip non-blockbuster drugs (revenue = 0 and not in blockbuster list)
      // We still track them but with 0 revenue
      if (!companyPatents.has(companyName)) {
        companyPatents.set(companyName, new Map());
      }

      const companyDrugs = companyPatents.get(companyName)!;
      const existing = companyDrugs.get(tradeName);

      // Keep the latest expiry for each drug
      if (!existing || expiryDate > existing.expiry) {
        companyDrugs.set(tradeName, { expiry: expiryDate, indication, revenue_usd: revenue });
      }
    }

    console.log(`[orange-book] Matched ${matched} patent-product pairs, ${unmatched} unmatched`);

    // Step 6: Update companies in database
    let companiesUpdated = 0;

    // Get all companies for name matching
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('id, name, name_variations, patent_cliffs, data_sources');

    const companyNameToId = new Map<string, string>();
    const companyDataSources = new Map<string, string[]>();
    for (const c of allCompanies || []) {
      companyNameToId.set(c.name.toLowerCase(), c.id);
      companyDataSources.set(c.id, c.data_sources || []);
      for (const v of c.name_variations || []) {
        companyNameToId.set(v.toLowerCase(), c.id);
      }
    }

    for (const [companyName, drugs] of companyPatents) {
      const companyId = companyNameToId.get(companyName.toLowerCase());
      if (!companyId) continue;

      // Build patent_cliffs array, sorted by expiry year, limited to top drugs by revenue
      const cliffs: PatentCliffEntry[] = [];
      for (const [drugName, data] of drugs) {
        cliffs.push({
          drug_name: capitalizeWords(drugName),
          indication: data.indication,
          revenue_usd: data.revenue_usd,
          expiry_year: data.expiry.getFullYear(),
        });
      }

      // Sort: blockbusters first (by revenue desc), then by expiry year
      cliffs.sort((a, b) => b.revenue_usd - a.revenue_usd || a.expiry_year - b.expiry_year);

      // Keep top 8 most important drugs per company
      const topCliffs = cliffs.slice(0, 8);

      if (topCliffs.length === 0) continue;

      // Calculate revenue_at_risk by year
      const now = new Date().getFullYear();
      const riskByYear: Record<string, number> = {};
      for (let year = now; year <= now + 3; year++) {
        riskByYear[year.toString()] = topCliffs
          .filter(c => c.expiry_year === year)
          .reduce((sum, c) => sum + c.revenue_usd, 0);
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({
          patent_cliffs: topCliffs,
          revenue_at_risk_2025: riskByYear['2025'] || 0,
          revenue_at_risk_2026: riskByYear['2026'] || 0,
          revenue_at_risk_2027: riskByYear['2027'] || 0,
          data_sources: Array.from(new Set([...(companyDataSources.get(companyId) || []), 'fda_orange_book'])),
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      if (updateError) {
        errors.push(`${companyName}: ${updateError.message}`);
      } else {
        companiesUpdated++;
      }
    }

    console.log(`[orange-book] Updated ${companiesUpdated} companies with patent data`);

    return { matched, unmatched, companies_updated: companiesUpdated, errors };
  } catch (error) {
    console.error('[orange-book] Error:', error);
    errors.push(String(error));
    return { matched: 0, unmatched: 0, companies_updated: 0, errors };
  }
}

function parseTildeDelimited<T>(content: string, fields: string[]): T[] {
  const lines = content.split('\n').filter(l => l.trim());
  // Skip header line
  return lines.slice(1).map(line => {
    const values = line.split('~');
    const obj: Record<string, string> = {};
    for (let i = 0; i < fields.length && i < values.length; i++) {
      obj[fields[i]] = (values[i] || '').trim();
    }
    return obj as unknown as T;
  });
}

function matchApplicant(applicant: string, fullName: string): string | null {
  const normalized = (applicant || '').toUpperCase().trim();
  const normalizedFull = (fullName || '').toUpperCase().trim();

  // Direct match
  if (APPLICANT_TO_COMPANY[normalized]) return APPLICANT_TO_COMPANY[normalized];
  if (APPLICANT_TO_COMPANY[normalizedFull]) return APPLICANT_TO_COMPANY[normalizedFull];

  // Partial match — check if any key is a substring
  for (const [key, company] of Object.entries(APPLICANT_TO_COMPANY)) {
    if (normalized.includes(key) || normalizedFull.includes(key)) return company;
  }

  return null;
}

const MONTH_MAP: Record<string, number> = {
  'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
  'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
};

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // FDA Orange Book format: "Aug 24, 2026" or "Jan 1, 2030"
  const textMatch = dateStr.match(/^(\w{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (textMatch) {
    const month = MONTH_MAP[textMatch[1].toLowerCase()];
    if (month === undefined) return null;
    return new Date(parseInt(textMatch[3]), month, parseInt(textMatch[2]));
  }

  // Fallback: MM/DD/YYYY or YYYY-MM-DD
  const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
  if (parts.length !== 3) return null;

  let year: number, month: number, day: number;
  if (dateStr.includes('/')) {
    month = parseInt(parts[0]) - 1;
    day = parseInt(parts[1]);
    year = parseInt(parts[2]);
  } else {
    year = parseInt(parts[0]);
    month = parseInt(parts[1]) - 1;
    day = parseInt(parts[2]);
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month, day);
}

function categorizeIndication(ingredient: string, route: string): string {
  const ing = (ingredient || '').toLowerCase();
  const r = (route || '').toLowerCase();

  if (r.includes('ophthalmic')) return 'Ophthalmology';
  if (r.includes('inhalation') || r.includes('nasal')) return 'Respiratory';
  if (r.includes('topical') || r.includes('dermal')) return 'Dermatology';
  if (ing.includes('insulin') || ing.includes('metformin')) return 'Metabolic (Diabetes)';
  return 'Pharma';
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
