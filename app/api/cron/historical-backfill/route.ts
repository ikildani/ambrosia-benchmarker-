/**
 * Historical Deal Backfill Pipeline
 *
 * Systematically fills gaps in the deals database by targeting underrepresented
 * year-TA combinations. Uses Perplexity to discover real deals, Claude to extract
 * structured terms, and source URL verification to prevent hallucinated data.
 *
 * Anti-hallucination guards:
 *   1. Every deal requires a source_url
 *   2. Source URLs are verified with HEAD requests before insertion
 *   3. Claude extraction prompt explicitly forbids fabrication
 *   4. Shared deal-extraction-validator catches known fabrication patterns
 *   5. Confidence score must be >= 75
 *   6. Dedup against existing licensor+licensee pairs
 *
 * Schedule: every 6 hours (30 */6 * * *)
 * Expected yield: 5-15 verified deals per run
 * Cost: ~$0.10/run (3-4 Perplexity queries + 3-4 Claude extractions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { validateExtractedDeal } from '@/lib/ingestion/deal-extraction-validator';
import { findOrCreateCompany, deriveTherapeuticArea } from '@/lib/ingestion/sec-edgar';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════
// GAP QUERIES — targets underrepresented year-TA combinations
// ═══════════════════════════════════════════════════════════════════════

interface GapQuery {
  ta: string;
  yearRange: string;
  query: string;
}

const GAP_QUERIES: GapQuery[] = [
  // ── Cardiovascular (50 deals total, 0-3 per year 2019-2022) ──────────
  { ta: 'cardiovascular', yearRange: '2019-2020', query: 'List all biopharma licensing deals for cardiovascular diseases announced in 2019 and 2020. Include heart failure, hypertension, atrial fibrillation, cardiomyopathy, PAH, and thrombosis deals. For each deal provide: licensor company name, licensee company name, drug or asset name, upfront payment amount, total deal value, milestone payments, royalty rates, development phase, announced date, and a link to the press release or SEC filing.' },
  { ta: 'cardiovascular', yearRange: '2020-2021', query: 'List all cardiovascular drug licensing agreements and partnerships from 2020 and 2021 with disclosed financial terms. Include PCSK9 deals, Lp(a) deals, Factor XI deals, angiotensinogen deals, siRNA cardiovascular programs. Provide company names, drug names, deal values, upfront payments, and source URLs for each deal.' },
  { ta: 'cardiovascular', yearRange: '2021-2022', query: 'Biopharma acquisitions and licensing deals for cardiovascular and cardiometabolic drugs in 2021 and 2022. Include MyoKardia, Acceleron, CinCor, BridgeBio cardiovascular assets, and other heart failure, PAH, and hypertension deals. Provide exact financial terms and source links.' },
  { ta: 'cardiovascular', yearRange: '2022-2023', query: 'Cardiovascular drug licensing deals and acquisitions 2022-2023 with financial terms disclosed. Include siRNA, antisense, small molecule, and antibody deals for heart failure, atrial fibrillation, thrombosis, and cardiomyopathy. List company names, asset names, deal values, and press release URLs.' },

  // ── Metabolic (42 deals total, 0-2 per year 2019-2021) ───────────────
  { ta: 'metabolic', yearRange: '2019-2020', query: 'List all biopharma licensing deals for metabolic diseases in 2019 and 2020. Include diabetes, NASH/MASH, obesity, dyslipidemia deals. Provide licensor name, licensee name, drug name, upfront payment, milestones, total value, phase, announced date, and press release or filing URL.' },
  { ta: 'metabolic', yearRange: '2020-2021', query: 'NASH liver disease and metabolic drug licensing agreements 2020-2021 with financial terms. Include GLP-1 deals, SGLT2 deals, FXR agonist deals, PPAR agonist deals. List company names, asset names, deal values, and source URLs.' },
  { ta: 'metabolic', yearRange: '2021-2022', query: 'Obesity and diabetes drug licensing deals and acquisitions 2021-2022. Include all GLP-1 agonist deals, dual incretin deals, amylin analog deals, and NASH/MASH programs with disclosed financial terms. Provide company names, drug names, exact deal values, and source links.' },
  { ta: 'metabolic', yearRange: '2022-2023', query: 'List all obesity, GLP-1, and metabolic disease licensing deals announced in 2022 and 2023 with upfront payments and milestone structures. Include Novo Nordisk, Lilly, Amgen, AstraZeneca, Roche, Viking, Structure Therapeutics deals. Provide source URLs.' },

  // ── Ophthalmology (31 deals total, 0-1 per year 2019-2021) ───────────
  { ta: 'ophthalmology', yearRange: '2019-2021', query: 'List all ophthalmology drug licensing deals from 2019, 2020, and 2021. Include wet AMD, dry AMD, glaucoma, diabetic retinopathy, dry eye, gene therapy for retinal diseases. Provide licensor, licensee, drug name, financial terms (upfront, milestones, total value), and source URL for each deal.' },
  { ta: 'ophthalmology', yearRange: '2021-2023', query: 'Ophthalmology drug acquisitions and licensing agreements 2021-2023 including Iveric Bio, Aerie Pharmaceuticals, Oyster Point, and other eye disease deals. Include anti-VEGF, complement inhibitor, gene therapy, and cell therapy deals for eye diseases with financial terms and source links.' },
  { ta: 'ophthalmology', yearRange: '2023-2025', query: 'Recent ophthalmology licensing deals and partnerships 2023-2025 for AMD, glaucoma, geographic atrophy, diabetic macular edema with disclosed financial terms. Include bilateral and cross-border deals. Provide company names, drug names, deal economics, and press release URLs.' },

  // ── Dermatology (30 deals total, 0-2 per year 2019-2022) ─────────────
  { ta: 'dermatology', yearRange: '2019-2021', query: 'List all dermatology drug licensing deals and partnerships from 2019, 2020, and 2021. Include atopic dermatitis, psoriasis, vitiligo, alopecia areata, hidradenitis suppurativa, and acne deals. Provide licensor, licensee, drug name, financial terms, development phase, and source URL.' },
  { ta: 'dermatology', yearRange: '2021-2023', query: 'Dermatology drug acquisitions and licensing agreements 2021-2023 with financial terms. Include IL-13, IL-31, IL-17, OX40L, JAK inhibitor, and TYK2 inhibitor deals for skin diseases. Include Dermavant, Arena, Concert Pharmaceuticals deals. Provide source links.' },
  { ta: 'dermatology', yearRange: '2023-2025', query: 'Recent dermatology licensing deals 2023-2025 for atopic dermatitis, psoriasis, vitiligo, alopecia, chronic urticaria with disclosed financial terms including upfront payments and milestones. Provide company names, drug names, deal values, and press release URLs.' },

  // ── Gastroenterology (30 deals total, 0-1 per year 2019-2021) ────────
  { ta: 'gastroenterology', yearRange: '2019-2021', query: 'List all gastroenterology drug licensing deals from 2019, 2020, and 2021. Include IBD, Crohn\'s disease, ulcerative colitis, celiac disease, eosinophilic esophagitis, and GERD deals. Provide company names, drug names, upfront payments, milestones, total deal value, and source URLs.' },
  { ta: 'gastroenterology', yearRange: '2021-2023', query: 'GI drug acquisitions and licensing agreements 2021-2023 with financial terms. Include TL1A antibody deals (Prometheus, Roivant), integrin inhibitor deals (Morphic), S1P1 deals, and other IBD programs. Provide exact deal economics and source links.' },
  { ta: 'gastroenterology', yearRange: '2023-2025', query: 'Recent gastroenterology licensing deals 2023-2025 for IBD, Crohn\'s, UC, celiac, EoE, GERD with disclosed financial terms. Include TL1A, IL-23, integrin, and MAdCAM-1 deals. Provide company names, drug names, deal values, and press release URLs.' },

  // ── Hematology (27 deals total, 0-3 per year 2019-2022) ──────────────
  { ta: 'hematology', yearRange: '2019-2021', query: 'List all hematology drug licensing deals from 2019, 2020, and 2021. Include sickle cell disease, hemophilia, thalassemia, MDS, myelofibrosis, and thrombocytopenia deals. Also include CAR-T licensing for blood cancers. Provide company names, drug names, financial terms, and source URLs.' },
  { ta: 'hematology', yearRange: '2021-2023', query: 'Hematology drug acquisitions and licensing agreements 2021-2023 with disclosed terms. Include gene therapy for hemophilia and SCD, bispecific antibody deals for lymphoma and myeloma, BTK inhibitor licensing deals. Provide deal values and source links.' },
  { ta: 'hematology', yearRange: '2023-2025', query: 'Recent hematology licensing deals 2023-2025 for blood cancers, sickle cell, hemophilia, thalassemia with financial terms. Include CAR-T, bispecific, ADC, and gene therapy deals. Provide company names, drug names, upfront payments, milestones, and press release URLs.' },

  // ── Respiratory (1 deal total!) ───────────────────────────────────────
  { ta: 'respiratory', yearRange: '2019-2022', query: 'List all respiratory drug licensing deals and partnerships from 2019 to 2022. Include asthma, COPD, IPF, cystic fibrosis, PAH, and bronchiectasis deals. Provide licensor, licensee, drug name, financial terms (upfront, milestones, total value, royalties), development phase, and press release or SEC filing URL.' },
  { ta: 'respiratory', yearRange: '2022-2024', query: 'Respiratory drug licensing agreements and acquisitions 2022-2024 with financial terms. Include inhaled biologics, TSLP deals, IL-33 deals, IL-4/IL-13 respiratory programs, anti-TSLP, and cystic fibrosis modulator deals. Provide company names, drug names, deal economics, and source links.' },
  { ta: 'respiratory', yearRange: '2024-2026', query: 'Recent respiratory drug deals 2024-2026 for asthma, COPD, IPF, and lung diseases with disclosed financial terms including upfront payments and milestones. Provide company names, drug names, deal values, and press release URLs.' },

  // ── Neurology (gaps in 2019-2021) ────────────────────────────────────
  { ta: 'neurology', yearRange: '2019-2020', query: 'List all neurology and CNS drug licensing deals from 2019 and 2020. Include Alzheimer\'s, Parkinson\'s, epilepsy, migraine, ALS, MS, and depression deals. Provide licensor, licensee, drug name, upfront payment, milestones, total deal value, phase, and source URL or press release link.' },
  { ta: 'neurology', yearRange: '2020-2021', query: 'CNS and neuroscience drug licensing agreements 2020-2021 with disclosed financial terms. Include CGRP migraine deals, gene therapy for neurological diseases, antisense deals for ALS/SMA/Huntington\'s. Provide company names, drug names, deal values, and source links.' },

  // ── Immunology (gaps in 2019-2021) ───────────────────────────────────
  { ta: 'immunology', yearRange: '2019-2020', query: 'List all autoimmune and immunology drug licensing deals from 2019 and 2020. Include rheumatoid arthritis, lupus, IBD, psoriasis, atopic dermatitis, and myasthenia gravis deals. Provide company names, drug names, financial terms (upfront, milestones, total value, royalties), and source URLs.' },
  { ta: 'immunology', yearRange: '2020-2021', query: 'Immunology drug licensing agreements and acquisitions 2020-2021 with disclosed terms. Include JAK inhibitor, IL-17, IL-23, TL1A, TNF, and integrin deals. Provide company names, drug names, deal values, development phase, and press release links.' },

  // ── Rare Disease (gaps in 2019-2021) ─────────────────────────────────
  { ta: 'rareDisease', yearRange: '2019-2020', query: 'List all rare disease drug licensing deals from 2019 and 2020. Include gene therapy, enzyme replacement, substrate reduction, and RNA therapeutics for rare diseases. Include SMA, DMD, Fabry, Gaucher, hemophilia, and PKU deals. Provide company names, drug names, financial terms, and source URLs.' },
  { ta: 'rareDisease', yearRange: '2020-2021', query: 'Rare disease drug acquisitions and licensing agreements 2020-2021. Include AAV gene therapy platform deals, CRISPR deals for rare diseases, and antibody deals for rare conditions. Provide company names, drug names, deal economics, and source links.' },

  // ── Infectious Disease (gaps in 2019-2021) ───────────────────────────
  { ta: 'infectiousDisease', yearRange: '2019-2020', query: 'List all infectious disease drug and vaccine licensing deals from 2019 and 2020. Include HIV, hepatitis B, hepatitis C, RSV, influenza, antibiotics, and antifungal deals. Provide company names, drug names, upfront payments, milestones, total deal value, and source URLs.' },
  { ta: 'infectiousDisease', yearRange: '2020-2021', query: 'COVID-19 vaccine and antiviral deals 2020-2021, plus non-COVID infectious disease licensing agreements. Include mRNA platform deals, monoclonal antibody deals for infectious diseases, and antibiotic licensing. Provide financial terms and source links.' },

  // ── Cross-border (China deals, heavily underrepresented historically) ─
  { ta: 'oncology', yearRange: '2019-2022', query: 'Chinese biotech companies licensing drugs to Western pharma companies 2019-2022. Include all China-to-West out-licensing deals for oncology, immunology, and other therapeutic areas with upfront payments, milestones, and total deal values. Provide licensor, licensee, drug name, deal economics, and source URL.' },
  { ta: 'oncology', yearRange: '2022-2024', query: 'China biotech out-licensing deals to US and European pharma 2022-2024 across all therapeutic areas. Include ADC deals, bispecific deals, small molecule out-licensing from Chinese biotechs. Provide company names, drug names, financial terms, and press release or news article URLs.' },
];

// ═══════════════════════════════════════════════════════════════════════
// Perplexity API (same pattern as perplexity-deals.ts)
// ═══════════════════════════════════════════════════════════════════════

const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';

async function queryPerplexity(query: string, apiKey: string): Promise<string> {
  const response = await fetchWithTimeout(PERPLEXITY_API, {
    timeoutMs: 45_000,
    retries: 1,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: query }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Perplexity ${response.status}: ${body.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ═══════════════════════════════════════════════════════════════════════
// Claude extraction — with source URL requirement and anti-hallucination
// ═══════════════════════════════════════════════════════════════════════

interface BackfillDeal {
  licensor: string;
  licensee: string;
  asset_name: string;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_range: string | null;
  indication: string;
  modality: string;
  phase: string;
  territory: string;
  announced_date: string;
  source_url: string;
  confidence: number;
  terms_disclosed: boolean;
}

async function extractDealsWithSources(
  text: string,
  ta: string,
  yearRange: string,
  anthropicApiKey: string
): Promise<BackfillDeal[]> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 90_000 });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 6000,
    system: `You extract structured biopharma deal data from search results. You MUST follow these rules:

1. ONLY include deals that are EXPLICITLY mentioned in the provided text with verifiable details.
2. Do NOT fabricate, infer, or invent any deals. If a deal is mentioned vaguely without specific company names, skip it.
3. Do NOT fabricate financial terms. If the source says "undisclosed terms" or doesn't mention a number, use null for that field and set terms_disclosed to false.
4. Every deal MUST include a source_url — a URL to a press release, SEC filing, or news article. If no URL is available for a deal, OMIT that deal entirely.
5. Every deal MUST include an announced_date (at minimum the year). If the exact date is unknown, use YYYY-06-15 for year-only or YYYY-MM-15 for month-only.
6. Return ONLY valid JSON — an array of deal objects. No text outside the JSON.`,
    messages: [{
      role: 'user',
      content: `Extract all verifiable biopharma deals from this text about ${ta} deals from ${yearRange}. For each deal, return:
{
  "licensor": "company granting rights (the biotech/drug developer)",
  "licensee": "company receiving rights (the acquirer/partner, usually larger pharma)",
  "asset_name": "drug name, molecule name, or program description",
  "deal_type": "license|option|collaboration|acquisition|co_development",
  "upfront_usd": number in full dollars or null if not disclosed,
  "milestones_total_usd": number in full dollars or null if not disclosed,
  "total_deal_value_usd": number in full dollars or null if not disclosed,
  "royalty_range": "e.g. mid-single to low-double digit" or null,
  "indication": "specific indication or therapeutic focus",
  "modality": "smallMolecule|antibody|adc|bispecific|car_t|cell_therapy|gene_therapy|mrna|radiopharm|peptide|oligonucleotide|vaccine|other",
  "phase": "discovery|preclinical|phase_1|phase_2|phase_3|approved",
  "territory": "global|us|ex_us|ex_china|greater_china|japan|europe|etc",
  "announced_date": "YYYY-MM-DD",
  "source_url": "URL to press release or news article (REQUIRED — omit deal if no URL available)",
  "confidence": 75-95 (based on how much verifiable data is in the source),
  "terms_disclosed": true if any financial terms (upfront, milestones, total value) are explicitly stated, false otherwise
}

CRITICAL: If you cannot provide a source_url for a deal, do NOT include it. Only return deals with verifiable sources.

Return a JSON array. Text:
${text.substring(0, 10000)}`
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') return [];

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as BackfillDeal[];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Source URL verification
// ═══════════════════════════════════════════════════════════════════════

async function verifySourceUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: 10_000,
      retries: 0,
      method: 'HEAD',
      headers: {
        'User-Agent': 'Solidus research@ambrosiaventures.co',
      },
      redirect: 'follow',
    });
    // Accept 200, 301, 302, 303, 307, 308 (redirects followed by fetchWithTimeout)
    // Also accept 403 (some sites block HEAD but the page exists) and 405 (method not allowed)
    return response.ok || response.status === 403 || response.status === 405;
  } catch {
    // Try GET as fallback — some servers reject HEAD
    try {
      const getResponse = await fetchWithTimeout(url, {
        timeoutMs: 10_000,
        retries: 0,
        method: 'GET',
        headers: {
          'User-Agent': 'Solidus research@ambrosiaventures.co',
          'Range': 'bytes=0-1024', // only fetch first 1KB
        },
      });
      return getResponse.ok || getResponse.status === 206 || getResponse.status === 403;
    } catch {
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Route handler
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityApiKey || !anthropicApiKey) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
  }

  const startTime = Date.now();
  const TIME_BUDGET = 250_000; // 250s safe margin
  const supabase = createServiceClient();

  const result = {
    queries_run: 0,
    deals_discovered: 0,
    deals_source_verified: 0,
    deals_validation_passed: 0,
    deals_inserted: 0,
    deals_duplicate: 0,
    deals_rejected: [] as string[],
    rotation_index: 0,
    queries_processed: [] as string[],
  };

  try {
    // Rotation: cycle through GAP_QUERIES based on current hour
    // Each run processes 3-4 queries from a different part of the list
    const QUERIES_PER_RUN = 4;
    const totalQueries = GAP_QUERIES.length;
    const hour = new Date().getHours();
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const rotationIndex = ((dayOfYear * 4) + Math.floor(hour / 6)) % totalQueries;
    result.rotation_index = rotationIndex;

    for (let i = 0; i < QUERIES_PER_RUN && Date.now() - startTime < TIME_BUDGET; i++) {
      const queryIndex = (rotationIndex + i) % totalQueries;
      const gap = GAP_QUERIES[queryIndex];

      console.log(`[backfill] Query ${i + 1}/${QUERIES_PER_RUN}: ${gap.ta} ${gap.yearRange}`);
      result.queries_processed.push(`${gap.ta}:${gap.yearRange}`);

      try {
        // Step 1: Perplexity discovers deals
        const searchText = await queryPerplexity(gap.query, perplexityApiKey);
        result.queries_run++;

        if (!searchText || searchText.length < 100) {
          console.log(`[backfill] ${gap.ta} ${gap.yearRange}: Insufficient response`);
          continue;
        }

        // Step 2: Claude extracts structured deals with source URLs
        const deals = await extractDealsWithSources(searchText, gap.ta, gap.yearRange, anthropicApiKey);
        result.deals_discovered += deals.length;
        console.log(`[backfill] ${gap.ta} ${gap.yearRange}: ${deals.length} deals extracted`);

        // Step 3: Process each deal through the verification pipeline
        for (const deal of deals) {
          if (Date.now() - startTime > TIME_BUDGET) break;

          // 3a. Basic field validation
          if (!deal.licensor?.trim() || !deal.licensee?.trim()) {
            result.deals_rejected.push(`Missing names: ${deal.asset_name || 'unknown'}`);
            continue;
          }
          if (!deal.source_url?.trim()) {
            result.deals_rejected.push(`No source URL: ${deal.licensor} → ${deal.licensee}`);
            continue;
          }

          // 3b. Source URL verification — THE critical anti-hallucination guard
          const sourceValid = await verifySourceUrl(deal.source_url);
          if (!sourceValid) {
            result.deals_rejected.push(`Source unreachable: ${deal.licensor} → ${deal.licensee} [${deal.source_url}]`);
            continue;
          }
          result.deals_source_verified++;

          // 3c. Confidence threshold
          if (deal.confidence < 75) {
            result.deals_rejected.push(`Low confidence (${deal.confidence}): ${deal.licensor} → ${deal.licensee}`);
            continue;
          }

          // 3d. Shared fabrication validator
          const validation = validateExtractedDeal({
            licensor: deal.licensor,
            licensee: deal.licensee,
            modality: deal.modality || 'other',
            asset_name: deal.asset_name,
            indication_specific: deal.indication,
            upfront_usd: deal.upfront_usd,
            total_deal_value_usd: deal.total_deal_value_usd,
            confidence_score: deal.confidence,
            source_url: deal.source_url,
          });

          if (!validation.valid) {
            result.deals_rejected.push(
              `Validator [${validation.rejectCode}]: ${deal.licensor} → ${deal.licensee} — ${validation.rejectReason}`
            );
            continue;
          }
          result.deals_validation_passed++;

          // 3e. Dedup — check if licensor+licensee pair already exists
          const { data: existing } = await supabase
            .from('deals')
            .select('id')
            .ilike('licensee_name', `%${deal.licensee.substring(0, 15)}%`)
            .ilike('licensor_name', `%${deal.licensor.substring(0, 15)}%`)
            .limit(1)
            .maybeSingle();

          if (existing) {
            result.deals_duplicate++;
            continue;
          }

          // 3f. Normalize announced_date
          let announcedDate = deal.announced_date;
          if (announcedDate && announcedDate.length === 4) announcedDate += '-06-15';
          if (announcedDate && announcedDate.length === 7) announcedDate += '-15';
          const today = new Date().toISOString().split('T')[0];
          if (!announcedDate || announcedDate > today) announcedDate = today;

          // 3g. Insert with provenance tracking
          try {
            const derivedTA = deriveTherapeuticArea(deal.indication) || gap.ta;
            const licensorId = await findOrCreateCompany(supabase, deal.licensor).catch(() => null);
            const licenseeId = await findOrCreateCompany(supabase, deal.licensee).catch(() => null);

            const { error: insertError } = await supabase.from('deals').insert({
              licensor_name: deal.licensor,
              licensee_name: deal.licensee,
              licensor_id: licensorId,
              licensee_id: licenseeId,
              asset_name: deal.asset_name,
              asset_description: `${deal.indication || gap.ta} — historical backfill`,
              modality: deal.modality || 'other',
              indication_category: deal.indication?.toLowerCase().replace(/\s+/g, '_') || null,
              indication_specific: deal.indication,
              phase_at_signing: deal.phase || 'unknown',
              territory: deal.territory || 'global',
              deal_type: deal.deal_type || 'license',
              upfront_usd: deal.upfront_usd,
              milestones_total_usd: deal.milestones_total_usd,
              total_deal_value_usd: deal.total_deal_value_usd,
              announced_date: announcedDate,
              source_type: 'historical_backfill',
              source_url: deal.source_url,
              terms_disclosed: deal.terms_disclosed ?? ((deal.upfront_usd !== null) || (deal.total_deal_value_usd !== null)),
              confidence_score: deal.confidence,
              verified: false,
              verification_status: 'pending',
              therapeutic_area: derivedTA === 'other' ? gap.ta : derivedTA,
              extraction_notes: `Historical backfill: ${gap.ta} ${gap.yearRange}. Source verified: ${deal.source_url}`,
              extraction_model: 'perplexity+claude-opus-4-6',
              extraction_timestamp: new Date().toISOString(),
            });

            if (insertError?.code === '23505') {
              result.deals_duplicate++;
              continue;
            }
            if (!insertError) {
              result.deals_inserted++;
              console.log(`[backfill] ✓ Inserted: ${deal.licensor} → ${deal.licensee} (${deal.asset_name}) [${gap.ta} ${gap.yearRange}]`);
            } else {
              result.deals_rejected.push(`DB error: ${deal.licensor} → ${deal.licensee}: ${insertError.message}`);
            }
          } catch (err) {
            result.deals_rejected.push(`Insert error: ${deal.licensor} → ${deal.licensee}: ${String(err)}`);
          }
        }

        // Rate limit between Perplexity queries
        await new Promise(r => setTimeout(r, 2000));

      } catch (err) {
        result.deals_rejected.push(`Query error (${gap.ta} ${gap.yearRange}): ${String(err)}`);
      }
    }
  } catch (err) {
    result.deals_rejected.push(`Pipeline error: ${String(err)}`);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(
    `[backfill] Complete in ${elapsed}s: ${result.queries_run} queries, ` +
    `${result.deals_discovered} discovered, ${result.deals_source_verified} source-verified, ` +
    `${result.deals_validation_passed} validated, ${result.deals_duplicate} dupes, ` +
    `${result.deals_inserted} inserted`
  );

  return NextResponse.json({
    success: true,
    elapsed_seconds: elapsed,
    ...result,
  });
}
