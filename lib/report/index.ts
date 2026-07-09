// Report Orchestrator — assembles all pages into a print-ready HTML document

import { getReportStyles } from './styles';
import { getEmbeddedFontStyles } from './fonts';
import { generateReportId, formatDate } from './helpers';
import { renderCoverPage } from './pages/cover';
import { renderTableOfContents } from './pages/tableOfContents';
import { renderExecutiveDashboard } from './pages/executiveDashboard';
import { renderDealStructurePage } from './pages/dealStructure';
import { renderDealTermsPage } from './pages/dealTerms';
import { renderSensitivityPage } from './pages/sensitivity';
import { renderComparablesPage } from './pages/comparables';
import { renderPartnersPage } from './pages/partners';
import { renderAIMemoPage } from './pages/aiMemo';
import { renderRiskAnalysisPage } from './pages/riskAnalysis';
import { renderDealTimelinePage } from './pages/dealTimeline';
import { renderNegotiationPage } from './pages/negotiation';
import { renderTherapeuticIntelPage } from './pages/therapeuticIntel';
import { renderMethodologyPage } from './pages/methodology';
import { renderFinancialModelPage } from './pages/financialModel';
import { renderCurrencySensitivityPage } from './pages/currencySensitivity';
import { renderDealFlowContextPage } from './pages/dealFlowContext';
import { renderDefensiveAdvicePage } from './pages/defensiveAdvice';
import { renderScenarioComparisonPage } from './pages/scenarioComparison';
import { renderDealWaterfallPage } from './pages/dealWaterfall';
import { renderRealOptionsLifecyclePage } from './pages/realOptionsLifecycle';
import { renderBuyerSpecificPage } from './pages/buyerSpecific';
import { renderRegulatoryRiskPage } from './pages/regulatoryRiskPage';
import { renderMilestonePage } from './pages/milestonePage';
import { renderTaxStructurePage } from './pages/taxStructurePage';
import { renderRoyaltyStackingPage } from './pages/royaltyStackingPage';
import { renderPatentDynamicsPage } from './pages/patentDynamicsPage';
import { renderCMCRiskPage } from './pages/cmcRiskPage';
import { renderEarnoutPage } from './pages/earnoutPage';
import { renderPricingAccessPage } from './pages/pricingAccessPage';
import { renderIndicationSequencingPage } from './pages/indicationSequencingPage';
import { renderBuyerSynergyPage } from './pages/buyerSynergyPage';
import { renderMAAcquisitionPage } from './pages/maAcquisitionPage';
import { renderDeliveryRoutePage } from './pages/deliveryRoutePage';
import { renderMolecularTargetPage } from './pages/molecularTargetPage';
import { renderTrispecificPage } from './pages/trispecificPage';
import type { PDFReportData, ReportMeta, TocEntry, BrandConfig } from './types';

export type { PDFReportData, PartnerForPDF, BrandConfig } from './types';

/** Returns the full HTML document string for the report with styles.
 *  Pages without data (AI memo, playbook) are excluded — no placeholders.
 *  When brandConfig is provided, the report uses the fund's branding (white-label). */
