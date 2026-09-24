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
// Brief v3 pages
import { renderDecisionPage } from './pages/decisionPage';
import { renderValuationBridgePage } from './pages/valuationBridge';
import { renderCompScatterPage } from './pages/compScatter';
import { renderCompAppendixPages, countCompAppendixPages } from './pages/compAppendix';
import { renderRegionalStrategyPage } from './pages/regionalStrategy';
import { renderTermSheetPrecedentPage } from './pages/termSheetPrecedent';
import { renderInflectionPathPage } from './pages/inflectionPath';
import { renderBuyerMapPage } from './pages/buyerMap';
import { renderBuyerBehaviourPage } from './pages/buyerBehaviour';
import { renderPipelineMapPage } from './pages/pipelineMap';
import { renderCatalystCalendarPage } from './pages/catalystCalendar';
import { renderPatientFunnelPage } from './pages/patientFunnel';
import { renderPositioningObjectionsPage } from './pages/positioningObjections';
import { renderDiligenceReadinessPage } from './pages/diligenceReadiness';
import type { PDFReportData, ReportMeta, TocEntry, BrandConfig } from './types';

export type { PDFReportData, PartnerForPDF, BrandConfig } from './types';

type PageRenderer = (d: PDFReportData, m: ReportMeta) => string;
type MultiPageRenderer = (d: PDFReportData, m: ReportMeta) => string[];

interface PageSpec {
  title: string;
  description: string;
  render: PageRenderer | MultiPageRenderer;
  /** Number of physical pages this entry produces (default 1). */
  count?: number;
}

/**
 * Page order for the Deal Intelligence Brief. Sections are included only when
 * their data exists — no placeholder pages. The v3 intelligence layer
 * (`data.brief`) adds the decision page, valuation bridge, cited comparable
 * set, regional and term-sheet precedent, inflection path, buyer map and
 * behaviour, pipeline map, catalyst calendar, patient funnel, positioning
 * and objections, diligence readiness and the cited comp appendix.
 */
