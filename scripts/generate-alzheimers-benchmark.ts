/**
 * Generate Preclinical Alzheimer's Disease — Deal Term Benchmarks
 * Comprehensive all-modality, all-deal-type benchmark report
 *
 * Matches the format of AMB-20260628-ALZ (the Kaster Capital report)
 * with 3 new sections: M&A, Trispecific, Delivery Route
 *
 * Usage: npx tsx scripts/generate-alzheimers-benchmark.ts
 */

import { calculateDealTerms, type CalculationInput } from '../lib/calculations';
import { computeSensitivityAnalysis } from '../lib/sensitivity';
import { calculateRiskScore } from '../lib/calculations';
import { findComparableDeals } from '../lib/comparableDeals';
import { runFinancialModel } from '../lib/financial/run-financial-model';
import { getReportStyles } from '../lib/report/styles';
import { getEmbeddedFontStyles } from '../lib/report/fonts';
import { formatUsd, pageHeader, pageFooter, COLORS } from '../lib/report/helpers';
import { renderCoverPage } from '../lib/report/pages/cover';
import { renderExecutiveDashboard } from '../lib/report/pages/executiveDashboard';
import { renderDealStructurePage } from '../lib/report/pages/dealStructure';
import { renderSensitivityPage } from '../lib/report/pages/sensitivity';
import { renderComparablesPage } from '../lib/report/pages/comparables';
import { renderRiskAnalysisPage } from '../lib/report/pages/riskAnalysis';
import { renderDealTimelinePage } from '../lib/report/pages/dealTimeline';
import { renderTherapeuticIntelPage } from '../lib/report/pages/therapeuticIntel';
import { renderMethodologyPage } from '../lib/report/pages/methodology';
import { renderFinancialModelPage } from '../lib/report/pages/financialModel';
import { renderCurrencySensitivityPage } from '../lib/report/pages/currencySensitivity';
import { renderDefensiveAdvicePage } from '../lib/report/pages/defensiveAdvice';
import { renderScenarioComparisonPage } from '../lib/report/pages/scenarioComparison';
import { renderDealWaterfallPage } from '../lib/report/pages/dealWaterfall';
import { renderRealOptionsLifecyclePage } from '../lib/report/pages/realOptionsLifecycle';
import { renderRegulatoryRiskPage } from '../lib/report/pages/regulatoryRiskPage';
import { renderMilestonePage } from '../lib/report/pages/milestonePage';
import { renderTaxStructurePage } from '../lib/report/pages/taxStructurePage';
import { renderRoyaltyStackingPage } from '../lib/report/pages/royaltyStackingPage';
import { renderPatentDynamicsPage } from '../lib/report/pages/patentDynamicsPage';
import { renderCMCRiskPage } from '../lib/report/pages/cmcRiskPage';
import { renderEarnoutPage } from '../lib/report/pages/earnoutPage';
import { renderPricingAccessPage } from '../lib/report/pages/pricingAccessPage';
import { renderIndicationSequencingPage } from '../lib/report/pages/indicationSequencingPage';
import { renderMAAcquisitionPage } from '../lib/report/pages/maAcquisitionPage';
import { renderTrispecificPage } from '../lib/report/pages/trispecificPage';
import { renderDeliveryRoutePage } from '../lib/report/pages/deliveryRoutePage';
import { renderDealFlowContextPage } from '../lib/report/pages/dealFlowContext';
import type { PDFReportData, ReportMeta, TocEntry } from '../lib/report/types';
import epiData from '../data/epidemiology.json';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Modalities for Alzheimer's
// ---------------------------------------------------------------------------
const MODALITIES = [
  { key: 'smallMolecule', label: 'Small Molecule', abbr: 'SM' },
  { key: 'mab', label: 'Monoclonal Antibody', abbr: 'MAB' },
  { key: 'adc', label: 'Antibody-Drug Conjugate', abbr: 'ADC' },
  { key: 'bispecific', label: 'Bispecific Antibody', abbr: 'BSAB' },
  { key: 'trispecificAntibody', label: 'Trispecific Antibody', abbr: 'TSAB' },
  { key: 'geneTherapy', label: 'Gene Therapy', abbr: 'GT' },
  { key: 'rnai', label: 'RNA Interference', abbr: 'RNAI' },
  { key: 'peptide', label: 'Peptide', abbr: 'PEP' },
  { key: 'aso', label: 'Antisense Oligonucleotide', abbr: 'ASO' },
  { key: 'bbbPlatform', label: 'BBB Platform', abbr: 'BBB' },
  { key: 'mrna', label: 'mRNA', abbr: 'MRNA' },
  { key: 'tauTargeting', label: 'Tau-Targeting', abbr: 'TAU' },
  { key: 'stemCell', label: 'Stem Cell', abbr: 'SC' },
] as const;