export function generateReportHTML(data: PDFReportData, brandConfig?: BrandConfig): string {
  const indication = data.result.labels.indication || data.inputs.indication;

  // Build pages dynamically — exclude sections with no data
  const pages: string[] = [];

  // Conditionally included pages
  const hasPlaybook = !!data.playbookData;
  const hasFinancialModel = !!data.rnpvResult;
  const hasScenarioComparison = !!data.scenarioComparison;
  const hasDealWaterfall = !!data.dealWaterfall;
  const hasAdvancedAnalytics = !!data.realOptions || !!data.competitiveDynamics || !!data.lifecycleExtensions;
  const hasBuyerSpecific = !!data.buyerSpecificValuation || (data.buyerSpecificValuations && data.buyerSpecificValuations.length > 0);

  // Build TOC entries with correct page numbers
  const tocEntries: TocEntry[] = [];
  let pageNum = 0;
  const toc = (title: string, description: string) => { pageNum++; tocEntries.push({ title, page: pageNum, description }); };
  toc('Cover Page', 'Asset overview, headline valuation, and risk score');
  toc('Table of Contents', 'Report navigation and section guide');
  toc('Executive Dashboard', 'Key metrics, value split, and deal recommendation');
  toc('Deal Structure', 'Payment architecture and milestone waterfall');
  toc('Deal Terms', 'Detailed term ranges, royalties, and modifiers');
  toc('M&A Acquisition Benchmarks', 'Milestones, earnouts, CVRs, and acquisition value by modality');
  toc('Trispecific Antibody Analysis', 'Modality deep-dive: multiplier, precedent deals, AD target combos');
  toc('Delivery Route & Administration', 'SubQ, IV, device lifecycle extensions and deal impact');
  toc('Sensitivity Analysis', 'Parameter impact, tornado chart, and value drivers');
  toc('Comparable Deals', 'Recent transactions and market benchmarks');
  toc('Partner Matches', 'Top-ranked potential licensing partners');
  toc('Deal Memo', 'Strategic narrative and deal structure analysis');
  if (hasPlaybook) toc('Negotiation Strategy', 'Data-driven negotiation playbook and tactics');
  toc('Risk Analysis', 'Risk factor breakdown and probability-weighted valuation');
  toc('Deal Timeline', 'Gantt-style milestone schedule from signing to launch');
  toc('Therapeutic Intelligence', 'Indication-specific market context and trends');
  if (hasFinancialModel) {
    toc('Financial Model', 'rNPV, Monte Carlo, and cash flow analysis');
    toc('Currency & Pricing Sensitivity', 'FX impact and regulatory pricing scenarios');
    toc('Deal Flow & Market Context', 'Historical deal flow, competitive landscape, and market sizing');
    toc('Defensive Analysis', 'Worst/best case scenarios and walk-away thresholds');
    if (hasScenarioComparison) toc('Scenario Comparison', 'Bear/Base/Bull rNPV with probability-weighted expected value');
    if (hasDealWaterfall) toc('Deal Valuation Waterfall', 'Valuation cascade and deal component allocation');
    if (hasAdvancedAnalytics) toc('Advanced Analytics', 'Real options, competitive dynamics, and lifecycle extensions');
    if (hasBuyerSpecific) toc('Buyer-Specific Valuation', 'Strategic premium analysis across matched partners');
  }
  if (data.regulatoryRisk) toc('Regulatory Risk', 'FDA CRL, AdComm, PDUFA, and PRV analysis');
  if (data.milestoneProbabilities) toc('Milestone Analysis', 'Individual milestone probability weighting');
  if (data.earnoutValuation) toc('Earnout & CVR', 'Contingent payment probability and time value');
  if (data.patentDynamics) toc('Patent & LOE', 'Patent term adjustments and generic entry dynamics');
  if (data.cmcRisk) toc('Manufacturing Risk', 'CMC timeline, scalability, and supply chain risk');
  if (data.pricingConstraints) toc('Pricing & Access', 'ICER thresholds, IRA exposure, and payer dynamics');
  if (data.indicationSequence) toc('Franchise Expansion', 'Indication sequencing and cannibalization');
  if (data.taxStructure) toc('Tax Structure', 'Cross-border IP structuring and tax optimization');
  if (data.royaltyStacking) toc('Royalty Stacking', 'Upstream IP obligations and net royalty impact');
  if (data.buyerSynergies?.length) toc('Buyer Synergies', 'Acquirer-specific synergy analysis');
  toc('Methodology', 'Model design, data sources, and disclaimer');

  const totalPages = pageNum;

  const meta: ReportMeta = {
    reportId: generateReportId(),
    generatedAt: formatDate(),
    version: '2.0',
    pageCount: totalPages,
    currentPage: 0,
    tocEntries,
    brandConfig,
  };

  // Helper to render a page with auto-incrementing page number
  const addPage = (renderer: (d: PDFReportData, m: ReportMeta) => string) => {
    meta.currentPage++;
    pages.push(renderer(data, meta));
  };

  // Core pages (always included)
  addPage(renderCoverPage);
  addPage(renderTableOfContents);
  addPage(renderExecutiveDashboard);
  addPage(renderDealStructurePage);
  addPage(renderDealTermsPage);
  addPage(renderMAAcquisitionPage);
  addPage(renderTrispecificPage);
  addPage(renderDeliveryRoutePage);
  addPage(renderMolecularTargetPage);
  addPage(renderSensitivityPage);
  addPage(renderComparablesPage);
  addPage(renderPartnersPage);
  // AI pages — always include memo page (shows fallback if generation failed)
  addPage(renderAIMemoPage);
  if (hasPlaybook) addPage(renderNegotiationPage);
  // Post-AI pages (always included)
  addPage(renderRiskAnalysisPage);
  addPage(renderDealTimelinePage);
  addPage(renderTherapeuticIntelPage);
  // Financial modeling pages — only if data exists
  if (hasFinancialModel) {
    addPage(renderFinancialModelPage);
    addPage(renderCurrencySensitivityPage);
    addPage(renderDealFlowContextPage);
    addPage(renderDefensiveAdvicePage);
    if (hasScenarioComparison) addPage(renderScenarioComparisonPage);
    if (hasDealWaterfall) addPage(renderDealWaterfallPage);
    if (hasAdvancedAnalytics) addPage(renderRealOptionsLifecyclePage);
    if (hasBuyerSpecific) addPage(renderBuyerSpecificPage);
  }
  // New advanced analytics pages — conditionally included when data exists
  if (data.regulatoryRisk) addPage(renderRegulatoryRiskPage);
  if (data.milestoneProbabilities) addPage(renderMilestonePage);
  if (data.earnoutValuation) addPage(renderEarnoutPage);
  if (data.patentDynamics) addPage(renderPatentDynamicsPage);
  if (data.cmcRisk) addPage(renderCMCRiskPage);
  if (data.pricingConstraints) addPage(renderPricingAccessPage);
  if (data.indicationSequence) addPage(renderIndicationSequencingPage);
  if (data.taxStructure) addPage(renderTaxStructurePage);
  if (data.royaltyStacking) addPage(renderRoyaltyStackingPage);
  if (data.buyerSynergies?.length) addPage(renderBuyerSynergyPage);
  addPage(renderMethodologyPage);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${indication} — Deal Valuation Report | ${brandConfig?.fundName || 'Ambrosia Ventures'}</title>
      <style>${getEmbeddedFontStyles()}${getReportStyles(brandConfig)}</style>
    </head>
    <body>
      ${pages.join('\n')}
    </body>
    </html>
  `;
}

/** Opens a new window with the report HTML and triggers print dialog. */
export function generatePDFReport(data: PDFReportData): void {
  const html = generateReportHTML(data);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: render inline via blob URL (avoids popup blocker)
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
    };
    document.body.appendChild(iframe);
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

export { generateExecutiveSummaryHTML, generateExecutiveSummaryPDF } from './executiveSummary';
