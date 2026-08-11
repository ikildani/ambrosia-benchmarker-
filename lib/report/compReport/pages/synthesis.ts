import {
  COLORS,
  pageHeader,
  pageFooter,
  escapeHtml,
  formatUsd,
  getLabel,
  phaseLabels,
  modalityLabels,
  territoryLabels,
} from '../../helpers';
import type { CompReportData } from '../types';

export function renderSynthesisPage(
  data: CompReportData,
  meta: { reportId: string; currentPage: number; pageCount: number }
): string {
  const { narration, benchmarkRange, inputs } = data;

  const synthNarrative = narration?.synthesisNarrative ?? buildFallbackSynthesis(data);
  const confidence = narration?.confidenceLevel ?? 'medium';

  const confidenceConfig = {
    high: { color: COLORS.teal, bg: COLORS.tealLight, label: 'High', desc: 'Large comparable set with strong phase and modality matches' },
    medium: { color: COLORS.amber, bg: COLORS.amberLight, label: 'Medium', desc: 'Adequate comparable set; some adjustments needed for precise positioning' },
    low: { color: COLORS.rose, bg: COLORS.roseLight, label: 'Low', desc: 'Limited comparable set; benchmarks should be treated as directional' },
  }[confidence];

  const keyConsiderations = buildKeyConsiderations(data);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Comparable Transaction Analysis')}

      <div class="section-title-lg" style="margin-bottom: 18px;">Synthesis &amp; Methodology</div>

      <!-- Synthesis Narrative -->
      <div class="card" style="padding: 20px 24px; margin-bottom: 18px; border-top: 3px solid ${COLORS.teal};">
        <div style="font-size: 9px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 12px;">Market Synthesis</div>
        <div style="font-size: 10.5px; color: ${COLORS.gray700}; line-height: 1.75; white-space: pre-line;">${escapeHtml(synthNarrative)}</div>
      </div>

      <!-- Confidence + Key Considerations grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
        <!-- Confidence Assessment -->
        <div class="card" style="padding: 16px 20px; border-left: 3px solid ${confidenceConfig.color};">
          <div style="font-size: 9px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px;">Confidence Assessment</div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="
              padding: 4px 12px;
              background: ${confidenceConfig.bg};
              border-radius: 4px;
              font-size: 11px;
              font-weight: 800;
              color: ${confidenceConfig.color};
              letter-spacing: 0.04em;
            ">${confidenceConfig.label}</div>
          </div>
          <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">${confidenceConfig.desc}</div>
        </div>

        <!-- Key Considerations -->
        <div class="card" style="padding: 16px 20px; border-left: 3px solid ${COLORS.purple};">
          <div style="font-size: 9px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px;">Key Considerations</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${keyConsiderations.map(c => `
              <div style="display: flex; align-items: flex-start; gap: 6px;">
                <div style="width: 4px; height: 4px; border-radius: 50%; background: ${COLORS.purple}; margin-top: 5px; flex-shrink: 0;"></div>
                <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.55;">${escapeHtml(c)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Methodology -->
      <div class="card" style="padding: 18px 24px; background: ${COLORS.gray50}; border: 1px solid ${COLORS.gray200};">
        <div style="font-size: 9px; font-weight: 700; color: ${COLORS.navy}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px;">Methodology</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px;">
          <div>
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">Scoring Model</div>
            <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">
              Comparable transactions are scored using a six-dimension hedonic regression model across development phase (0–10), modality (0–10), therapeutic area (0–8), indication (0–10), territory (0–4), and deal type (0–3). Scores are weighted by recency (3.0x for 2025+, declining to 0.25x for pre-2018).
            </div>
          </div>
          <div>
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">Data Sources</div>
            <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">
              Publicly disclosed transaction terms from SEC EDGAR 8-K filings, FTC pre-merger filings, company press releases, and proprietary deal database. Outliers are excluded using IQR-based thresholds (Q3 + 1.5 &times; IQR).
            </div>
          </div>
        </div>

        <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6; padding-top: 10px; border-top: 1px solid ${COLORS.gray200};">
          Adjustment factors (development stage, territory scope, deal structure, competitive position) are computed deterministically from engine parameters and applied to each comparable for valuation bridging. AI-generated narratives are grounded in pre-computed quantitative data and cannot hallucinate financial figures.
        </div>
      </div>

      <!-- Disclaimer -->
      <div style="margin-top: 14px; padding: 10px 16px; background: ${COLORS.gray50}; border: 1px solid ${COLORS.gray200}; border-radius: 4px;">
        <div style="font-size: 7.5px; color: ${COLORS.gray400}; line-height: 1.65;">
          This comparable transaction analysis is prepared by Ambrosia Ventures for informational purposes only. Deal benchmarks are based on publicly available data and proprietary models. Actual transaction terms are influenced by asset-specific clinical, regulatory, and commercial factors not fully captured in this analysis. This document does not constitute financial, legal, or investment advice.
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}

function buildFallbackSynthesis(data: CompReportData): string {
  const { benchmarkRange, inputs } = data;
  const phaseLabel = getLabel(inputs.phase, phaseLabels);
  const modalityLabel = getLabel(inputs.modality, modalityLabels);
  return `Based on ${benchmarkRange.compCount} comparable transactions identified in the ${getLabel(inputs.therapeuticArea, { oncology: 'oncology', neurology: 'neurology', immunology: 'immunology' } as Record<string, string>)} space, ${phaseLabel.toLowerCase()} ${modalityLabel.toLowerCase()} assets have transacted at a median total deal value of ${formatUsd(benchmarkRange.totalDealValue.median)}, with upfront payments representing approximately ${Math.round(benchmarkRange.upfrontPctOfTDV)}% of total deal value.\n\nThe interquartile range spans ${formatUsd(benchmarkRange.totalDealValue.p25)} to ${formatUsd(benchmarkRange.totalDealValue.p75)}, reflecting meaningful variability driven by data maturity, competitive positioning, and territory scope.`;
}

function buildKeyConsiderations(data: CompReportData): string[] {
  const considerations: string[] = [];
  const { inputs, benchmarkRange } = data;

  if (inputs.competitivePosition === 'racing' || inputs.competitivePosition === 'crowded') {
    considerations.push('Competitive positioning in a crowded space may compress upfront premiums relative to first-in-class comparables.');
  }
  if (inputs.competitivePosition === 'firstInClass') {
    considerations.push('First-in-class positioning typically commands premium deal terms, particularly in upfront and milestone structures.');
  }
  if (inputs.competitivePosition === 'fastFollower') {
    considerations.push('Fast-follower positioning requires differentiation on efficacy or safety profile to justify premium valuation over lead programs.');
  }

  if (benchmarkRange.compCount < 6) {
    considerations.push('Limited comparable set size increases uncertainty in benchmark ranges; directional guidance only.');
  }

  if (inputs.territory === 'global') {
    considerations.push('Global rights transactions command premium valuations versus regional deals. Territory scope is a key value driver.');
  }

  if (inputs.phase === 'phase1' || inputs.phase === 'preclinical') {
    considerations.push('Early-stage assets carry higher development risk, reflected in milestone-weighted deal structures and lower upfront percentages.');
  }

  if (inputs.phase === 'phase2') {
    considerations.push('Phase 2 completion with positive data de-risks the asset significantly, supporting stronger upfront components and higher total deal values.');
  }

  return considerations.slice(0, 5);
}
