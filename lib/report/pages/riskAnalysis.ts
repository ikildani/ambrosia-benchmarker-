// Page: Risk Analysis — Dedicated risk breakdown with gauge, factors, probability-weighted value

import { renderRiskGauge } from '../svg-charts/riskGauge';
import { formatUsd, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

interface RiskFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-100
  description: string;
}

function getRiskFactors(data: PDFReportData): RiskFactor[] {
  const { inputs, result } = data;
  const factors: RiskFactor[] = [];

  // Phase risk
  const phaseRisk: Record<string, number> = { preclinical: 85, phase1: 70, phase2: 50, phase3: 25, approved: 10 };
  factors.push({
    name: 'Development Phase',
    impact: phaseRisk[inputs.phase] > 50 ? 'negative' : 'positive',
    weight: phaseRisk[inputs.phase] || 50,
    description: `${inputs.phase === 'preclinical' ? 'Preclinical assets' : inputs.phase === 'approved' ? 'Approved products' : `${inputs.phase} candidates`} carry ${phaseRisk[inputs.phase] > 50 ? 'higher' : 'lower'} clinical risk.`,
  });

  // Competitive position
  const compRisk: Record<string, number> = { firstInClass: 20, bestInClass: 30, fastFollower: 50, crowdedField: 75 };
  factors.push({
    name: 'Competitive Position',
    impact: compRisk[inputs.competitivePosition] > 50 ? 'negative' : 'positive',
    weight: compRisk[inputs.competitivePosition] || 50,
    description: inputs.competitivePosition === 'firstInClass' ? 'First-in-class novelty reduces competitive risk.' : inputs.competitivePosition === 'crowdedField' ? 'Crowded competitive landscape increases execution risk.' : 'Competitive dynamics introduce moderate uncertainty.',
  });

  // Data quality
  const dataRisk: Record<string, number> = { strong: 15, moderate: 40, limited: 65 };
  factors.push({
    name: 'Data Quality',
    impact: dataRisk[inputs.dataQuality] > 50 ? 'negative' : 'positive',
    weight: dataRisk[inputs.dataQuality] || 40,
    description: `${inputs.dataQuality === 'strong' ? 'Strong supporting data' : inputs.dataQuality === 'limited' ? 'Limited data package' : 'Moderate data'} ${inputs.dataQuality === 'strong' ? 'reduces' : 'increases'} valuation uncertainty.`,
  });

  // Modality risk
  const higherRiskModalities = ['cellTherapy', 'geneTherapy', 'rnai', 'mrna'];
  const isHighRiskModality = higherRiskModalities.includes(inputs.modality);
  factors.push({
    name: 'Modality Risk',
    impact: isHighRiskModality ? 'negative' : 'neutral',
    weight: isHighRiskModality ? 60 : 30,
    description: isHighRiskModality ? 'Novel modality carries manufacturing and regulatory complexity.' : 'Established modality with well-understood risk profile.',
  });

  // Deal value as proxy for deal structure risk
  const totalValue = result.terms.totalDealValue.median;
  factors.push({
    name: 'Deal Magnitude',
    impact: totalValue > 2000 ? 'negative' : 'neutral',
    weight: totalValue > 2000 ? 55 : 25,
    description: totalValue > 2000 ? 'Large deal value ($2B+) implies concentrated risk and execution complexity.' : 'Deal magnitude within typical range for the therapeutic area.',
  });

  return factors;
}

export function renderRiskAnalysisPage(data: PDFReportData, meta: ReportMeta): string {
  const { riskScore, result } = data;
  const factors = getRiskFactors(data);
  const gaugeHtml = renderRiskGauge(riskScore, 140);

  // Probability-weighted deal value
  const successProb = Math.max(5, Math.min(95, 100 - riskScore));
  const riskAdjustedLow = result.terms.totalDealValue.low * (successProb / 100);
  const riskAdjustedMedian = result.terms.totalDealValue.median * (successProb / 100);
  const riskAdjustedHigh = result.terms.totalDealValue.high * (successProb / 100);

  return `
    <div class="report-page">
      ${pageHeader(meta.pageCount - 2, meta.pageCount, 'Risk Analysis')}

      <div class="section-title">RISK ASSESSMENT</div>
      <div class="section-title-lg">Risk Analysis & Probability-Weighted Value</div>

      <!-- Risk Gauge + Summary -->
      <div style="display: flex; gap: 24px; margin-bottom: 20px;">
        <div style="text-align: center; flex-shrink: 0;">
          <div class="chart-container" style="margin: 0;">${gaugeHtml}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 4px;">Overall Risk Score</div>
        </div>
        <div style="flex: 1;">
          <div class="callout" style="margin-bottom: 12px;">
            <strong>Risk Assessment Summary:</strong> This deal carries a risk score of ${riskScore}/100, implying
            an estimated ${successProb}% probability of achieving projected deal economics.
            Risk-adjusted total deal value ranges from ${formatUsd(riskAdjustedLow)} to ${formatUsd(riskAdjustedHigh)}.
          </div>

          <!-- Risk-adjusted KPIs -->
          <div class="grid-3">
            <div class="kpi-card">
              <div class="kpi-value" style="font-size: 18px;">${formatUsd(riskAdjustedLow)}</div>
              <div class="kpi-label">Risk-Adj Low</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value" style="font-size: 18px;">${formatUsd(riskAdjustedMedian)}</div>
              <div class="kpi-label">Risk-Adj Median</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-value" style="font-size: 18px;">${formatUsd(riskAdjustedHigh)}</div>
              <div class="kpi-label">Risk-Adj High</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Risk Factors Table -->
      <div class="section-title" style="margin-top: 20px;">RISK FACTOR BREAKDOWN</div>
      <table class="data-table" style="margin-top: 8px;">
        <thead>
          <tr>
            <th style="width: 20%;">Factor</th>
            <th style="width: 10%;">Impact</th>
            <th style="width: 15%;">Risk Level</th>
            <th style="width: 55%;">Assessment</th>
          </tr>
        </thead>
        <tbody>
          ${factors.map(f => `
            <tr>
              <td style="font-weight: 600; color: ${COLORS.navy};">${escapeHtml(f.name)}</td>
              <td>
                <span class="badge ${f.impact === 'positive' ? 'badge-teal' : f.impact === 'negative' ? 'badge-rose' : 'badge-gray'}">
                  ${f.impact === 'positive' ? 'LOW' : f.impact === 'negative' ? 'HIGH' : 'MOD'}
                </span>
              </td>
              <td>
                <div class="score-bar" style="width: 100%;">
                  <div class="score-bar-fill" style="width: ${f.weight}%; background: ${f.weight > 60 ? COLORS.rose : f.weight > 40 ? COLORS.amber : COLORS.green};"></div>
                </div>
                <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">${f.weight}/100</div>
              </td>
              <td style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">${escapeHtml(f.description)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Disclaimer -->
      <div class="callout-amber" style="margin-top: 20px;">
        <strong>Note:</strong> Risk-adjusted values use simplified probability weighting and are
        directional estimates only. Actual probability of technical and regulatory success should be
        assessed through detailed due diligence with domain experts.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
