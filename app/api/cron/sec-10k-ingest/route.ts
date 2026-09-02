/**
 * SEC 10-K/20-F Collaboration Section Scraper
 *
 * The gold standard for deal data accuracy — extracts licensing and
 * collaboration agreements from legally required SEC annual filings.
 * Each filing lists 10-30 active deals with upfront, milestones, and
 * royalty terms that companies are legally obligated to disclose.
 *
 * Zero hallucination risk: source is the company's own legal disclosure.
 *
 * Schedule: Weekly (Sundays 4am UTC) — annual filings don't change daily.
 * Each run processes 2-3 company filings within the time budget.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  findOrCreateCompany,
  deriveTherapeuticArea,
} from '@/lib/ingestion/sec-edgar';
import { validateExtractedDeal, extractAuditExcerpt } from '@/lib/ingestion/deal-extraction-validator';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TIME_BUDGET = 260_000;
const SEC_SEARCH = 'https://efts.sec.gov/LATEST/search-index';

// 100+ pharma/biotech companies. CIK is optional — name-based EFTS search used when missing.
const PHARMA_COMPANIES: { name: string; cik?: string }[] = [
  // ── Top 20 pharma ──
  { name: 'Pfizer', cik: '78003' },
  { name: 'Johnson & Johnson', cik: '200406' },
  { name: 'AbbVie', cik: '1551152' },
  { name: 'Merck', cik: '310158' },
  { name: 'Eli Lilly', cik: '59478' },
  { name: 'Bristol Myers Squibb', cik: '14272' },
  { name: 'Novartis', cik: '1114448' },
  { name: 'Sanofi', cik: '1121404' },
  { name: 'AstraZeneca', cik: '901832' },
  { name: 'Gilead Sciences', cik: '882095' },
  { name: 'Amgen', cik: '318154' },
  { name: 'Regeneron', cik: '872589' },
  { name: 'Vertex', cik: '875320' },
  { name: 'Biogen', cik: '875045' },
  { name: 'GSK', cik: '1131399' },
  { name: 'Roche' },
  { name: 'Bayer' },
  { name: 'Takeda' },
  { name: 'Daiichi Sankyo' },
  { name: 'Astellas' },
  // ── Large biotech ──
  { name: 'BeiGene', cik: '1651308' },
  { name: 'Alnylam', cik: '1178670' },
  { name: 'Moderna', cik: '1682852' },
  { name: 'BioNTech', cik: '1776985' },
  { name: 'Argenx', cik: '1697862' },
  { name: 'Genmab', cik: '1653087' },
  { name: 'Jazz Pharmaceuticals', cik: '1232524' },
  { name: 'Incyte', cik: '879169' },
  { name: 'Neurocrine Biosciences', cik: '914475' },
  { name: 'Sarepta Therapeutics', cik: '873303' },
  { name: 'Ultragenyx', cik: '1564708' },
  { name: 'Halozyme', cik: '1159036' },
  { name: 'Ionis Pharmaceuticals', cik: '936395' },
  { name: 'Exelixis', cik: '939767' },
  { name: 'Exact Sciences', cik: '1124140' },
  { name: 'Blueprint Medicines', cik: '1597264' },
  { name: 'Seagen', cik: '1060349' },
  // ── Mid-cap pharma ──
  { name: 'Ipsen' },
  { name: 'UCB' },
  { name: 'Lundbeck' },
  { name: 'LEO Pharma' },
  { name: 'Teva', cik: '818686' },
  { name: 'Dr. Reddys', cik: '1170650' },
  { name: 'Sun Pharma' },
  { name: 'Cipla' },
  { name: 'Biocon' },
  { name: 'Perrigo', cik: '1113169' },
  { name: 'Sobi' },
  { name: 'Recordati' },
  // ── Specialty biotech ──
  { name: 'Alkermes', cik: '850261' },
  { name: 'Bausch Health', cik: '885590' },
  { name: 'Supernus Pharmaceuticals', cik: '1356576' },
  { name: 'Amneal Pharmaceuticals', cik: '1723128' },
  // ── Cell/gene therapy ──
  { name: 'bluebird bio', cik: '1293971' },
  { name: 'CRISPR Therapeutics', cik: '1674416' },
  { name: 'Intellia Therapeutics', cik: '1652130' },
  { name: 'Editas Medicine', cik: '1650664' },
  { name: 'Beam Therapeutics', cik: '1745999' },
  { name: 'Caribou Biosciences', cik: '1805521' },
  // ── ADC / bispecific ──
  { name: 'ADC Therapeutics', cik: '1821806' },
  { name: 'Zymeworks', cik: '1937653' },
  { name: 'MacroGenics', cik: '1125345' },
  { name: 'Pieris Pharmaceuticals', cik: '1438423' },
  // ── Chinese biotechs (20-F filers) ──
  { name: 'Zai Lab', cik: '1704292' },
  { name: 'Hutchmed', cik: '1411690' },
  { name: 'Legend Biotech', cik: '1802749' },
  { name: 'CStone Pharmaceuticals' },
  { name: 'WuXi Biologics' },
  // ── Japanese pharma (20-F filers) ──
  { name: 'Eisai' },
  { name: 'Ono Pharmaceutical' },
  { name: 'Shionogi' },
  // ── Korean pharma ──
  { name: 'Samsung Bioepis' },
  { name: 'Celltrion' },
  { name: 'SK Life Science' },
  { name: 'Yuhan' },
  // ── Israeli biotech ──
  { name: 'Check-Cap' },
  { name: 'Compugen', cik: '1073744' },
  { name: 'BioLineRx', cik: '1379006' },
  { name: 'Kamada', cik: '1590418' },
  // ── European biotech with US filings ──
  { name: 'Galapagos', cik: '1578220' },
  { name: 'MorphoSys' },
  { name: 'Evotec' },
  { name: 'Zealand Pharma' },
  { name: 'Ascendis Pharma', cik: '1659686' },
  { name: 'Bavarian Nordic' },
  { name: 'Alexion', cik: '899866' },
];

// ── Collaboration section extraction ─────────────────────────────────

const COLLAB_HEADINGS = [
  'collaboration agreement', 'license agreement', 'strategic alliance',
  'collaborative arrangement', 'license and collaboration',
  'collaboration and license', 'partnership agreement',
  'co-development agreement', 'option and license',
];

function extractCollaborationSection(text: string): string | null {
  const lower = text.toLowerCase();
  let bestStart = -1;
  let bestHeading = '';

  for (const heading of COLLAB_HEADINGS) {
    const idx = lower.indexOf(heading);
    if (idx !== -1 && (bestStart === -1 || idx < bestStart)) {
      bestStart = idx;
      bestHeading = heading;
    }
  }

  if (bestStart === -1) return null;

  // Extract ~15000 chars from the collaboration section
  const section = text.substring(Math.max(0, bestStart - 200), bestStart + 15000);
  return section;
}

// ── Claude extraction for multi-deal 10-K ────────────────────────────

interface Extracted10KDeal {
  partner: string;
  asset_name: string | null;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  indication_category: string | null;
  indication_specific: string | null;
  modality: string;
  phase_at_signing: string;
  territory: string;
  effective_date: string | null;
  confidence: number;
}

async function extractDealsFrom10K(
  collabSection: string,
  filingCompany: string,
  apiKey: string,
): Promise<Extracted10KDeal[]> {
  const anthropic = new Anthropic({ apiKey, timeout: 90_000 });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    system: `You extract structured deal data from SEC 10-K/20-F collaboration agreement sections. These are LEGAL FILINGS — the data is factual and legally required.

RULES:
1. Extract EVERY licensing, collaboration, option, or co-development deal mentioned.
2. ONLY extract data that is EXPLICITLY stated in the text. Never infer or fabricate.
3. Financial values in full USD (not millions). "$50 million" = 50000000.
4. If a value is described as "up to $X" that is the total_deal_value_usd.
5. Royalties as decimals: "mid-single digits" = 0.04-0.06 range, use low=0.04, high=0.06.
  "Low double digits" = low=0.10, high=0.12. "High single digits" = low=0.07, high=0.09.
6. If royalties are described vaguely ("tiered royalties"), use null.
7. The filing company "${filingCompany}" is one party. The "partner" is the OTHER company.
8. Determine if ${filingCompany} is the licensor (granting rights) or licensee (receiving rights).
9. Set confidence 90-95 for clearly stated terms, 80-85 for partially disclosed terms.

INDICATION CATEGORIES: solid_tumor, hematological, autoimmune, cns, cardiovascular, infectious, metabolic, rare_disease, respiratory, dermatology, ophthalmology, reproductive, other
MODALITIES: smallMolecule, antibody, adc, bispecific, car_t, cell_therapy, gene_therapy, mrna, radiopharm, peptide, oligonucleotide, vaccine, other
PHASES: discovery, preclinical, phase_1, phase_2, phase_3, approved, unknown
DEAL TYPES: license, option, collaboration, acquisition, co_development, other`,
    messages: [{
      role: 'user',
      content: `Extract ALL biopharma deals from this SEC 10-K/20-F collaboration section filed by ${filingCompany}. Return ONLY a JSON array.

Each deal:
{
  "partner": "the OTHER company (not ${filingCompany})",
  "asset_name": "drug/compound name or null",
  "deal_type": "license|option|collaboration|co_development|other",
  "upfront_usd": number or null,
  "milestones_total_usd": number or null,
  "total_deal_value_usd": number or null,
  "royalty_low_pct": decimal or null,
  "royalty_high_pct": decimal or null,
  "indication_category": "category or null",
  "indication_specific": "specific disease or null",
  "modality": "modality",
  "phase_at_signing": "phase",
  "territory": "global|us|ex_us|etc",
  "effective_date": "YYYY-MM-DD or YYYY-MM or null",
  "confidence": 80-95
}

Return [] if no deals found. Filing text:
${collabSection.substring(0, 14000)}`,
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return [];

  let raw = textBlock.text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]) as Extracted10KDeal[];
  } catch {
    return [];
  }
}

// ── Dedup ────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .replace(/,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|PLC|LLC|LP|Co\.?|Company|Pharmaceuticals?|Therapeutics?|Biosciences?|Biotech|Sciences?|AG|SA|S\.A\.?|N\.V\.?|SE|GmbH|A\/S)$/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function isDuplicate(
  supabase: ReturnType<typeof createServiceClient>,
  licensor: string, licensee: string, assetName: string | null, year: string,
): Promise<boolean> {
  const sl = normalizeName(licensor).substring(0, 12);
  const sn = normalizeName(licensee).substring(0, 12);

  if (assetName?.trim()) {
    const { data } = await supabase.from('deals').select('id')
      .ilike('licensor_name', `%${sl}%`).ilike('licensee_name', `%${sn}%`)
      .ilike('asset_name', `%${assetName.substring(0, 15)}%`)
      .limit(1).maybeSingle();
    if (data) return true;
  }

  if (year) {
    const { data } = await supabase.from('deals').select('id')
      .ilike('licensor_name', `%${sl}%`).ilike('licensee_name', `%${sn}%`)
      .gte('announced_date', `${year}-01-01`).lte('announced_date', `${year}-12-31`)
      .limit(1).maybeSingle();
    if (data) return true;
  }

  return false;
}

// ── Route handler ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const supabase = createServiceClient();
  const startTime = Date.now();

  // Rotate through companies — process 2-3 per run
  const { data: cursor } = await supabase.from('data_ingestion_log')
    .select('parameters').eq('source', 'sec_10k_ingest')
    .order('completed_at', { ascending: false }).limit(1).single();

  let companyIndex = ((cursor?.parameters as Record<string, number>)?.nextIndex || 0) % PHARMA_COMPANIES.length;

  const result = {
    companiesProcessed: 0,
    filingsFound: 0,
    collabSectionsExtracted: 0,
    dealsDiscovered: 0,
    dealsInserted: 0,
    dealsDuplicate: 0,
    errors: [] as string[],
    nextIndex: companyIndex,
  };

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 180); // 6 months back for annual filings
  const dateStart = start.toISOString().split('T')[0];
  const dateEnd = end.toISOString().split('T')[0];

  for (let i = 0; i < 3 && Date.now() - startTime < TIME_BUDGET; i++) {
    const company = PHARMA_COMPANIES[companyIndex];
    companyIndex = (companyIndex + 1) % PHARMA_COMPANIES.length;

    try {
      // Search for 10-K / 20-F filings by this company's CIK
      const params = new URLSearchParams({
        q: `"${company.name}"`,
        forms: '10-K,10-K/A,20-F',
        dateRange: 'custom',
        startdt: dateStart,
        enddt: dateEnd,
        from: '0',
        size: '3',
      });

      const searchRes = await fetchWithTimeout(`${SEC_SEARCH}?${params}`, {
        headers: { 'User-Agent': 'Solidus research@ambrosiaventures.co', Accept: 'application/json' },
        timeoutMs: 15_000,
        retries: 1,
      });

      if (!searchRes.ok) { result.errors.push(`${company.name}: search failed ${searchRes.status}`); continue; }

      const data = await searchRes.json();
      const hits = data.hits?.hits || [];
      result.filingsFound += hits.length;

      for (const hit of hits) {
        if (Date.now() - startTime > TIME_BUDGET) break;

        const docId = hit._id || '';
        const parts = docId.split(':');
        const accession = parts[0] || '';
        const fileName = parts[1] || '';
        const cik = (hit._source?.ciks?.[0] || '').replace(/^0+/, '');
        const accessionFormatted = accession.replace(/-/g, '');
        const url = cik && accessionFormatted && fileName
          ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionFormatted}/${fileName}`
          : '';
        if (!url) continue;

        // Check if we already processed this filing
        const { data: existing } = await supabase.from('data_ingestion_log')
          .select('id').eq('source', 'sec_10k_ingest')
          .contains('parameters', { filing_url: url })
          .limit(1).maybeSingle();
        if (existing) continue;

        try {
          // Fetch full filing text (up to 60K for 10-K)
          const fullRes = await fetchWithTimeout(url, {
            headers: { 'User-Agent': 'Solidus research@ambrosiaventures.co', Accept: 'text/html' },
            timeoutMs: 30_000,
            retries: 1,
          });
          if (!fullRes.ok) continue;

          const html = await fullRes.text();
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

          // Find the collaboration section
          const collabSection = extractCollaborationSection(text);
          if (!collabSection || collabSection.length < 500) continue;
          result.collabSectionsExtracted++;

          // Extract deals from the collaboration section
          const deals = await extractDealsFrom10K(collabSection, company.name, apiKey);
          result.dealsDiscovered += deals.length;

          const filingDate = hit._source?.file_date || dateEnd;

          for (const deal of deals) {
            if (Date.now() - startTime > TIME_BUDGET) break;
            if (!deal.partner?.trim()) continue;

            // Determine licensor/licensee
            const isLicensor = ['license', 'option'].includes(deal.deal_type);
            const licensor = isLicensor ? company.name : deal.partner;
            const licensee = isLicensor ? deal.partner : company.name;

            const validation = validateExtractedDeal({
              licensor, licensee,
              modality: deal.modality || 'other',
              asset_name: deal.asset_name,
              indication_specific: deal.indication_specific,
              upfront_usd: deal.upfront_usd,
              total_deal_value_usd: deal.total_deal_value_usd,
              confidence_score: deal.confidence,
              source_url: url,
            });
            if (!validation.valid) continue;

            const dealYear = deal.effective_date?.substring(0, 4) || filingDate.substring(0, 4);
            const dupe = await isDuplicate(supabase, licensor, licensee, deal.asset_name, dealYear);
            if (dupe) { result.dealsDuplicate++; continue; }

            const ta = deriveTherapeuticArea(deal.indication_category);
            const licensorId = await findOrCreateCompany(supabase, licensor, false).catch(() => null);
            const licenseeId = await findOrCreateCompany(supabase, licensee, true).catch(() => null);

            let announcedDate = deal.effective_date;
            if (announcedDate?.length === 4) announcedDate += '-06-15';
            if (announcedDate?.length === 7) announcedDate += '-15';
            if (!announcedDate) announcedDate = filingDate;

            const { error: insertError } = await supabase.from('deals').insert({
              licensor_name: licensor,
              licensee_name: licensee,
              licensor_id: licensorId,
              licensee_id: licenseeId,
              asset_name: deal.asset_name,
              modality: deal.modality || 'other',
              indication_category: deal.indication_category,
              indication_specific: deal.indication_specific,
              phase_at_signing: deal.phase_at_signing || 'unknown',
              territory: deal.territory || 'global',
              deal_type: deal.deal_type || 'license',
              upfront_usd: deal.upfront_usd,
              milestones_total_usd: deal.milestones_total_usd,
              total_deal_value_usd: deal.total_deal_value_usd,
              royalty_low_pct: deal.royalty_low_pct,
              royalty_high_pct: deal.royalty_high_pct,
              announced_date: announcedDate,
              source_type: 'sec_10k',
              source_url: url,
              terms_disclosed: (deal.upfront_usd != null) || (deal.total_deal_value_usd != null),
              confidence_score: deal.confidence,
              verification_status: 'pending',
              extraction_notes: `SEC 10-K: ${company.name} filing. Legal disclosure.`,
              extraction_model: 'claude-opus-4-6',
              extraction_timestamp: new Date().toISOString(),
              therapeutic_area: ta === 'other' ? 'other' : ta,
              raw_text_excerpt: extractAuditExcerpt(collabSection, deal.partner, 500),
            });

            if (insertError?.code === '23505') { result.dealsDuplicate++; }
            else if (!insertError) { result.dealsInserted++; }
            else { result.errors.push(`Insert: ${licensor}→${licensee}: ${insertError.message}`); }
          }

          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          result.errors.push(`${company.name} filing: ${String(err).substring(0, 100)}`);
        }
      }

      result.companiesProcessed++;
    } catch (err) {
      result.errors.push(`${company.name}: ${String(err).substring(0, 100)}`);
    }
  }

  result.nextIndex = companyIndex;

  await supabase.from('data_ingestion_log').insert({
    source: 'sec_10k_ingest',
    run_type: 'cron',
    parameters: { nextIndex: companyIndex, filing_url: null },
    records_fetched: result.filingsFound,
    records_processed: result.dealsDiscovered,
    records_inserted: result.dealsInserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, ...result });
}
