/**
 * Render a Deal Intelligence Brief v3 locally, end to end, from a request-like
 * object: engine → financial model → memo/playbook → partner matches → v3
 * intelligence layer (comps, buyers, landscape, bridge, decision, positioning)
 * → HTML → PDF via local Chrome.
 *
 * Usage:
 *   npx tsx scripts/generate-brief-v3.ts [--out /path/to/dir] [--skip-ai] [--indication alzheimers]
 *
 * Reads .env.local (Supabase service role, ANTHROPIC_API_KEY). Read-only against
 * the database. Writes brief-v3.html and brief-v3.pdf to --out (default ./tmp).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import { calculateDealTerms, calculateRiskScore, type CalculationInput } from '../lib/calculations';
import { computeSensitivityAnalysis } from '../lib/sensitivity';
import { findComparableDeals } from '../lib/comparableDeals';
import { runFinancialModel } from '../lib/financial/run-financial-model';
import { generateReportHTML } from '../lib/report';
import { modalityLabels } from '../lib/report/helpers';
import { getDealMemoGenerator } from '../lib/ai/deal-memo-generator';
import { getPlaybookGenerator } from '../lib/ai/playbook-generator';
import type { PDFReportData, PartnerForPDF } from '../lib/report/types';
import { resolveIntake, type BenchmarkRequestRow } from '../lib/brief/intake-map';
import { buildBrief } from '../lib/brief/build';
import epiData from '../data/epidemiology.json';

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT_DIR = arg('--out', path.join(process.cwd(), 'tmp'))!;
const SKIP_AI = args.includes('--skip-ai');

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Example request — mirrors a benchmark_requests row after the v3 intake.
const REQUEST: BenchmarkRequestRow = {
  id: 'local-example',
  name: 'Example CEO',
  company: 'Example Biotech',
  therapeutic_area: arg('--ta', 'Neurology')!,
  indication: arg('--indication', "Alzheimer's Disease")!,
  phase: arg('--phase', 'Preclinical')!,
  territory: 'global',
  modality: arg('--modality', 'mAb'),
  target_deal_type: 'Licensing',
  asset_name: 'AMB-201',
  mechanism: 'anti-pTau217 antibody with BBB shuttle',
  target: 'MAPT',
  differentiation_notes: 'Biomarker-selected population; in vivo efficacy across two tau models; humanised, IND-enabling tox underway.',
  data_package_stage: 'IND-enabling studies underway',
};

async function fetchPartners(input: CalculationInput): Promise<PartnerForPDF[]> {
  try {
    const res = await fetch('https://solidus.ambrosiaventures.co/api/partners/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modality: input.modality,
        development_phase: input.phase,
        indication_category: input.indication,
        territory_scope: input.territory,
        therapeutic_area: input.therapeuticArea,
        tier: 'pro',
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.warn('[partners] HTTP', res.status); return []; }
    const data = await res.json();
    return (data?.matches ?? []).map((m: Record<string, unknown>) => ({
      company_name: m.company_name,
      company_id: m.company_id,
      match_score: m.match_score,
      match_reasons: m.match_reasons || [],
      deals_last_12mo: m.deals_last_12mo || 0,
      hq_country: m.hq_country ?? null,
      strategic_context: m.strategic_context ?? null,
      pharma_intent: m.pharma_intent ?? null,
      company_type: m.company_type ?? null,
      deals_last_24mo: m.deals_last_24mo ?? null,
      last_deal_date: m.last_deal_date ?? null,
      phase_preference_min: m.phase_preference_min ?? null,
      phase_preference_max: m.phase_preference_max ?? null,
      acquisition_appetite: m.acquisition_appetite ?? null,
      median_upfront_usd: m.median_upfront_usd ?? null,
    })) as PartnerForPDF[];
  } catch (err) {
    console.warn('[partners] failed:', (err as Error).message);
    return [];
  }
}

async function main() {
  const t0 = Date.now();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const resolved = resolveIntake(REQUEST, modalityLabels);
  console.log('[intake]', resolved.input, resolved.notes);
  const input = resolved.input;

  const result = calculateDealTerms(input);
  const sensitivityData = computeSensitivityAnalysis(input, result);
  const riskScore = calculateRiskScore(input);
  const comparableDeals = findComparableDeals({
    therapeuticArea: input.therapeuticArea, modality: input.modality, indication: input.indication,
    phase: input.phase, dealType: input.dealType, territory: input.territory,
  }, 8);
  const fm = runFinancialModel(input, result, (epiData as { indications: Record<string, unknown> }).indications as never);
  console.log('[engine] headline', result.terms.totalDealValue, 'rNPV', fm.rnpv.riskAdjustedNPV.toFixed(0));

  let memoData; let playbookData;
  if (!SKIP_AI) {
    try { memoData = await getDealMemoGenerator().generateMemo({ inputs: input, results: result, labels: resolved.labels }); }
    catch (e) { console.warn('[memo] failed', (e as Error).message); }
    try { playbookData = await getPlaybookGenerator().generatePlaybook({ inputs: input, results: result, labels: resolved.labels }); }
    catch (e) { console.warn('[playbook] failed', (e as Error).message); }
  }

  const partners = await fetchPartners(input);
  console.log('[partners]', partners.length, partners.slice(0, 5).map(p => p.company_name).join(', '));

  const built = await buildBrief({
    supabase, asset: resolved.asset, inputs: input, result, fm, partners,
    memo: memoData, defensive: fm.defensiveAnalysis,
    mpOpinion: {
      text: 'This asset should go to market after the IND-enabling package lands, with two named buyers approached in parallel rather than a broad process. The comparable set is thin at the preclinical stage, so the ask should be anchored on the ex-outlier median and defended with the biomarker data, not the mechanism story. I would not accept an option structure below the floor on this page.',
      reviewer: 'Issa Kildani, Managing Partner',
      reviewedAt: new Date().toISOString(),
    },
    skipPositioning: SKIP_AI,
    log: (m) => console.log(m),
  });
  console.log('[brief] notes:', built.notes);

  const pdfData: PDFReportData = {
    result, inputs: input, sensitivityData, riskScore,
    partnerMatches: partners.length ? partners : undefined,
    memoData, playbookData, comparableDeals,
    rnpvResult: fm.rnpv, monteCarloResult: fm.monteCarlo, marketSizeEstimate: fm.marketSize ?? undefined,
    scenarioResults: fm.scenarios, fxSensitivity: fm.fxSensitivity, defensiveAnalysis: fm.defensiveAnalysis,
    dealWaterfall: fm.dealWaterfall, scenarioComparison: fm.scenarioComparison, lifecycleExtensions: fm.lifecycleExtensions,
    competitiveDynamics: fm.competitiveDynamics, realOptions: fm.realOptions,
    buyerSpecificValuation: built.buyerValuations[0],
    buyerSpecificValuations: built.buyerValuations.length ? built.buyerValuations : undefined,
    regulatoryRisk: fm.regulatoryRisk, milestoneProbabilities: fm.milestoneProbabilities, earnoutValuation: fm.earnoutValuation,
    patentDynamics: fm.patentDynamics, cmcRisk: fm.cmcRisk, pricingConstraints: fm.pricingConstraints,
    indicationSequence: fm.indicationSequence, taxStructure: fm.taxStructure, royaltyStacking: fm.royaltyStacking,
    buyerSynergies: fm.buyerSynergies,
    brief: built.brief,
  };

  const html = generateReportHTML(pdfData);
  const htmlPath = path.join(OUT_DIR, 'brief-v3.html');
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(path.join(OUT_DIR, 'brief-v3.data.json'), JSON.stringify({ brief: built.brief, notes: built.notes }, null, 2));
  console.log('[html]', htmlPath, `${(html.length / 1024).toFixed(0)} KB`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 800));
  const pdfPath = path.join(OUT_DIR, 'brief-v3.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await browser.close();
  console.log('[pdf]', pdfPath, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

main().catch(err => { console.error(err); process.exit(1); });
