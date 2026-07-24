/**
 * Generate Preclinical Alzheimer's Disease Report
 *
 * Usage: npx tsx scripts/generate-ad-report.ts
 * Output: ~/Downloads/Preclinical-AD-Report-July2026.html
 */

import { calculateDealTerms } from '../lib/calculations';
import { computeSensitivityAnalysis } from '../lib/sensitivity';
import { calculateRiskScore } from '../lib/calculations';
import { findComparableDeals } from '../lib/comparableDeals';
import { runFinancialModel } from '../lib/financial/run-financial-model';
import { generateReportHTML } from '../lib/report';
import type { PDFReportData } from '../lib/report';
import epiData from '../data/epidemiology.json';
import * as fs from 'fs';
import * as path from 'path';

const inputs = {
  therapeuticArea: 'neurology' as const,
  phase: 'preclinical' as const,
  dealType: 'licensing' as const,
  modality: 'mab' as const,
  indication: 'alzheimers' as const,
  territory: 'global' as const,
  competitivePosition: 'racing' as const,
  dataQuality: 'robust' as const,
  biomarkerStatus: 'unselected' as const,
  regulatoryDesignations: {
    breakthrough: false,
    fastTrack: false,
    orphan: false,
    prime: false,
  },
  peakSalesEstimate: {
    low: 800,
    median: 1500,
    high: 2500,
  },
  benchmarkDealValue: {
    low: 180,
    median: 335,
    high: 850,
  },
};

console.log('Running deal term calculation...');
const result = calculateDealTerms(inputs);

console.log('Computing sensitivity analysis...');
const sensitivityData = computeSensitivityAnalysis(inputs, result);

console.log('Calculating risk score...');
const riskScore = calculateRiskScore(inputs);

console.log('Finding comparable deals...');
const comparableDeals = findComparableDeals(inputs, result);

console.log('Running financial model (18 engines)...');
const fm = runFinancialModel(inputs, result, (epiData as any).indications);

console.log('Assembling report data...');
const pdfData: PDFReportData = {
  result,
  inputs,
  sensitivityData,
  riskScore,
  partnerMatches: undefined,
  memoData: undefined,
  playbookData: undefined,
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

console.log('Generating report HTML...');
const html = generateReportHTML(pdfData);

const outputPath = path.join(process.env.HOME || '/tmp', 'Downloads', 'Preclinical-AD-Report-July2026.html');
fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`\nReport saved to: ${outputPath}`);
console.log(`Open in browser: open "${outputPath}"`);
console.log('Then Cmd+P to print as PDF.');