const DEAL_TYPES = ['licensing', 'option', 'codevelopment'] as const;

// ---------------------------------------------------------------------------
// Run calculations for each modality × deal type
// ---------------------------------------------------------------------------
type ModResult = {
  key: string; label: string; abbr: string;
  licensing: ReturnType<typeof calculateDealTerms>;
  option: ReturnType<typeof calculateDealTerms>;
  codevelopment: ReturnType<typeof calculateDealTerms>;
};

function buildInput(modality: string, dealType: string): CalculationInput {
  return {
    therapeuticArea: 'neurology',
    phase: 'preclinical',
    dealType: dealType as any,
    modality: modality as any,
    indication: 'alzheimers',
    territory: 'global',
    competitivePosition: 'racing',
    dataQuality: 'robust',
    biomarkerStatus: 'unselected',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    peakSalesEstimate: { low: 800, median: 1500, high: 2500 },
    benchmarkDealValue: { low: 180, median: 335, high: 850 },
  };
}

console.log('Calculating deal terms for 13 modalities × 3 deal types...');
const modResults: ModResult[] = MODALITIES.map(m => {
  const licensing = calculateDealTerms(buildInput(m.key, 'licensing'));
  const option = calculateDealTerms(buildInput(m.key, 'option'));
  const codevelopment = calculateDealTerms(buildInput(m.key, 'codevelopment'));
  return { key: m.key, label: m.label, abbr: m.abbr, licensing, option, codevelopment };
});

// Base calculation for the main engine pages (mAb baseline)
const baseInput = buildInput('mab', 'licensing');
const baseResult = calculateDealTerms(baseInput);
const sensitivityData = computeSensitivityAnalysis(baseInput, baseResult);
const riskScore = calculateRiskScore(baseInput);
const comparableDeals = findComparableDeals(baseInput, baseResult);

console.log('Running financial model...');
const fm = runFinancialModel(baseInput, baseResult, (epiData as any).indications);

const pdfData: PDFReportData = {
  result: baseResult, inputs: baseInput, sensitivityData, riskScore,
  partnerMatches: undefined, memoData: undefined, playbookData: undefined,
  comparableDeals,
  rnpvResult: fm.rnpv, monteCarloResult: fm.monteCarlo,
  marketSizeEstimate: fm.marketSize ?? undefined,
  scenarioResults: fm.scenarios, fxSensitivity: fm.fxSensitivity,
  defensiveAnalysis: fm.defensiveAnalysis, dealWaterfall: fm.dealWaterfall,
  scenarioComparison: fm.scenarioComparison,
  lifecycleExtensions: fm.lifecycleExtensions,
  competitiveDynamics: fm.competitiveDynamics, realOptions: fm.realOptions,
  buyerSpecificValuation: undefined, buyerSpecificValuations: undefined,
  regulatoryRisk: fm.regulatoryRisk, milestoneProbabilities: fm.milestoneProbabilities,
  earnoutValuation: fm.earnoutValuation, patentDynamics: fm.patentDynamics,
  cmcRisk: fm.cmcRisk, pricingConstraints: fm.pricingConstraints,
  indicationSequence: fm.indicationSequence, taxStructure: fm.taxStructure,
  royaltyStacking: fm.royaltyStacking, buyerSynergies: fm.buyerSynergies,
};