export function buildPageSpecs(data: PDFReportData): PageSpec[] {
  const b = data.brief;
  const hasPlaybook = !!data.playbookData;
  const hasFinancialModel = !!data.rnpvResult;
  const hasScenarioComparison = !!data.scenarioComparison;
  const hasDealWaterfall = !!data.dealWaterfall;
  const hasAdvancedAnalytics = !!data.realOptions || !!data.competitiveDynamics || !!data.lifecycleExtensions;
  const hasBuyerSpecific = !!data.buyerSpecificValuation || (data.buyerSpecificValuations && data.buyerSpecificValuations.length > 0);
  const hasCompSet = !!b?.compSet && b.compSet.rows.length >= 3;

  const specs: PageSpec[] = [];
  const add = (title: string, description: string, render: PageRenderer | MultiPageRenderer, count = 1) =>
    specs.push({ title, description, render, count });

  add('Cover', 'Asset, headline range, and risk score', renderCoverPage);
  add('Table of Contents', 'Section guide', renderTableOfContents);
  if (b?.decision) add('The Decision', 'Recommendation, counterparties, ask, floor, walk-away, and timeline', renderDecisionPage);
  add('Executive Dashboard', 'Key metrics, value split, and deal recommendation', renderExecutiveDashboard);
  if (b?.bridge) add('Valuation Bridge', 'Comps, rNPV, Monte Carlo, scenarios, and buyer-implied ranges reconciled to one ask', renderValuationBridgePage);
  add('Deal Structure', 'Payment architecture and milestone waterfall', renderDealStructurePage);
  add('Deal Terms', 'Detailed term ranges, royalties, and modifiers', renderDealTermsPage);
  if (hasCompSet) {
    add('Comparable Set', 'Scatter of matched deals, distribution by phase, and the deals that drive the headline', renderCompScatterPage);
  } else {
    add('Comparable Deals', 'Recent transactions and market benchmarks', renderComparablesPage);
  }
  if (b?.regional) add('Regional Deal Strategy', 'What regional rights fetch versus a global deal', renderRegionalStrategyPage);
  if (b?.termSheet) add('Term-Sheet Precedent Map', 'Clause frequency in comparable deals and what to ask for', renderTermSheetPrecedentPage);
  add('M&A Acquisition Benchmarks', 'Milestones, earnouts, CVRs, and acquisition value by modality', renderMAAcquisitionPage);
  add('Trispecific Antibody Analysis', 'Modality deep-dive: multiplier, precedent deals, target combinations', renderTrispecificPage);
  add('Delivery Route & Administration', 'SubQ, IV, device lifecycle extensions and deal impact', renderDeliveryRoutePage);
  add('Molecular Target Analysis', 'Target class precedent and premium', renderMolecularTargetPage);
  add('Sensitivity Analysis', 'Parameter impact, tornado chart, and value drivers', renderSensitivityPage);
  if (hasFinancialModel) {
    add('Financial Model', 'rNPV, Monte Carlo, and cash flow analysis', renderFinancialModelPage);
    if (b?.landscape?.funnel) add('Patient Funnel', 'Where the peak-sales number comes from', renderPatientFunnelPage);
    if (b?.inflection) add('Path to Next Inflection', 'Partner now versus fund to the next data point; financing alternative', renderInflectionPathPage);
    add('Currency & Pricing Sensitivity', 'FX impact and regulatory pricing scenarios', renderCurrencySensitivityPage);
    add('Deal Flow & Market Context', 'Historical deal flow, competitive landscape, and market sizing', renderDealFlowContextPage);
    add('Defensive Analysis', 'Worst/best case scenarios and walk-away thresholds', renderDefensiveAdvicePage);
    if (hasScenarioComparison) add('Scenario Comparison', 'Bear/Base/Bull rNPV with probability-weighted expected value', renderScenarioComparisonPage);
    if (hasDealWaterfall) add('Deal Valuation Waterfall', 'Valuation cascade and deal component allocation', renderDealWaterfallPage);
    if (hasAdvancedAnalytics) add('Advanced Analytics', 'Real options, competitive dynamics, and lifecycle extensions', renderRealOptionsLifecyclePage);
  }
  if (b?.buyerMap) {
    add('Buyer Map', 'Fit versus urgency, capacity, and loss-of-exclusivity calendar', renderBuyerMapPage);
    add('Buyer Stage Behaviour', 'What each buyer has paid at this stage, who is excluded, and the process', renderBuyerBehaviourPage);
  }
  add('Partner Matches', 'Ranked potential licensing partners with intent scores', renderPartnersPage);
  if (hasFinancialModel && hasBuyerSpecific) add('Buyer-Specific Valuation', 'Strategic premium analysis across matched partners', renderBuyerSpecificPage);
  if (b?.landscape?.pipeline) add('Pipeline Map', 'Every active program for the indication by mechanism and phase', renderPipelineMapPage);
  if (b?.landscape?.catalysts) add('Catalyst Calendar', 'Readouts and exclusivity losses in the next 24 months; go-to-market window', renderCatalystCalendarPage);
  add('Therapeutic Intelligence', 'Indication-specific market context and trends', renderTherapeuticIntelPage);
  add('Strategic Analysis', 'Narrative and deal structure analysis', renderAIMemoPage);
  if (hasPlaybook) add('Negotiation Strategy', 'Negotiation playbook and tactics', renderNegotiationPage);
  if (b?.positioning) add('Positioning & Objections', 'How to tell the story and what buyers will push back on', renderPositioningObjectionsPage);
  if (b?.diligence) add('Diligence Readiness', 'What a buyer will ask for and what to close before outreach', renderDiligenceReadinessPage);
  add('Risk Analysis', 'Risk factor breakdown and probability-weighted valuation', renderRiskAnalysisPage);
  add('Deal Timeline', 'Milestone schedule from signing to launch', renderDealTimelinePage);
  if (data.regulatoryRisk) add('Regulatory Risk', 'FDA CRL, AdComm, PDUFA, and PRV analysis', renderRegulatoryRiskPage);
  if (data.milestoneProbabilities) add('Milestone Analysis', 'Individual milestone probability weighting', renderMilestonePage);
  if (data.earnoutValuation) add('Earnout & CVR', 'Contingent payment probability and time value', renderEarnoutPage);
  if (data.patentDynamics) add('Patent & LOE', 'Patent term adjustments and generic entry dynamics', renderPatentDynamicsPage);
  if (data.cmcRisk) add('Manufacturing Risk', 'CMC timeline, scalability, and supply chain risk', renderCMCRiskPage);
  if (data.pricingConstraints) add('Pricing & Access', 'ICER thresholds, IRA exposure, and payer dynamics', renderPricingAccessPage);
  if (data.indicationSequence) add('Franchise Expansion', 'Indication sequencing and cannibalization', renderIndicationSequencingPage);
  if (data.taxStructure) add('Tax Structure', 'Cross-border IP structuring and tax optimization', renderTaxStructurePage);
  if (data.royaltyStacking) add('Royalty Stacking', 'Upstream IP obligations and net royalty impact', renderRoyaltyStackingPage);
  if (data.buyerSynergies?.length) add('Buyer Synergies', 'Acquirer-specific synergy analysis', renderBuyerSynergyPage);
  if (hasCompSet) add('Comparable Appendix', 'Every comparable deal with date, structure, terms, and source', renderCompAppendixPages, countCompAppendixPages(data));
  add('Methodology', 'Model design, data sources, coverage, and disclaimer', renderMethodologyPage);
  return specs;
}

