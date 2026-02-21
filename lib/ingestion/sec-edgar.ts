// SEC EDGAR Deal Intelligence Ingestion
// Extracts licensing deals from 8-K filings using Claude AI

import Anthropic from '@anthropic-ai/sdk';

const SEC_FULL_TEXT_SEARCH = 'https://efts.sec.gov/LATEST/search-index';
const SEC_COMPANY_SEARCH = 'https://data.sec.gov/submissions';

// Top 150+ pharma/biotech CIKs to monitor
export const PHARMA_CIKS: Record<string, string> = {
  // Large Pharma
  '78003': 'Pfizer',
  '310158': 'Merck',
  '14272': 'Abbott Laboratories',
  '1551152': 'AbbVie',
  '769397': 'Gilead Sciences',
  '318154': 'Amgen',
  '885535': 'Regeneron',
  '59478': 'Eli Lilly',
  '1739104': 'Takeda',
  '70858': 'Bristol-Myers Squibb',
  '21344': 'Johnson & Johnson',
  '1800': 'AstraZeneca',
  '1397187': 'Novartis',
  '1776985': 'Roche',
  '1110803': 'Sanofi',
  '1585364': 'GSK',
  '1776903': 'Novo Nordisk',

  // Large Biotech
  '1682852': 'Moderna',
  '875045': 'Vertex Pharmaceuticals',
  '765258': 'Alexion',
  '936402': 'BioMarin',
  '1124140': 'Incyte',
  '1276533': 'Bluebird Bio',
  '1159167': 'Seattle Genetics',
  '1368514': 'BioNTech',
  '1802768': 'Daiichi Sankyo',
  '1397723': 'Jazz Pharmaceuticals',
  '1142750': 'Neurocrine',
  '1018963': 'Alkermes',
  '1491924': 'Exact Sciences',
  '1418091': 'Ultragenyx',
  '1651308': 'Argenx',
  '913241': 'Biogen',

  // Rare Disease / Specialty
  '1629377': 'Sarepta Therapeutics',
  '1576263': 'Insmed',
  '1527599': 'Apellis Pharmaceuticals',

  // Ophthalmology
  '1167379': 'Alcon',

  // CV/Metabolic
  '1624512': 'BridgeBio Pharma',
  '1801417': 'Madrigal Pharmaceuticals',
  '1859690': 'Structure Therapeutics',

  // Respiratory/Immunology
  '818686': 'Teva',
  '1679363': 'Iovance Biotherapeutics',

  // Dermatology/Autoimmune
  '1750153': 'Roivant Sciences',
  '1787858': 'Arcutis Biotherapeutics',
  '1555280': 'Galapagos',

  // Mid-cap Pharma/Biotech
  '1545654': 'Blueprint Medicines',
  '1438423': 'Agios',
  '1493152': 'Rocket Pharmaceuticals',
  '1636050': 'Syndax Pharmaceuticals',
  '1526520': 'Protagonist Therapeutics',
  '1447028': 'Revolution Medicines',
  '1603466': 'Y-mAbs Therapeutics',
  '1821825': 'Legend Biotech',
  '1802749': 'Replimune',
  '1564406': 'Turning Point Therapeutics',
  '1564708': 'MacroGenics',
  '1592836': 'ImmunoGen',
  '1411685': 'Arcus Biosciences',
  '1653087': 'CRISPR Therapeutics',
  '1652130': 'Intellia Therapeutics',
  '1650664': 'Editas Medicine',
  '1745916': 'Beam Therapeutics',
  '1610950': 'Relay Therapeutics',
  '1588978': 'Nuvalent',
  '1713539': 'Recursion Pharmaceuticals',

  // Neuroscience
  '1566044': 'Intra-Cellular Therapies',
  '939767': 'Exelixis',

  // Gene/Cell Therapy
  '1637459': 'Allogene Therapeutics',
  '1585521': 'Autolus Therapeutics',
  '1702780': 'Caribou Biosciences',
  '1070698': 'Precision BioSciences',
  '1472468': 'Fate Therapeutics',
  '1636651': 'Poseida Therapeutics',

  // Radiopharmaceuticals
  '1521036': 'Lantheus',

  // Oligonucleotide
  '1178670': 'Alnylam',
  '936395': 'Ionis Pharmaceuticals',
  '1580608': 'Arrowhead Pharmaceuticals',

  // Chinese Biotech (US-listed)
  '1651625': 'BeiGene',
  '1704292': 'Zai Lab',
  '1564824': 'Hutchmed',

  // Regional
  '1478242': 'Zealand Pharma',
  '1649904': 'Rhythm Pharmaceuticals',
  '1634293': 'Travere Therapeutics',
  '1393584': 'Bicycle Therapeutics',

  // Immunology/Autoimmune
  '1671927': 'Immunocore',
  '1559053': 'Prothena',
  '1528115': 'Annexon Biosciences',
  '744218': 'Celldex Therapeutics',
  '1730430': 'Kiniksa Pharmaceuticals',
  '1851194': 'Ventyx Biosciences',
  '1808865': 'iTeos Therapeutics',
  '1340243': 'MorphoSys',

  // Metabolic/Endocrine
  '1607678': 'Viking Therapeutics',
  '1326190': 'Altimmune',
  '1744659': 'Akero Therapeutics',
  '1785173': '89bio',
  '1831363': 'Terns Pharmaceuticals',
  '1270073': 'Intercept Pharmaceuticals',
  '1727196': 'Scholar Rock',

  // Mid-cap Oncology
  '1651311': 'Merus',
  '1771910': 'ADC Therapeutics',
  '1382101': 'Sutro Biopharma',
  '1761918': 'Erasca',
  '1789972': 'Cullinan Oncology',
  '1894562': 'Prime Medicine',

  // Neuroscience additions
  '1582313': 'Xenon Pharmaceuticals',
  '1714899': 'Denali Therapeutics',
  '1070494': 'Acadia Pharmaceuticals',
  '1597553': 'Sage Therapeutics',
  '1805387': 'Cerevel Therapeutics',
};

