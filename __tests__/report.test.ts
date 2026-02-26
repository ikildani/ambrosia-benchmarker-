/**
 * Tests for the report generation system (lib/report).
 *
 * Verifies HTML output structure, dynamic TOC, page counts,
 * therapeutic-area variations, required sections, and metadata.
 */

import { generateReportHTML } from '@/lib/report';
import type { PDFReportData } from '@/lib/report/types';
import type { CalculationResult, CalculationInput } from '@/lib/calculations';
import type { SensitivityData } from '@/lib/sensitivity';
import type { ComparableDealForUI } from '@/lib/comparableDeals';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import type { NegotiationPlaybook } from '@/lib/ai/playbook-generator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRange(low: number, med: number, high: number) {
  return { low, median: med, high };
}

function makeDrillDown() {
  const factors = [{ name: 'Test Factor', impact: 'positive' as const, percentage: 10 }];
  const entry = { rangeExplanation: 'Test explanation', rangeWidthPercent: 20, factors };
  return {
    upfront: entry,
    totalDealValue: entry,
    devMilestones: { ...entry, breakdown: [{ label: 'IND Filing', percentage: 30, value: makeRange(10, 15, 20) }] },
    regMilestones: { ...entry, breakdown: [{ label: 'FDA Approval', percentage: 50, value: makeRange(20, 30, 40) }] },
    commMilestones: { ...entry, breakdown: [{ label: '$1B Net Sales', percentage: 30, value: makeRange(15, 25, 35) }] },
    royalties: { ...entry, breakdown: [{ label: 'Base Tier', percentage: 8, value: makeRange(8, 10, 12) }] },
  };
}

const baseResult: CalculationResult = {
  terms: {
    upfront: makeRange(50, 100, 150),
    devMilestones: makeRange(100, 200, 300),
    regMilestones: makeRange(50, 100, 150),
    commMilestones: makeRange(100, 200, 300),
    totalDealValue: makeRange(400, 700, 1000),
  },
  tieredRoyalties: {
    base: { low: 8, high: 12 },
    midTier: { low: 10, high: 14 },
    highTier: { low: 12, high: 16 },
  },
  dealRecommendation: { upfrontPercent: 15, milestonePercent: 85, rationale: 'Test rationale' },
  negotiationInsight: 'Test negotiation insight',
  modifiers: [{ name: 'ADC', multiplier: 1.3 }],
  labels: { phase: 'Phase 2', modality: 'Antibody-Drug Conjugate', indication: 'Lung (NSCLC)' },
  drillDown: makeDrillDown(),
  phase: 'phase2',
};

const oncologyInputs: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'adc',
  indication: 'lung_nsclc',
  territory: 'global',
  biomarker: 'selected',
  lineOfTherapy: '2L',
  treatmentApproach: 'diseaseModifying',
  combinationPotential: 'strong',
  competitivePosition: 'bestInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
};

const neurologyInputs: CalculationInput = {
  ...oncologyInputs,
  therapeuticArea: 'neurology',
  modality: 'smallMolecule',
  indication: 'alzheimers',
  bbbPenetration: 'provenCNS',
  diseaseProgression: 'slowProgressive',
  biomarkerValidation: 'validatedSurrogate',
};

const baseSensitivity: SensitivityData = {
  currentUpfront: 100,
  currentTotalValue: 700,
  parameters: [],
  topValueDriver: {
    parameterKey: 'phase',
    parameterLabel: 'Development Phase',
    bestOption: { value: 'phase3', label: 'Phase 3', resultingUpfront: 200, resultingTotalValue: 1200, delta: 500, deltaPercent: 71 },
    insightText: 'Test insight',
  },
  neurologyInsights: [],
  computedAt: Date.now(),
};

const baseComparables: ComparableDealForUI[] = [
  { id: 'deal-0', parties: 'Acme / BigPharma', totalValue: '$1.2B', year: 2024, relevanceReasons: ['Same modality'] },
];

const fakeMemo: DealMemo = {
  executive_summary: 'Test executive summary for ADC deal.',
  valuation_rationale: 'Strong market dynamics support premium valuation.',
  market_context: 'ADC market expanding rapidly.',
  risk_factors: ['Competition from established players', 'Manufacturing complexity'],
  negotiation_priorities: ['Secure higher upfront', 'Tiered royalty escalation'],
  comparable_analysis: 'Comparable to recent Daiichi-Merck ADC deal.',
  confidence_level: 'high',
  generatedAt: new Date().toISOString(),
};

const fakePlaybookSection = { title: 'Test', content: 'Test content', bullets: ['Bullet 1'], highlight: 'Key point' };

const fakePlaybook: NegotiationPlaybook = {
  generatedAt: new Date().toISOString(),
  assetProfile: { phase: 'Phase 2', modality: 'ADC', indication: 'Lung (NSCLC)', territory: 'Global' },
  sections: {
    openingPosition: fakePlaybookSection,
    structureStrategy: fakePlaybookSection,
    royaltyFloor: fakePlaybookSection,
    competitiveIntelligence: fakePlaybookSection,
    partnerTactics: fakePlaybookSection,
  },
  keyCaveats: ['Caveat 1'],
};