/** Returns the full HTML document string for the report with styles.
 *  Pages without data are excluded — no placeholders.
 *  When brandConfig is provided, the report uses the fund's branding (white-label). */
export function generateReportHTML(data: PDFReportData, brandConfig?: BrandConfig): string {
  const indication = data.result.labels.indication || data.inputs.indication;
  const allSpecs = buildPageSpecs(data);

  // Pass 1: render with provisional numbering to learn which sections are
  // empty for this asset (legacy renderers return '' when they have no data)
  // and how many physical pages each produces. Renderers are pure, so a
  // second pass with the final numbering is cheap and keeps the TOC exact.
  const probe: ReportMeta = {
    reportId: 'probe', generatedAt: formatDate(), version: '3.0',
    pageCount: 0, currentPage: 0, tocEntries: [], brandConfig,
  };
  const live: Array<{ spec: PageSpec; count: number }> = [];
  for (const spec of allSpecs) {
    probe.currentPage++;
    const out = spec.render(data, probe);
    const parts = Array.isArray(out) ? out : [out];
    const count = parts.filter(p => p.trim().length > 0).length;
    if (count > 0) live.push({ spec, count });
  }

  const tocEntries: TocEntry[] = [];
  let pageNum = 0;
  for (const { spec, count } of live) {
    tocEntries.push({ title: spec.title, page: pageNum + 1, description: spec.description });
    pageNum += count;
  }

  const meta: ReportMeta = {
    reportId: generateReportId(),
    generatedAt: formatDate(),
    version: '3.0',
    pageCount: pageNum,
    currentPage: 0,
    tocEntries,
    brandConfig,
  };

  // Pass 2: final render.
  const pages: string[] = [];
  for (const { spec, count } of live) {
    meta.currentPage++;
    const out = spec.render(data, meta);
    const parts = (Array.isArray(out) ? out : [out]).filter(p => p.trim().length > 0);
    pages.push(...parts);
    meta.currentPage += count - 1;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${indication} — Deal Intelligence Brief | ${brandConfig?.fundName || 'Ambrosia Ventures'}</title>
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