// Search terms for licensing deals
const DEAL_SEARCH_TERMS = [
  '"license agreement"',
  '"collaboration agreement"',
  '"exclusive license"',
  '"option agreement"',
  '"co-development agreement"',
  '"strategic collaboration"',
  '"research collaboration"',
  '"commercialization agreement"',
  '"asset acquisition"',
  '"technology license"',
];

export interface SECFiling {
  accessionNumber: string;
  cik: string;
  companyName: string;
  filingDate: string;
  form: string;
  description: string;
  documentUrl: string;
  fileNumber: string;
}

export interface MilestoneDetail {
  description: string;
  amount_usd: number;
  type: 'development' | 'regulatory' | 'commercial' | 'sales';
}

export interface SalesMilestone {
  threshold_usd: number;
  payment_usd: number;
}

export interface ExtractedDeal {
  licensor: string;
  licensee: string;
  asset_name: string | null;
  asset_description: string | null;
  modality: string;
  indication_category: string | null;
  indication_specific: string | null;
  target: string | null;
  mechanism_of_action: string | null;
  phase_at_signing: string;
  territory: string | null;
  territories_included: string[];
  exclusivity: string;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  milestones_development_usd: number | null;
  milestones_regulatory_usd: number | null;
  milestones_commercial_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  total_deal_value_usd: number | null;
  equity_investment_usd: number | null;
  includes_manufacturing: boolean;
  includes_co_development: boolean;
  includes_co_promotion: boolean;
  option_exercise_fee: number | null;
  // Rich term fields
  milestone_details: MilestoneDetail[] | null;
  sales_milestones: SalesMilestone[] | null;
  research_funding_usd: number | null;
  profit_share_pct: number | null;
  cost_share_ratio: number | null;
  opt_in_rights: string | null;
  opt_in_stage: string | null;
  regulatory_designations: string[];
  term_years: number | null;
  sublicense_rights: boolean | null;
  rights_retained: string | null;
  indications_licensed: number | null;
  includes_diagnostics: boolean;
  confidence_score: number;
  extraction_notes: string | null;
  therapeutic_area: string | null;
}

