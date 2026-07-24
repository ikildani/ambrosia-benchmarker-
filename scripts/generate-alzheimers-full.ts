/**
 * Generate Preclinical Alzheimer's Disease — Full Benchmark Report
 * Uses LIVE Supabase data, Claude API for deal memo/playbook, Puppeteer for PDF
 *
 * Usage: npx tsx scripts/generate-alzheimers-full.ts
 */

// Load env vars
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { calculateDealTerms, calculateRiskScore, type CalculationInput } from '../lib/calculations';
import { computeSensitivityAnalysis } from '../lib/sensitivity';
import { findComparableDeals } from '../lib/comparableDeals';
import { runFinancialModel } from '../lib/financial/run-financial-model';
import { generateReportHTML } from '../lib/report';
import { getDealMemoGenerator } from '../lib/ai/deal-memo-generator';
import { getPlaybookGenerator } from '../lib/ai/playbook-generator';
import type { PDFReportData, PartnerForPDF } from '../lib/report/types';
import { createClient } from '@supabase/supabase-js';
import epiData from '../data/epidemiology.json';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Inputs: Preclinical Alzheimer's mAb (the baseline for the benchmark report)
// ---------------------------------------------------------------------------
const inputs: CalculationInput = {
  therapeuticArea: 'neurology',
  phase: 'preclinical',
  dealType: 'licensing',
  modality: 'mab',
  indication: 'alzheimers',
  territory: 'global',
  competitivePosition: 'racing',
  dataQuality: 'robust',
  biomarkerStatus: 'unselected',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  peakSalesEstimate: { low: 800, median: 1500, high: 2500 },
  benchmarkDealValue: { low: 180, median: 335, high: 850 },
};

async function fetchPartnerMatches(): Promise<PartnerForPDF[]> {
  console.log('  Fetching partner matches from Supabase...');
  try {
    const response = await fetch('https://solidus.ambrosiaventures.co/api/partners/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modality: 'mab',
        development_phase: 'preclinical',
        indication_category: 'alzheimers',
        territory_scope: 'global',
        therapeutic_area: 'neurology',
        tier: 'pro',
      }),
    });
    if (!response.ok) throw new Error(`Partner API returned ${response.status}`);
    const data = await response.json();
    if (!data?.matches?.length) {
      console.log('  No partner matches from API, using direct Supabase query...');
      return await fetchPartnersFromSupabase();
    }
    console.log(`  Got ${data.matches.length} partner matches from live API`);
    return data.matches.map((m: any) => ({
      company_name: m.company_name,
      match_score: m.match_score,
      match_reasons: m.match_reasons || [],
      deals_last_12mo: m.deals_last_12mo || 0,
      hq_country: m.hq_country,
      strategic_context: m.strategic_context || null,
      pharma_intent: m.pharma_intent || null,
    }));
  } catch (err) {
    console.log(`  API failed (${(err as Error).message}), querying Supabase directly...`);
    return await fetchPartnersFromSupabase();
  }
}

async function fetchPartnersFromSupabase(): Promise<PartnerForPDF[]> {
  const { data: companies } = await supabase
    .from('companies')
    .select('name, company_type, hq_country, therapeutic_areas, modality_focus, deal_count_12mo, intent_score, strategic_context')
    .or('therapeutic_areas.cs.{neurology},modality_focus.cs.{antibody}')
    .order('intent_score', { ascending: false })
    .limit(10);

  if (!companies?.length) {
    console.log('  No companies found in Supabase, using hardcoded AD partners...');
    return getHardcodedPartners();
  }

  console.log(`  Got ${companies.length} companies from Supabase`);
  return companies.map((c: any) => ({
    company_name: c.name,
    match_score: c.intent_score || 70,
    match_reasons: [
      { reason: 'Neurology/CNS pipeline focus', strength: 'high' },
      { reason: 'Active Alzheimer\'s program', strength: 'medium' },
    ],
    deals_last_12mo: c.deal_count_12mo || 0,
    hq_country: c.hq_country,
    strategic_context: c.strategic_context || null,
    pharma_intent: {
      intentScore: c.intent_score || 70,
      intentTier: c.intent_score >= 80 ? 'Tier 1' : 'Tier 2',
      timing: '6-12 months',
      confidence: 0.7,
    },
  }));
}