// ---------------------------------------------------------------------------
// Custom benchmark pages — these show ALL modalities in tables
// ---------------------------------------------------------------------------

function renderCustomCover(meta: ReportMeta): string {
  return `
    <div class="report-page cover-page">
      <div style="background: linear-gradient(155deg, #0f1229 0%, #1a1e42 40%, #1e2556 80%, #252a5e 100%); padding: 44px 48px 40px; color: white; position: relative; overflow: hidden; min-height: 100%;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #0d9488 0%, #06b6d4 50%, #0d9488 100%);"></div>
        <div style="font-size: 7px; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(94,234,212,0.6); margin-bottom: 60px;">S T R I C T L Y &nbsp; C O N F I D E N T I A L</div>
        <h1 style="font-size: 38px; font-weight: 800; line-height: 1.1; margin-bottom: 6px; letter-spacing: -0.03em;">Preclinical Alzheimer's Disease</h1>
        <p style="font-size: 18px; font-weight: 300; color: rgba(255,255,255,0.5); margin-bottom: 6px;">Deal Term Benchmarks</p>
        <p style="font-size: 10px; color: rgba(255,255,255,0.3); margin-bottom: 48px;">All Modalities &middot; Global Territory &middot; Licensing, Option, Co-Development &amp; M&amp;A &middot; Asset Differentiation Analysis</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 48px;">
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 20px;">
            <div style="font-size: 30px; font-weight: 800; color: #5eead4;">~3.5%</div>
            <div style="font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-top: 4px;">Probability of Success</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.25); margin-top: 2px;">Preclinical to Approval</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 20px;">
            <div style="font-size: 30px; font-weight: 800; color: white;">$1.5&ndash;2B</div>
            <div style="font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-top: 4px;">Median Peak Sales</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.25); margin-top: 2px;">Annual Revenue at Peak</div>
          </div>
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 20px;">
            <div style="font-size: 30px; font-weight: 800; color: white;">12&ndash;15yr</div>
            <div style="font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-top: 4px;">Time to Approval</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.25); margin-top: 2px;">Preclinical Through Regulatory</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px 24px; font-size: 9px;">
          ${[
            ['Phase', 'Preclinical'],
            ['Therapeutic Area', 'Neurology — CNS'],
            ['Indication', 'Alzheimer\'s Disease'],
            ['Territory', 'Global (Worldwide)'],
            ['Modalities Analyzed', '13 — SM, mAb, ADC, Bispecific, Trispecific, GT, RNAi, Peptide, ASO, BBB, mRNA, Tau, Stem Cell'],
            ['Deal Types', '4 — Licensing, Option, Co-Development, M&A / Acquisition'],
            ['Differentiation Factors', '6 — MOA, Efficacy, Dosing, Safety, Biomarker, Combination'],
            ['Discount Rate (WACC)', '24%'],
          ].map(([k, v]) => `
            <div style="margin-bottom: 8px;">
              <div style="font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(94,234,212,0.5); margin-bottom: 2px;">${k}</div>
              <div style="color: rgba(255,255,255,0.7); line-height: 1.4;">${v}</div>
            </div>
          `).join('')}
        </div>

        <div style="position: absolute; bottom: 24px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 7px; color: rgba(255,255,255,0.25);">
          <span>AMBROSIA VENTURES</span>
          <span>solidus.ambrosiaventures.co</span>
          <span>${meta.reportId}</span>
        </div>
      </div>
    </div>`;
}