export async function searchRecentFilings(daysBack: number = 1): Promise<SECFiling[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const allFilings: SECFiling[] = [];
  const seenAccessions = new Set<string>();

  for (const term of DEAL_SEARCH_TERMS) {
    try {
      const params = new URLSearchParams({
        q: term,
        dateRange: 'custom',
        startdt: formatDate(startDate),
        enddt: formatDate(endDate),
        forms: '8-K,8-K/A,6-K',
        from: '0',
        size: '100',
      });

      const response = await fetch(`${SEC_FULL_TEXT_SEARCH}?${params}`, {
        headers: {
          'User-Agent': 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`SEC search failed for "${term}": ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data.hits?.hits) {
        for (const hit of data.hits.hits) {
          const accession = hit._source.accession_number;
          if (seenAccessions.has(accession)) continue;
          seenAccessions.add(accession);

          const cik = hit._source.cik.toString().padStart(10, '0');
          const accessionFormatted = accession.replace(/-/g, '');

          allFilings.push({
            accessionNumber: accession,
            cik: hit._source.cik,
            companyName: hit._source.display_names?.[0] || 'Unknown',
            filingDate: hit._source.file_date,
            form: hit._source.form,
            description: hit._source.display_names?.[0] || '',
            documentUrl: `https://www.sec.gov/Archives/edgar/data/${hit._source.cik}/${accessionFormatted}/${hit._source.file_name}`,
            fileNumber: hit._source.file_num || '',
          });
        }
      }

      // Rate limiting - be respectful to SEC servers
      await sleep(200);
    } catch (error) {
      console.error(`SEC search error for "${term}":`, error);
    }
  }

  return allFilings;
}

export async function fetchFilingContent(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Ambrosia Ventures Deal Calculator research@ambrosiaventures.co',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filing: ${response.status}`);
  }

  const html = await response.text();

  // Extract text from HTML
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Return first 20000 chars to manage token usage while capturing deal details
  return text.substring(0, 20000);
}