/** Count pages by looking for the report-page CSS class in any class attribute. */
function countPages(html: string): number {
  return (html.match(/class="[^"]*report-page[^"]*"/g) || []).length;
}

function buildOncologyData(overrides?: Partial<PDFReportData>): PDFReportData {
  return {
    result: baseResult,
    inputs: oncologyInputs,
    sensitivityData: baseSensitivity,
    riskScore: 35,
    comparableDeals: baseComparables,
    ...overrides,
  };
}

function buildNeurologyData(overrides?: Partial<PDFReportData>): PDFReportData {
  return {
    result: { ...baseResult, labels: { ...baseResult.labels, indication: "Alzheimer's Disease" } },
    inputs: neurologyInputs,
    sensitivityData: { ...baseSensitivity, neurologyInsights: [{ title: 'BBB Risk', description: 'Test', impactLevel: 'HIGH', category: 'bbb_penetration' }] },
    riskScore: 55,
    comparableDeals: baseComparables,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateReportHTML', () => {
  describe('HTML generation', () => {
    it('returns a valid HTML document with DOCTYPE, html, head, and body tags', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('includes the indication name in the document title', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toContain('<title>Lung (NSCLC)');
      expect(html).toContain('Deal Valuation Report | Ambrosia Ventures</title>');
    });

    it('embeds styles in a <style> tag', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });
  });

  describe('Dynamic Table of Contents', () => {
    it('contains TOC section with expected entry titles', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toContain('Table of Contents');
      expect(html).toContain('Executive Dashboard');
      expect(html).toContain('Deal Structure');
      expect(html).toContain('Deal Terms');
      expect(html).toContain('Sensitivity Analysis');
      expect(html).toContain('Comparable Deals');
      expect(html).toContain('Partner Matches');
      expect(html).toContain('Risk Analysis');
      expect(html).toContain('Deal Timeline');
      expect(html).toContain('Methodology');
    });

    it('includes page number markers (p. N) for TOC entries', () => {
      const html = generateReportHTML(buildOncologyData());
      // The TOC renders "p. 1", "p. 2", etc.
      expect(html).toMatch(/p\.\s*1/);
      expect(html).toMatch(/p\.\s*2/);
      expect(html).toMatch(/p\.\s*3/);
    });
  });

  describe('Page count', () => {
    it('renders 13 core pages (AI memo page always included as fallback)', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(countPages(html)).toBe(13);
    });

    it('renders 13 pages when memoData is provided (AI Deal Memo with content)', () => {
      const html = generateReportHTML(buildOncologyData({ memoData: fakeMemo }));
      expect(countPages(html)).toBe(13);
    });

    it('renders 14 pages when both memoData and playbookData are provided', () => {
      const html = generateReportHTML(buildOncologyData({
        memoData: fakeMemo,
        playbookData: fakePlaybook,
      }));
      expect(countPages(html)).toBe(14);
    });
  });

  describe('Different therapeutic areas', () => {
    it('uses the oncology indication label in the title for oncology reports', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toContain('Lung (NSCLC)');
    });

    it('uses the neurology indication label in the title for neurology reports', () => {
      const html = generateReportHTML(buildNeurologyData());
      expect(html).toContain("Alzheimer's Disease");
    });

    it('produces the same core page count for oncology and neurology (no AI data)', () => {
      const oncoHtml = generateReportHTML(buildOncologyData());
      const neuroHtml = generateReportHTML(buildNeurologyData());
      expect(countPages(oncoHtml)).toBe(countPages(neuroHtml));
    });
  });

  describe('Required sections present', () => {
    let html: string;
    beforeAll(() => {
      html = generateReportHTML(buildOncologyData());
    });

    it('includes the Executive Dashboard section', () => {
      expect(html).toContain('Executive Dashboard');
    });

    it('includes the Deal Terms section', () => {
      expect(html).toContain('Deal Terms');
    });

    it('includes the Deal Structure section', () => {
      expect(html).toContain('Deal Structure');
    });

    it('includes the Sensitivity Analysis section', () => {
      expect(html).toContain('Sensitivity Analysis');
    });

    it('includes the Therapeutic Intelligence section', () => {
      expect(html).toContain('Therapeutic Intelligence');
    });

    it('includes the Methodology section', () => {
      expect(html).toContain('Methodology');
    });
  });

  describe('Meta information', () => {
    it('includes a report ID matching AMB-YYYYMMDD-XXXXXX pattern', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toMatch(/AMB-\d{8}-[A-Z0-9]{6}/);
    });

    it('includes the generated date in the output', () => {
      const html = generateReportHTML(buildOncologyData());
      // formatDate produces e.g. "February 23, 2026"
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const today = new Date();
      const expectedMonth = monthNames[today.getMonth()];
      expect(html).toContain(expectedMonth);
      expect(html).toContain(String(today.getFullYear()));
    });

    it('includes the version number in the TOC metadata area', () => {
      const html = generateReportHTML(buildOncologyData());
      expect(html).toContain('Version 2.0');
    });

    it('includes total page count in the TOC metadata area', () => {
      const html = generateReportHTML(buildOncologyData());
      // TOC renders "13 pages" (AI memo page always included, even as fallback)
      expect(html).toContain('13 pages');
    });
  });
});
