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
import { renderRiskAnalysisPage } from './pages/riskAnalysis';
import { renderDealTimelinePage } from './pages/dealTimeline';
import { renderMethodologyPage } from './pages/methodology';
import { renderFinancialModelPages } from './pages/financialModel';
import { renderDealFlowContextPage } from './pages/dealFlowContext';
import { renderDefensiveAdvicePage } from './pages/defensiveAdvice';
import { renderScenarioComparisonPage } from './pages/scenarioComparison';
import { renderDealWaterfallPage } from './pages/dealWaterfall';
import { renderRealOptionsLifecyclePage } from './pages/realOptionsLifecycle';
import { renderRegulatoryRiskPage } from './pages/regulatoryRiskPage';
import { renderMilestonePages } from './pages/milestonePage';
import { renderPatentDynamicsPage } from './pages/patentDynamicsPage';
import { renderCMCRiskPage } from './pages/cmcRiskPage';
import { renderEarnoutPages } from './pages/earnoutPage';
// Brief v3 pages
import { renderDecisionPage } from './pages/decisionPage';
import { renderScoredCallPage } from './pages/scoredCall';
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
  const hasFinancialModel = !!data.rnpvResult;
  // A negative or zero risk-adjusted NPV is a statement about the stage, not
  // a value: the pages that derive numbers from it (defensive thresholds,
  // scenario values, waterfall, real options) would print inverted ranges and
  // nonsense percentages. They are included only when the rNPV is informative;
  // the bridge and the financial model page say why they are absent.
  const rnpvInformative = hasFinancialModel && (b?.bridge ? b.bridge.rnpvInformative : (data.rnpvResult!.riskAdjustedNPV > 0));
  const hasScenarioComparison = rnpvInformative && !!data.scenarioComparison;
  const hasDealWaterfall = rnpvInformative && !!data.dealWaterfall;
  const hasAdvancedAnalytics = rnpvInformative && (!!data.realOptions || !!data.competitiveDynamics || !!data.lifecycleExtensions);
  const hasCompSet = !!b?.compSet && b.compSet.rows.length >= 3;
  const dealType = `${data.inputs.dealType ?? ''} ${b?.asset.targetDealType ?? ''}`.toLowerCase();
  const isAcquisition = /acqui|m&a|merger/.test(dealType);

  const specs: PageSpec[] = [];
  const add = (title: string, description: string, render: PageRenderer | MultiPageRenderer, count = 1) =>
    specs.push({ title, description, render, count });

  // Front matter and the decision layer. The v3 sections are always listed
  // when the intelligence layer ran: each page renders its own empty state
  // that says what is missing and why, so a thin section is visible rather
  // than silently absent (format rule 4).
  add('Cover', 'Asset, headline range, and risk score', renderCoverPage);
  add('Table of Contents', 'Section guide', renderTableOfContents);
  if (b) add('The Decision', 'Recommendation, counterparties, ask, floor, walk-away, and timeline', renderDecisionPage);
  if (b) add('This Call Is Scored', 'The registered ask, floor, buyers and window; how the call is scored and when you hear from us', renderScoredCallPage);
  add('Executive Dashboard', 'Key metrics, value split, and deal recommendation', renderExecutiveDashboard);
  if (b) add('Valuation Bridge', 'Comps, rNPV, Monte Carlo, scenarios, and buyer-implied ranges reconciled to one ask', renderValuationBridgePage);
  add('Deal Structure', 'Payment architecture and milestone waterfall', renderDealStructurePage);
  add('Deal Terms', 'Detailed term ranges, royalties, and modifiers', renderDealTermsPage);

  // Evidence: comparables
  if (b) {
    add('Comparable Set', 'Scatter of matched deals, distribution by phase, and the deals that drive the headline', renderCompScatterPage);
    add('Regional Deal Strategy', 'What regional rights fetch versus a global deal', renderRegionalStrategyPage);
    add('Term-Sheet Precedent Map', 'Clause frequency in comparable deals and what to ask for', renderTermSheetPrecedentPage);
  } else {
    add('Comparable Deals', 'Recent transactions and market benchmarks', renderComparablesPage);
  }
  add('Sensitivity Analysis', 'Parameter impact, tornado chart, and value drivers', renderSensitivityPage);

  // Evidence: financial model
  if (hasFinancialModel) {
    add('Financial Model', 'rNPV, Monte Carlo, and cash flow analysis', renderFinancialModelPages);
    if (b) add('Patient Funnel', 'Where the peak-sales number comes from', renderPatientFunnelPage);
    if (b) add('Path to Next Inflection', 'Partner now versus fund to the next data point; financing alternative', renderInflectionPathPage);
    add('Deal Flow & Market Context', 'Historical deal flow, competitive landscape, and market sizing', renderDealFlowContextPage);
    if (rnpvInformative) add('Defensive Analysis', 'Worst/best case scenarios and the walk-away', renderDefensiveAdvicePage);
    if (hasScenarioComparison) add('Scenario Comparison', 'Bear/Base/Bull rNPV with probability-weighted expected value', renderScenarioComparisonPage);
    if (hasDealWaterfall) add('Deal Valuation Waterfall', 'Valuation cascade and deal component allocation', renderDealWaterfallPage);
    if (hasAdvancedAnalytics) add('Advanced Analytics', 'Real options, competitive dynamics, and lifecycle extensions', renderRealOptionsLifecyclePage);
  }

  // Evidence: buyers and landscape
  if (b) {
    add('Buyer Map', 'Fit versus urgency, capacity, and loss-of-exclusivity calendar', renderBuyerMapPage);
    add('Buyer Stage Behaviour', 'What each buyer has paid at this stage, who is excluded, and the process', renderBuyerBehaviourPage);
    add('Pipeline Map', 'Every active program for the indication by mechanism and phase', renderPipelineMapPage);
    add('Catalyst Calendar', 'Readouts and exclusivity losses in the next 24 months; go-to-market window', renderCatalystCalendarPage);
  } else {
    add('Partner Matches', 'Ranked potential licensing partners with intent scores', renderPartnersPage);
  }

  // The written position
  if (b) {
    add('Positioning & Objections', 'How to tell the story and what buyers will push back on', renderPositioningObjectionsPage);
    add('Diligence Readiness', 'What a buyer will ask for and what to close before outreach', renderDiligenceReadinessPage);
  }

  // Risk and execution
  add('Risk Analysis', 'Risk factor breakdown and probability-weighted valuation', renderRiskAnalysisPage);
  add('Deal Timeline', 'Milestone schedule from signing to launch', renderDealTimelinePage);
  if (data.regulatoryRisk) add('Regulatory Risk', 'FDA CRL, AdComm, PDUFA, and PRV analysis', renderRegulatoryRiskPage);
  if (data.milestoneProbabilities) add('Milestone Analysis', 'Individual milestone probability weighting', renderMilestonePages);
  if (isAcquisition && data.earnoutValuation) add('Earnout & CVR', 'Contingent payment probability and time value', renderEarnoutPages);
  if (data.patentDynamics) add('Patent & LOE', 'Patent term adjustments and generic entry dynamics', renderPatentDynamicsPage);
  if (data.cmcRisk) add('Manufacturing Risk', 'CMC timeline, scalability, and supply chain risk', renderCMCRiskPage);

  // Appendix
  if (hasCompSet) add('Comparable Appendix', 'Every comparable deal with date, structure, terms, and source', renderCompAppendixPages, countCompAppendixPages(data));
  add('Methodology', 'Model design, data sources, coverage, and disclaimer', renderMethodologyPage);
  return specs;
}

/**
 * Legacy sections removed from the client brief on 2026-09-25. Each either
 * printed hard-coded figures for every asset (M&A benchmarks, trispecific,
 * delivery route), cited third-party databases Solidus does not license
 * (tax, royalty stacking, buyer synergies, franchise expansion, pricing and
 * access, currency), duplicated a v3 section with a different answer
 * (legacy partner matches, buyer-specific valuation, strategic analysis,
 * negotiation playbook), or was template prose (therapeutic intelligence).
 * They return only when rebuilt on Solidus data and reconciled to the bridge.
 */
export const RETIRED_SECTIONS = [
  'M&A Acquisition Benchmarks', 'Trispecific Antibody Analysis', 'Delivery Route & Administration', 'Molecular Target Analysis',
  'Currency & Pricing Sensitivity', 'Buyer-Specific Valuation', 'Therapeutic Intelligence', 'Strategic Analysis', 'Negotiation Strategy',
  'Pricing & Access', 'Franchise Expansion', 'Tax Structure', 'Royalty Stacking', 'Buyer Synergies',
] as const;

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