export async function extractDealFromFiling(
  filingText: string,
  anthropicApiKey: string
): Promise<ExtractedDeal | null> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const systemPrompt = `You are an expert biopharma deal analyst extracting licensing deal information from SEC 8-K filings. You extract deal terms at the depth a BD professional needs for benchmarking and term sheet structuring.

Your task is to identify and extract structured deal data. Be precise and conservative:
- Only extract information that is explicitly stated
- Use null for fields that are not clearly disclosed
- Financial values should be in USD (convert millions/billions to full numbers)
- Royalty percentages should be decimals (e.g., 0.15 for 15%)
- Be especially careful with party roles: licensor grants rights, licensee receives rights

MODALITY VALUES (use exactly):
small_molecule, antibody, adc, bispecific, car_t, cell_therapy, gene_therapy, mrna, radiopharm, peptide, oligonucleotide, vaccine, other

INDICATION CATEGORIES (use exactly):
solid_tumor, hematological, autoimmune, cns, cardiovascular, infectious, metabolic, rare_disease, respiratory, dermatology, ophthalmology, other

For indication_category, classify carefully beyond oncology: use 'autoimmune' for immunology/inflammatory conditions (rheumatoid arthritis, lupus, IBD, Crohn's, psoriasis, atopic dermatitis, multiple sclerosis), 'metabolic' for metabolic conditions (diabetes, obesity, NASH/MASH, fatty liver, lipid disorders, thyroid), 'cardiovascular' for heart/vascular conditions, 'infectious' for infectious diseases. Do not default to 'other' when a more specific category applies.

PHASE VALUES (use exactly):
discovery, preclinical, phase_1, phase_2, phase_3, approved, unknown

TERRITORY VALUES (use exactly):
global, us, ex_us, us_eu, us_eu_japan, china, japan, asia_pacific, europe, regional, other

DEAL TYPE VALUES (use exactly):
license, option, collaboration, acquisition, co_development, co_promotion, other

EXCLUSIVITY VALUES (use exactly):
exclusive, co_exclusive, non_exclusive, unknown

REGULATORY DESIGNATION VALUES (use exactly, array):
breakthrough, fast_track, orphan, priority_review, rmat, prime, accelerated

MILESTONE EXTRACTION GUIDELINES:
- Extract INDIVIDUAL milestones when disclosed (e.g., "$10M upon IND filing", "$50M upon Phase 3 initiation")
- Classify each as development (IND, Phase starts, enrollment), regulatory (filing, approval), commercial/sales (revenue thresholds)
- Sales milestones are triggered by net sales thresholds (e.g., "$100M upon reaching $1B net sales")
- Separate sales milestones into the sales_milestones array with threshold and payment

DEAL STRUCTURE DETAILS:
- Look for opt-in/opt-out provisions (common in option deals — e.g., "option to co-develop after Phase 2 data")
- Look for profit-sharing vs royalty structures (co-development deals often split profits instead of paying royalties)
- Look for cost-sharing ratios (e.g., "50/50 cost share through Phase 2, 70/30 thereafter")
- Look for research funding commitments separate from upfront payments
- Note rights retained by licensor (e.g., "licensor retains rights in Greater China", "co-promote rights in US")
- Note contract duration/term if mentioned
- Count number of indications licensed (single vs multi-indication deals)
- Note companion diagnostic rights if mentioned`;

  const userPrompt = `Extract the licensing/collaboration deal from this SEC 8-K filing. Return ONLY valid JSON.

If this is NOT a biopharma licensing/collaboration deal (e.g., it's about employment, stock, governance, etc.), return:
{"is_deal": false, "reason": "brief explanation"}

If it IS a deal, return this structure:
{
  "licensor": "company name granting rights",
  "licensee": "company name receiving rights",
  "asset_name": "drug/compound name or code, or null",
  "asset_description": "brief description of the asset, or null",
  "modality": "one of the modality values",
  "indication_category": "one of the indication categories, or null",
  "indication_specific": "specific disease (e.g., 'nsclc', 'aml', 'lupus'), or null",
  "target": "molecular target (e.g., 'HER2', 'PD-1', 'CD19'), or null",
  "mechanism_of_action": "brief MOA description, or null",
  "phase_at_signing": "one of the phase values",
  "territory": "one of the territory values, or null",
  "territories_included": ["array", "of", "specific", "territories"],
  "exclusivity": "one of the exclusivity values",
  "deal_type": "one of the deal type values",
  "upfront_usd": number or null,
  "milestones_total_usd": number or null,
  "milestones_development_usd": number or null,
  "milestones_regulatory_usd": number or null,
  "milestones_commercial_usd": number or null,
  "royalty_low_pct": decimal or null (e.g., 0.10 for 10%),
  "royalty_high_pct": decimal or null,
  "total_deal_value_usd": number or null,
  "equity_investment_usd": number or null,
  "includes_manufacturing": boolean,
  "includes_co_development": boolean,
  "includes_co_promotion": boolean,
  "option_exercise_fee": number or null,
  "milestone_details": [{"description": "milestone name", "amount_usd": number, "type": "development|regulatory|commercial|sales"}] or null,
  "sales_milestones": [{"threshold_usd": number, "payment_usd": number}] or null,
  "research_funding_usd": number or null,
  "profit_share_pct": decimal or null (e.g., 0.50 for 50%),
  "cost_share_ratio": decimal or null (e.g., 0.50 for 50/50),
  "opt_in_rights": "description of opt-in/opt-out provisions, or null",
  "opt_in_stage": "phase at which opt-in can occur, or null",
  "regulatory_designations": ["array of designations like breakthrough, fast_track, orphan, priority_review, rmat, prime, accelerated"],
  "term_years": number or null,
  "sublicense_rights": boolean or null,
  "rights_retained": "what licensor retains (e.g., 'co-promote US, Japan rights'), or null",
  "indications_licensed": number or null (count of indications covered),
  "includes_diagnostics": boolean,
  "confidence_score": 0-100 (how confident you are in this extraction),
  "extraction_notes": "any important caveats or notes about the extraction"
}

Filing text:
${filingText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== 'text') return null;

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.is_deal === false) {
      console.log(`Not a deal: ${parsed.reason}`);
      return null;
    }

    return parsed as ExtractedDeal;
  } catch (error) {
    console.error('Deal extraction error:', error);
    return null;
  }
}

export async function findOrCreateCompany(
  supabase: any,
  companyName: string,
  isLicensee: boolean = false
): Promise<string | null> {
  if (!companyName) return null;

  const normalizedName = normalizeCompanyName(companyName);

  // Try to find existing company (escape SQL pattern chars to prevent injection)
  const safeName = escapeLikePattern(normalizedName);
  const safeArrayName = escapeArrayLiteral(companyName);
  const { data: existing } = await supabase
    .from('companies')
    .select('id, name, name_variations')
    .or(`name.ilike.%${safeName}%,name_variations.cs.{${safeArrayName}}`)
    .limit(1)
    .single();

  if (existing) {
    // Add name variation if not present
    if (!existing.name_variations?.includes(companyName)) {
      await supabase
        .from('companies')
        .update({
          name_variations: [...(existing.name_variations || []), companyName],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new company
  const { data: newCompany, error } = await supabase
    .from('companies')
    .insert({
      name: companyName,
      name_variations: [companyName],
      actively_acquiring: isLicensee,
      data_sources: ['sec_edgar'],
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating company:', error);
    return null;
  }

  return newCompany.id;
}

export async function runDailyIngestion(
  supabase: any,
  anthropicApiKey: string,
  daysBack: number = 1
): Promise<{ processed: number; deals: number; errors: string[] }> {
  console.log(`Starting SEC EDGAR ingestion for last ${daysBack} day(s)...`);

  // Log ingestion start
  const { data: logEntry } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'sec_edgar',
      run_type: 'scheduled',
      parameters: { daysBack },
    })
    .select('id')
    .single();

  const logId = logEntry?.id;
  const errors: string[] = [];
  let processed = 0;
  let dealsExtracted = 0;
  let skipped = 0;

  try {
    const filings = await searchRecentFilings(daysBack);
    console.log(`Found ${filings.length} potential filings`);

    for (const filing of filings) {
      try {
        // Check if already processed
        const { data: existingDeal } = await supabase
          .from('deals')
          .select('id')
          .eq('source_filing_id', filing.accessionNumber)
          .single();

        if (existingDeal) {
          skipped++;
          continue;
        }

        // Fetch and extract
        const content = await fetchFilingContent(filing.documentUrl);
        const deal = await extractDealFromFiling(content, anthropicApiKey);

        if (deal && deal.confidence_score >= 75) {
          // Find or create companies
          const licensorId = await findOrCreateCompany(supabase, deal.licensor, false);
          const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true);

          // Derive therapeutic_area from indication_category
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
            // Rich term fields
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
            announced_date: filing.filingDate,
            source_type: 'sec_8k',
            source_url: filing.documentUrl,
            source_filing_id: filing.accessionNumber,
            terms_disclosed: deal.upfront_usd !== null || deal.milestones_total_usd !== null,
            confidence_score: deal.confidence_score,
            extraction_model: 'claude-sonnet-4-20250514',
            extraction_timestamp: new Date().toISOString(),
            therapeutic_area: therapeuticArea,
          });

          if (insertError) {
            errors.push(`Insert error for ${filing.accessionNumber}: ${insertError.message}`);
          } else {
            dealsExtracted++;
            console.log(`Extracted deal: ${deal.licensor} -> ${deal.licensee} (${deal.modality})`);
          }
        }

        processed++;

        // Rate limiting
        await sleep(1000);
      } catch (error) {
        const errorMsg = `Error processing ${filing.accessionNumber}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Update log entry
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          records_fetched: filings.length,
          records_processed: processed,
          records_inserted: dealsExtracted,
          records_skipped: skipped,
          records_failed: errors.length,
          errors: errors.slice(0, 50),
          status: errors.length > 0 ? 'partial' : 'completed',
        })
        .eq('id', logId);
    }

    console.log(`SEC EDGAR ingestion complete: ${processed} processed, ${dealsExtracted} deals extracted`);

    return { processed, deals: dealsExtracted, errors };
  } catch (error) {
    // Update log with failure
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          errors: [String(error)],
        })
        .eq('id', logId);
    }
    throw error;
  }
}

// Helper functions
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function deriveTherapeuticArea(indicationCategory: string | null): string {
  if (!indicationCategory) return 'other';
  switch (indicationCategory) {
    case 'solid_tumor':
    case 'hematological':
      return 'oncology';
    case 'cns':
      return 'neurology';
    case 'autoimmune':
      return 'immunology';
    case 'metabolic':
      return 'metabolic';
    default:
      return 'other';
  }
}

function normalizeCompanyName(name: string): string {
  return name
    .replace(/,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|PLC|LLC|LP|Co\.?)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

function escapeArrayLiteral(str: string): string {
  return str.replace(/[{}"\\,]/g, '\\$&');
}