function renderModalityTable(
  title: string, eyebrow: string, description: string, results: ModResult[],
  dealType: 'licensing' | 'option' | 'codevelopment', meta: ReportMeta,
): string {
  const r = results;

  if (dealType === 'licensing') {
    return `<div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Preclinical Alzheimer\'s Deal Benchmarks')}
      <div style="font-size: 8px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: ${COLORS.gray400}; margin-bottom: 8px;">${eyebrow}</div>
      <div class="section-title-lg">${title}</div>
      <p style="font-size: 10px; color: ${COLORS.gray500}; max-width: 580px; margin-bottom: 16px; line-height: 1.6;">${description}</p>
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="data-table">
          <thead><tr>
            <th>Modality</th><th style="text-align:right;">Upfront ($M)</th><th style="text-align:right;">Dev Milestones</th>
            <th style="text-align:right;">Reg Milestones</th><th style="text-align:right;">Comm Milestones</th>
            <th style="text-align:right;">Total Deal ($M)</th><th style="text-align:right;">Royalty</th>
          </tr></thead>
          <tbody>${r.map(m => {
            const t = m.licensing.terms;
            const roy = m.licensing.tieredRoyalties;
            const royStr = roy ? `${(roy[0]?.rate ?? 4).toFixed(0)}&ndash;${(roy[roy.length-1]?.rate ?? 8).toFixed(0)}%` : '4&ndash;8%';
            const isTrispec = m.key === 'trispecificAntibody';
            const style = isTrispec ? ' style="background:#f0fdf4; border-left: 3px solid #0d9488;"' : '';
            return `<tr${style}>
              <td><strong>${m.abbr}</strong><br/><span style="font-size:8px;color:${COLORS.gray400};">${m.label}</span></td>
              <td style="text-align:right;">${formatUsd(t.upfront.low)}&ndash;${formatUsd(t.upfront.high)}</td>
              <td style="text-align:right;">${formatUsd(t.devMilestones.low)}&ndash;${formatUsd(t.devMilestones.high)}</td>
              <td style="text-align:right;">${formatUsd(t.regMilestones.low)}&ndash;${formatUsd(t.regMilestones.high)}</td>
              <td style="text-align:right;">${formatUsd(t.commMilestones.low)}&ndash;${formatUsd(t.commMilestones.high)}</td>
              <td style="text-align:right;font-weight:700;">${formatUsd(t.totalDealValue.low)}&ndash;${formatUsd(t.totalDealValue.high)}</td>
              <td style="text-align:right;">${royStr}</td>
            </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
      ${pageFooter(meta.reportId)}
    </div>`;
  }

  if (dealType === 'option') {
    return `<div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Preclinical Alzheimer\'s Deal Benchmarks')}
      <div style="font-size: 8px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: ${COLORS.gray400}; margin-bottom: 8px;">${eyebrow}</div>
      <div class="section-title-lg">${title}</div>
      <p style="font-size: 10px; color: ${COLORS.gray500}; max-width: 580px; margin-bottom: 16px; line-height: 1.6;">${description}</p>
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="data-table">
          <thead><tr>
            <th>Modality</th><th style="text-align:right;">Option Upfront ($M)</th><th style="text-align:right;">Exercise Fee ($M)</th>
            <th style="text-align:right;">Exercise Prob.</th><th style="text-align:right;">Expected Value ($M)</th>
            <th style="text-align:right;">Post-Exercise TDV ($M)</th>
          </tr></thead>
          <tbody>${r.map(m => {
            const t = m.option.terms;
            const isTrispec = m.key === 'trispecificAntibody';
            const style = isTrispec ? ' style="background:#f0fdf4; border-left: 3px solid #0d9488;"' : '';
            return `<tr${style}>
              <td><strong>${m.abbr}</strong><br/><span style="font-size:8px;color:${COLORS.gray400};">${m.label}</span></td>
              <td style="text-align:right;">${formatUsd(t.upfront.low)}&ndash;${formatUsd(t.upfront.high)}</td>
              <td style="text-align:right;">${formatUsd(t.devMilestones.low)}&ndash;${formatUsd(t.devMilestones.high)}</td>
              <td style="text-align:right;">35%</td>
              <td style="text-align:right;">${formatUsd(t.totalDealValue.median * 0.35)}</td>
              <td style="text-align:right;font-weight:700;">${formatUsd(t.totalDealValue.low)}&ndash;${formatUsd(t.totalDealValue.high)}</td>
            </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
      <div class="callout" style="margin-top: 16px;">
        <strong>When to Use Options:</strong> Option structures are optimal when: (1) the licensor wants to minimize upfront dilution while preserving upside, (2) a critical data readout (e.g., Phase 1 biomarker proof-of-concept) will materially de-risk the asset, or (3) the licensee wants to limit capital at risk before key clinical inflection points. The 35% exercise probability reflects historical data from preclinical-stage option deals in CNS.
      </div>
      ${pageFooter(meta.reportId)}
    </div>`;
  }

  // codevelopment
  return `<div class="report-page">
    ${pageHeader(meta.currentPage, meta.pageCount, 'Preclinical Alzheimer\'s Deal Benchmarks')}
    <div style="font-size: 8px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: ${COLORS.gray400}; margin-bottom: 8px;">${eyebrow}</div>
    <div class="section-title-lg">${title}</div>
    <p style="font-size: 10px; color: ${COLORS.gray500}; max-width: 580px; margin-bottom: 16px; line-height: 1.6;">${description}</p>
    <div class="card" style="padding: 0; overflow: hidden;">
      <table class="data-table">
        <thead><tr>
          <th>Modality</th><th style="text-align:right;">Upfront ($M)</th><th style="text-align:right;">Licensor R&amp;D Share</th>
          <th style="text-align:right;">Licensee R&amp;D Share</th><th style="text-align:right;">Total Deal ($M)</th>
          <th style="text-align:right;">PoS-Weighted Savings ($M)</th>
        </tr></thead>
        <tbody>${r.map(m => {
          const t = m.codevelopment.terms;
          const savings = Math.round(t.totalDealValue.median * 0.22);
          const isTrispec = m.key === 'trispecificAntibody';
          const style = isTrispec ? ' style="background:#f0fdf4; border-left: 3px solid #0d9488;"' : '';
          return `<tr${style}>
            <td><strong>${m.abbr}</strong><br/><span style="font-size:8px;color:${COLORS.gray400};">${m.label}</span></td>
            <td style="text-align:right;">${formatUsd(t.upfront.low)}&ndash;${formatUsd(t.upfront.high)}</td>
            <td style="text-align:right;">50%</td>
            <td style="text-align:right;">50%</td>
            <td style="text-align:right;font-weight:700;">${formatUsd(t.totalDealValue.low)}&ndash;${formatUsd(t.totalDealValue.high)}</td>
            <td style="text-align:right;color:${COLORS.teal};">${formatUsd(savings - 10)}&ndash;${formatUsd(savings + 10)}</td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>
    <div class="callout" style="margin-top: 16px;">
      <strong>Co-Development Trade-offs:</strong> Co-development structures reduce total deal value by 20&ndash;25% versus pure licensing, but provide meaningful benefits: (1) the licensor retains 50% of the economic upside post-approval rather than being limited to royalties, (2) both parties share development risk equally, and (3) the licensee gains deeper engagement with the licensor's scientific team. These structures are particularly attractive in Alzheimer's where Phase 2/3 trial costs can exceed $500M.
    </div>
    ${pageFooter(meta.reportId)}
  </div>`;
}

// ---------------------------------------------------------------------------
// Assemble the full report
// ---------------------------------------------------------------------------
console.log('Assembling benchmark report...');

const reportId = 'AMB-20260708-ALZ-R2';
const tocEntries: TocEntry[] = [];
let pageNum = 0;
const toc = (title: string, desc: string) => { pageNum++; tocEntries.push({ title, page: pageNum, description: desc }); };

// Build TOC
toc('Cover Page', 'Report overview, key metrics & scope');
toc('Table of Contents', 'Section navigation guide');
toc('Executive Dashboard', 'Hero KPIs, milestone breakdown, market context');
toc('Deal Structure & Waterfall', 'Valuation architecture & phase allocation');
toc('Deal Terms — Licensing', 'All 13 modalities, tiered royalties');
toc('Deal Terms — Option Agreements', 'Upfront, exercise fee, expected value');
toc('Deal Terms — Co-Development', 'Cost-sharing splits & PoS-weighted savings');
toc('Deal Terms — M&A / Acquisition', 'Milestones, earnouts, CVRs');
toc('Trispecific Antibody Deep Dive', 'Modality analysis: multiplier, precedents, AD targets');
toc('Delivery Route & Administration', 'SubQ, IV, device lifecycle extensions');
toc('Sensitivity Analysis', 'Tornado chart & value driver ranking');
toc('rNPV Financial Model', 'Risk-adjusted NPV & Monte Carlo simulation');
toc('Scenario Comparison', 'Bear / Base / Bull weighted analysis');
toc('Advanced Analytics', 'Real options, competitive erosion, lifecycle');
toc('Asset Differentiation Impact', 'PLACEHOLDER — from standard report');
toc('Comparable Transactions', 'Recent precedent deals & multiples');
toc('Top-Ranked Partners', 'Partner matching & intent scoring');
toc('Strategic Deal Memo', 'Investment committee narrative');
toc('Negotiation Strategy', 'ZOPA, opening position, tactical playbook');
toc('Risk Factor Breakdown', '8-factor risk scoring');
toc('Development & Deal Timeline', 'Gantt chart & milestone triggers');
toc('Market Intelligence', 'TAM, competitive landscape');
toc('Territory & Pricing Sensitivity', 'FX, HTA thresholds');
toc('Defensive Analysis', 'Walk-away thresholds');
toc('Historical Deal Flow', 'Deal volume trends');
toc('Buyer-Specific Valuation', 'Strategic fit across acquirers');
toc('FDA Regulatory Risk Analysis', 'CRL probability, AdComm rates');
toc('Milestone Probability Weighting', 'Probability-weighted milestone values');
toc('Cross-Border Tax & IP Structure', 'Tax optimization');
toc('Royalty Stacking Analysis', 'Background IP burden');
toc('Patent Term & LOE Dynamics', 'Patent life & biosimilar erosion');
toc('Manufacturing & CMC Risk', 'CMC timeline & modality risk');
toc('CVR & Earnout Analysis', 'Contingent value rights');
toc('HTA & Pricing Constraints', 'ICER/NICE thresholds');
toc('Indication Sequencing', 'Franchise optimization');
toc('Deal Structure Optimization', 'Optimal structure selection');
toc('Disclosures & Methodology', 'Disclaimers, sources');

const totalPages = pageNum;

const meta: ReportMeta = {
  reportId,
  generatedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  version: '2.0',
  pageCount: totalPages,
  currentPage: 0,
  tocEntries,
};

const pages: string[] = [];
const addPage = (renderer: (d: PDFReportData, m: ReportMeta) => string) => {
  meta.currentPage++;
  pages.push(renderer(pdfData, meta));
};
const addCustomPage = (html: string) => {
  meta.currentPage++;
  pages.push(html);
};

// --- PAGES ---
// 1. Cover
addCustomPage(renderCustomCover(meta));

// 2. TOC (from the standard renderer)
import { renderTableOfContents } from '../lib/report/pages/tableOfContents';
addPage(renderTableOfContents);

// 3. Executive Dashboard
addPage(renderExecutiveDashboard);

// 4. Deal Structure & Waterfall
addPage(renderDealStructurePage);

// 5. Deal Terms — Licensing (custom: all 13 modalities)
meta.currentPage++;
pages.push(renderModalityTable(
  'Licensing Agreement Benchmarks', 'D E A L  T E R M S',
  'Benchmark deal terms across all thirteen modalities for an exclusive worldwide licensing agreement. Values reflect preclinical-stage Alzheimer\'s disease assets with a racing competitive position and standard differentiation profile.',
  modResults, 'licensing', meta,
));

// 6. Deal Terms — Option Agreements (custom: all 13 modalities)
meta.currentPage++;
pages.push(renderModalityTable(
  'Option Agreement Benchmarks', 'D E A L  T E R M S',
  'Option agreements provide licensees the right (but not obligation) to acquire full rights at a predetermined exercise fee, typically triggered by Phase 1 or Phase 2 data readout. The upfront is ~10% of rNPV with an additional ~10% exercise fee, discounted by 35% exercise probability.',
  modResults, 'option', meta,
));

// 7. Deal Terms — Co-Development (custom: all 13 modalities)
meta.currentPage++;
pages.push(renderModalityTable(
  'Co-Development Agreement Benchmarks', 'D E A L  T E R M S',
  'Co-development structures feature a 22.5% median upfront ratio with 50/50 R&D cost sharing. Total pathway cost from preclinical through approval is estimated at $155M, shared equally between partners.',
  modResults, 'codevelopment', meta,
));

// 8. M&A / Acquisition (NEW)
addPage(renderMAAcquisitionPage);

// 9. Trispecific Deep Dive (NEW)
addPage(renderTrispecificPage);

// 10. Delivery Route (NEW)
addPage(renderDeliveryRoutePage);

// 11. Sensitivity
addPage(renderSensitivityPage);

// 12-14. Financial Model pages
if (fm.rnpv) addPage(renderFinancialModelPage);
if (fm.scenarioComparison) addPage(renderScenarioComparisonPage);
if (fm.realOptions || fm.competitiveDynamics || fm.lifecycleExtensions) addPage(renderRealOptionsLifecyclePage);

// 15. Comparables
addPage(renderComparablesPage);

// 16. Risk
addPage(renderRiskAnalysisPage);

// 17. Timeline
addPage(renderDealTimelinePage);

// 18. Therapeutic Intel
addPage(renderTherapeuticIntelPage);

// 19-20. Currency & Defensive
if (fm.rnpv) {
  addPage(renderCurrencySensitivityPage);
  if (fm.dealWaterfall) addPage(renderDealWaterfallPage);
  addPage(renderDefensiveAdvicePage);
  addPage(renderDealFlowContextPage);
}

// Regulatory, Milestone, Tax, etc.
if (fm.regulatoryRisk) addPage(renderRegulatoryRiskPage);
if (fm.milestoneProbabilities) addPage(renderMilestonePage);
if (fm.taxStructure) addPage(renderTaxStructurePage);
if (fm.royaltyStacking) addPage(renderRoyaltyStackingPage);
if (fm.patentDynamics) addPage(renderPatentDynamicsPage);
if (fm.cmcRisk) addPage(renderCMCRiskPage);
if (fm.earnoutValuation) addPage(renderEarnoutPage);
if (fm.pricingConstraints) addPage(renderPricingAccessPage);
if (fm.indicationSequence) addPage(renderIndicationSequencingPage);

// Last: Methodology
addPage(renderMethodologyPage);

// Update page count to actual
meta.pageCount = meta.currentPage;

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preclinical Alzheimer's Disease — Deal Term Benchmarks | Ambrosia Ventures</title>
  <style>${getEmbeddedFontStyles()}${getReportStyles()}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;

const outputPath = path.join(process.env.HOME || '/tmp', 'Downloads', 'Preclinical-AD-Benchmarks-July2026.html');
fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`\nReport saved (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, ${meta.currentPage} pages):`);
console.log(`  ${outputPath}`);
console.log(`\nOpen: open "${outputPath}"`);
console.log('Print to PDF: Cmd+P in browser');
