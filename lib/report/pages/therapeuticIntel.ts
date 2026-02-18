// Page 9: Therapeutic Area Intelligence
// TA-specific context, milestone allocation comparison, key considerations

import { pageHeader, pageFooter, COLORS, escapeHtml, phaseLabels, modalityLabels, getLabel, getTAColors } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderTherapeuticIntelPage(data: PDFReportData, meta: ReportMeta): string {
  const { inputs, result, sensitivityData } = data;
  const taColors = getTAColors(inputs.therapeuticArea);
  const phase = getLabel(inputs.phase, phaseLabels);
  const modality = result.labels.modality || getLabel(inputs.modality, modalityLabels);
  const indication = result.labels.indication || inputs.indication;

  // TA-specific market context
  const taContext: Record<string, string> = {
    oncology: `The oncology licensing market continues to be the most active therapeutic area for pharma BD, driven by precision medicine advances, ADC platform wars, and the emergence of radiopharmaceuticals. ${phase} ${modality} assets in ${indication} are attracting premium valuations given the unmet need and growing biosimilar competition for legacy therapies.`,
    neurology: `Neurology deal-making has entered a renaissance period, with record-breaking acquisitions in CNS driven by breakthrough modalities that overcome the blood-brain barrier. ${phase} ${modality} assets represent a particularly compelling profile given the historic difficulty of CNS drug development and the massive unmet need across neurological disorders.`,
    immunology: `Immunology and autoimmune disease has become the fastest-growing therapeutic area for licensing deals, fueled by the next generation of targeted therapies that offer disease modification over symptom management. ${phase} ${modality} assets in ${indication} align with industry priorities around more selective, safer mechanisms.`,
  };

  const context = taContext[inputs.therapeuticArea] || `${phase} ${modality} assets in ${indication} are positioned within a dynamic licensing landscape. Current market conditions favor well-differentiated assets with strong clinical data packages.`;

  // Milestone allocation comparison
  const milestoneComps: Record<string, { dev: string; reg: string; comm: string; upfront: string }> = {
    oncology: { upfront: '15-25%', dev: '20-30%', reg: '15-25%', comm: '25-40%' },
    neurology: { upfront: '20-35%', dev: '15-25%', reg: '15-20%', comm: '25-35%' },
    immunology: { upfront: '15-30%', dev: '20-30%', reg: '10-20%', comm: '25-40%' },
  };

  const taComp = milestoneComps[inputs.therapeuticArea] || milestoneComps.oncology;
  const terms = result.terms;
  const total = terms.totalDealValue.median || 1;
  const userAlloc = {
    upfront: ((terms.upfront.median / total) * 100).toFixed(0) + '%',
    dev: ((terms.devMilestones.median / total) * 100).toFixed(0) + '%',
    reg: ((terms.regMilestones.median / total) * 100).toFixed(0) + '%',
    comm: ((terms.commMilestones.median / total) * 100).toFixed(0) + '%',
  };

  const insights = sensitivityData.neurologyInsights || [];

  return `
    <div class="report-page">
      ${pageHeader(9, meta.pageCount, 'Deal Valuation Report')}

      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${taColors.primary};"></div>
        <div class="section-title-lg" style="margin-bottom: 0;">${escapeHtml(taColors.label)} Intelligence</div>
      </div>

      <!-- Market Context -->
      <div class="card" style="border-left: 3px solid ${taColors.primary}; margin-bottom: 16px;">
        <div style="font-size: 10px; font-weight: 600; color: ${taColors.primary}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">Market Context</div>
        <div style="font-size: 11px; color: ${COLORS.gray700}; line-height: 1.7;">${context}</div>
      </div>

      <!-- Milestone Allocation Comparison -->
      <div style="margin-bottom: 16px;">
        <div class="section-title">Milestone Allocation Benchmarks</div>
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th style="text-align: center;">${escapeHtml(taColors.label)} Typical</th>
                <th style="text-align: center;">Your Deal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 500;">Upfront</td>
                <td style="text-align: center;">${taComp.upfront}</td>
                <td style="text-align: center; font-weight: 600; color: ${COLORS.teal};">${userAlloc.upfront}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Development Milestones</td>
                <td style="text-align: center;">${taComp.dev}</td>
                <td style="text-align: center; font-weight: 600; color: ${COLORS.teal};">${userAlloc.dev}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Regulatory Milestones</td>
                <td style="text-align: center;">${taComp.reg}</td>
                <td style="text-align: center; font-weight: 600; color: ${COLORS.teal};">${userAlloc.reg}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Commercial Milestones</td>
                <td style="text-align: center;">${taComp.comm}</td>
                <td style="text-align: center; font-weight: 600; color: ${COLORS.teal};">${userAlloc.comm}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Key Considerations -->
      ${insights.length > 0 ? `
      <div>
        <div class="section-title">Key Considerations</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${insights.slice(0, 4).map(insight => {
            const impactCls: Record<string, string> = {
              'VERY HIGH': 'impact-very-high',
              'HIGH': 'impact-high',
              'MEDIUM': 'impact-medium',
              'LOW': 'impact-low',
            };
            return `
            <div class="card-sm">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(insight.title)}</span>
                <span class="badge ${impactCls[insight.impactLevel] || 'badge-gray'}">${insight.impactLevel}</span>
              </div>
              <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.5;">${escapeHtml(insight.description)}</div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Special callouts -->
      ${inputs.therapeuticArea === 'neurology' ? `
      <div class="callout" style="margin-top: 12px;">
        <strong>CNS Note:</strong> Blood-brain barrier penetration capabilities, disease modification potential, and biomarker validation status are critical value drivers in neurology licensing. Assets with demonstrated BBB engagement command significant premiums.
      </div>
      ` : ''}
      ${inputs.therapeuticArea === 'immunology' ? `
      <div class="callout" style="margin-top: 12px;">
        <strong>Autoimmune Note:</strong> The shift from chronic symptom management to immune reset/disease modification is redefining deal valuations. Assets offering curative-intent mechanisms (e.g., in vivo CAR-T, tolerizing therapies) attract transformative premiums.
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