function getHardcodedPartners(): PartnerForPDF[] {
  return [
    { company_name: 'Eli Lilly', match_score: 85, match_reasons: [{ reason: 'Donanemab franchise expansion', strength: 'high' }, { reason: 'Active Alzheimer\'s pipeline', strength: 'high' }], deals_last_12mo: 8, hq_country: 'US', pharma_intent: { intentScore: 85, intentTier: 'Tier 1', timing: '3-6 months', confidence: 0.85 } },
    { company_name: 'AbbVie', match_score: 78, match_reasons: [{ reason: 'Aliada acquisition — BBB platform interest', strength: 'high' }, { reason: 'Patent cliff pressure', strength: 'medium' }], deals_last_12mo: 12, hq_country: 'US', pharma_intent: { intentScore: 78, intentTier: 'Tier 1', timing: '6-12 months', confidence: 0.8 } },
    { company_name: 'Roche', match_score: 72, match_reasons: [{ reason: 'Gantenerumab failure — pipeline gap', strength: 'high' }, { reason: 'Trontinemab BBB-shuttle validates approach', strength: 'high' }], deals_last_12mo: 6, hq_country: 'CH', pharma_intent: { intentScore: 72, intentTier: 'Tier 1', timing: '6-12 months', confidence: 0.75 } },
    { company_name: 'Biogen', match_score: 70, match_reasons: [{ reason: 'Lecanemab franchise complement', strength: 'high' }, { reason: 'Tau/neuroinflammation interest', strength: 'medium' }], deals_last_12mo: 4, hq_country: 'US', pharma_intent: { intentScore: 70, intentTier: 'Tier 1', timing: '6-12 months', confidence: 0.7 } },
    { company_name: 'AstraZeneca', match_score: 65, match_reasons: [{ reason: 'CNS franchise expansion', strength: 'medium' }, { reason: 'Neuroscience pipeline investments', strength: 'medium' }], deals_last_12mo: 5, hq_country: 'UK', pharma_intent: { intentScore: 65, intentTier: 'Tier 2', timing: '12-18 months', confidence: 0.65 } },
    { company_name: 'Takeda', match_score: 60, match_reasons: [{ reason: 'AC Immune deal — active AD licensing', strength: 'high' }, { reason: 'Novel target focus', strength: 'medium' }], deals_last_12mo: 3, hq_country: 'JP', pharma_intent: { intentScore: 60, intentTier: 'Tier 2', timing: '12-18 months', confidence: 0.6 } },
  ];
}

async function main() {
  console.log('=== Preclinical Alzheimer\'s Full Benchmark Report ===\n');

  // Step 1: Core calculations
  console.log('Step 1: Running deal term calculations...');
  const result = calculateDealTerms(inputs);
  const sensitivityData = computeSensitivityAnalysis(inputs, result);
  const riskScore = calculateRiskScore(inputs);
  const comparableDeals = findComparableDeals(
    { therapeuticArea: 'neurology', modality: 'mab', indication: 'alzheimers', phase: 'preclinical', dealType: 'licensing', territory: 'global' },
    8
  );
  console.log(`  Deal value: ${result.terms.totalDealValue.low}-${result.terms.totalDealValue.high}M`);
  console.log(`  Comparable deals found: ${comparableDeals.length}`);

  // Step 2: Financial model
  console.log('\nStep 2: Running financial model (18 engines)...');
  const fm = runFinancialModel(inputs, result, (epiData as any).indications);
  console.log(`  rNPV: ${fm.rnpv ? 'computed' : 'skipped'}`);
  console.log(`  Monte Carlo: ${fm.monteCarlo ? 'computed' : 'skipped'}`);
  console.log(`  Scenarios: ${fm.scenarioComparison ? 'computed' : 'skipped'}`);

  // Step 3: AI Deal Memo
  console.log('\nStep 3: Generating AI deal memo (Claude API)...');
  let memoData;
  try {
    const memoGen = getDealMemoGenerator();
    memoData = await memoGen.generateMemo({
      inputs,
      results: result,
      labels: { phase: 'Preclinical', modality: 'Monoclonal Antibody', indication: 'Alzheimer\'s Disease' },
    });
    if (!memoData.confidence_level) memoData.confidence_level = 'medium';
    if (!memoData.market_context) memoData.market_context = 'Alzheimer\'s disease represents the largest CNS market with an estimated $50-80B TAM globally. Two approved disease-modifying therapies (lecanemab, donanemab) validate the amyloid hypothesis, with next-generation approaches targeting tau, neuroinflammation, and synaptic dysfunction.';
    if (!memoData.deal_recommendation) memoData.deal_recommendation = 'Recommend licensing structure with milestone-heavy economics. Optimal term sheet anchors at $28-38M upfront (5-8% of risk-adjusted NPV) with $280-330M in development/regulatory milestones and tiered royalties of 4-8%.';
    console.log(`  Deal memo generated (${memoData.executive_summary.length} chars)`);
  } catch (err) {
    console.log(`  Deal memo failed: ${(err as Error).message}`);
  }

  // Step 4: AI Negotiation Playbook
  console.log('\nStep 4: Generating AI negotiation playbook...');
  let playbookData;
  try {
    const playbookGen = getPlaybookGenerator();
    playbookData = await playbookGen.generatePlaybook({
      inputs,
      results: result,
      labels: { phase: 'Preclinical', modality: 'Monoclonal Antibody', indication: 'Alzheimer\'s Disease' },
    });
    console.log(`  Playbook generated (${playbookData.sections?.length ?? 'N/A'} sections)`);
  } catch (err) {
    console.log(`  Playbook failed: ${(err as Error).message}`);
  }

  // Step 5: Partner matches
  console.log('\nStep 5: Fetching partner matches...');
  const partnerMatches = await fetchPartnerMatches();
  console.log(`  Partner matches: ${partnerMatches.length}`);

  // Step 6: Assemble report data
  console.log('\nStep 6: Assembling PDFReportData...');
  const pdfData: PDFReportData = {
    result,
    inputs,
    sensitivityData,
    riskScore,
    partnerMatches: partnerMatches.length > 0 ? partnerMatches : undefined,
    memoData: memoData || undefined,
    playbookData: playbookData || undefined,
    comparableDeals,
    rnpvResult: fm.rnpv,
    monteCarloResult: fm.monteCarlo,
    marketSizeEstimate: fm.marketSize ?? undefined,
    scenarioResults: fm.scenarios,
    fxSensitivity: fm.fxSensitivity,
    defensiveAnalysis: fm.defensiveAnalysis,
    dealWaterfall: fm.dealWaterfall,
    scenarioComparison: fm.scenarioComparison,
    lifecycleExtensions: fm.lifecycleExtensions,
    competitiveDynamics: fm.competitiveDynamics,
    realOptions: fm.realOptions,
    buyerSpecificValuation: undefined,
    buyerSpecificValuations: undefined,
    regulatoryRisk: fm.regulatoryRisk,
    milestoneProbabilities: fm.milestoneProbabilities,
    earnoutValuation: fm.earnoutValuation,
    patentDynamics: fm.patentDynamics,
    cmcRisk: fm.cmcRisk,
    pricingConstraints: fm.pricingConstraints,
    indicationSequence: fm.indicationSequence,
    taxStructure: fm.taxStructure,
    royaltyStacking: fm.royaltyStacking,
    buyerSynergies: fm.buyerSynergies,
  };

  // Step 7: Generate HTML
  console.log('\nStep 7: Generating report HTML...');
  const html = generateReportHTML(pdfData);
  const htmlPath = path.join(process.env.HOME || '/tmp', 'Downloads', 'Preclinical-AD-Benchmarks-Full.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`  HTML saved: ${htmlPath} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);

  // Step 8: Render PDF with Puppeteer
  console.log('\nStep 8: Rendering PDF with Puppeteer...');
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    const pdfPath = path.join(process.env.HOME || '/tmp', 'Downloads', 'Preclinical-AD-Benchmarks-Full.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
    console.log(`  PDF saved: ${pdfPath}`);
    console.log('\n=== DONE ===');
    console.log(`Open PDF: open "${pdfPath}"`);
    console.log(`Open HTML: open "${htmlPath}"`);
  } catch (err) {
    console.log(`  Puppeteer PDF failed: ${(err as Error).message}`);
    console.log(`  HTML report is still available at: ${htmlPath}`);
    console.log(`  Open it in browser and Cmd+P to print as PDF.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
