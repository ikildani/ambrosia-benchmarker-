// Page 13: Therapeutic Area Intelligence
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
    metabolic: `Metabolic and obesity deal-making has exploded into one of pharma's most competitive arenas, with GLP-1 agonists, dual/triple incretins, and next-generation oral peptides commanding record-breaking valuations. ${phase} ${modality} assets in ${indication} are positioned in a market where differentiation beyond injectable semaglutide/tirzepatide — through oral delivery, muscle-sparing profiles, or MASH co-targeting — drives transformative deal premiums.`,
    cardiovascular: `Cardiovascular licensing is seeing renewed momentum driven by novel mechanisms targeting heart failure, lipid disorders, and thrombosis. ${phase} ${modality} assets in ${indication} benefit from large patient populations, well-defined regulatory pathways, and established commercial infrastructure at major pharma companies.`,
    infectiousDisease: `Infectious disease deal-making has shifted post-pandemic toward antivirals, antimicrobial resistance, and vaccine platforms. ${phase} ${modality} assets in ${indication} are positioned in a market where pandemic preparedness funding and pull incentives are expanding the economic case for novel anti-infective development.`,
    ophthalmology: `Ophthalmology continues to attract high-value licensing deals, driven by gene therapy for inherited retinal diseases, sustained-release implants, and next-generation anti-VEGF agents. ${phase} ${modality} assets in ${indication} benefit from clear clinical endpoints, shorter trial timelines, and strong commercial potential in a market dominated by high-cost biologics.`,
    womensHealth: `Women's health is emerging as a high-priority therapeutic area after years of underinvestment, with recent blockbuster approvals in menopause, endometriosis, and contraception driving renewed pharma interest. ${phase} ${modality} assets in ${indication} are positioned to benefit from growing advocacy, regulatory tailwinds, and an expanding commercial market.`,
  };

  const context = taContext[inputs.therapeuticArea] || `${phase} ${modality} assets in ${indication} are positioned within a dynamic licensing landscape. Current market conditions favor well-differentiated assets with strong clinical data packages.`;

  // Milestone allocation comparison
  const milestoneComps: Record<string, { dev: string; reg: string; comm: string; upfront: string }> = {
    oncology: { upfront: '15-25%', dev: '20-30%', reg: '15-25%', comm: '25-40%' },
    neurology: { upfront: '20-35%', dev: '15-25%', reg: '15-20%', comm: '25-35%' },
    immunology: { upfront: '15-30%', dev: '20-30%', reg: '10-20%', comm: '25-40%' },
    metabolic: { upfront: '20-35%', dev: '15-25%', reg: '10-20%', comm: '30-45%' },
    cardiovascular: { upfront: '15-25%', dev: '20-30%', reg: '15-20%', comm: '30-40%' },
    infectiousDisease: { upfront: '20-30%', dev: '20-30%', reg: '15-25%', comm: '20-35%' },
    ophthalmology: { upfront: '15-30%', dev: '15-25%', reg: '15-20%', comm: '30-40%' },
    womensHealth: { upfront: '20-30%', dev: '15-25%', reg: '15-20%', comm: '25-40%' },
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
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${taColors.primary};"></div>
        <div class="section-title-lg" style="margin-bottom: 0;">${escapeHtml(taColors.label)} Intelligence</div>
      </div>

      <!-- Market Context -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 20px 22px; color: white; margin-bottom: 18px; border-left: 4px solid ${taColors.primary};">
        <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 8px;">Market Context</div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.7); line-height: 1.7;">${context}</div>
      </div>

      <!-- Milestone Allocation Comparison -->
      <div style="margin-bottom: 18px;">
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
                <td style="text-align: center; font-weight: 700; color: ${COLORS.teal};">${userAlloc.upfront}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Development Milestones</td>
                <td style="text-align: center;">${taComp.dev}</td>
                <td style="text-align: center; font-weight: 700; color: ${COLORS.teal};">${userAlloc.dev}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Regulatory Milestones</td>
                <td style="text-align: center;">${taComp.reg}</td>
                <td style="text-align: center; font-weight: 700; color: ${COLORS.teal};">${userAlloc.reg}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Commercial Milestones</td>
                <td style="text-align: center;">${taComp.comm}</td>
                <td style="text-align: center; font-weight: 700; color: ${COLORS.teal};">${userAlloc.comm}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Key Considerations -->
      ${insights.length > 0 ? `
      <div style="margin-bottom: 10px;">
        <div class="section-title">Key Considerations</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${insights.slice(0, 4).map(insight => {
            const impactCls: Record<string, string> = {
              'VERY HIGH': 'impact-very-high',
              'HIGH': 'impact-high',
              'MEDIUM': 'impact-medium',
              'LOW': 'impact-low',
            };
            // Truncate long descriptions to prevent page overflow
            const desc = insight.description.length > 180 ? insight.description.substring(0, 177) + '...' : insight.description;
            return `
            <div class="card-sm" style="max-height: 90px; overflow: hidden;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 3px;">
                <span style="font-size: 10px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(insight.title)}</span>
                <span class="badge ${impactCls[insight.impactLevel] || 'badge-gray'}">${insight.impactLevel}</span>
              </div>
              <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.45;">${escapeHtml(desc)}</div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Special callouts -->
      ${inputs.therapeuticArea === 'neurology' ? `
      <div class="callout">
        <strong>CNS Note:</strong> Blood-brain barrier penetration capabilities, disease modification potential, and biomarker validation status are critical value drivers in neurology licensing. Assets with demonstrated BBB engagement command significant premiums.
      </div>
      ` : ''}
      ${inputs.therapeuticArea === 'immunology' ? `
      <div class="callout">
        <strong>Autoimmune Note:</strong> The shift from chronic symptom management to immune reset/disease modification is redefining deal valuations. Assets offering curative-intent mechanisms attract transformative premiums.
      </div>
      ` : ''}
      ${inputs.therapeuticArea === 'metabolic' ? `
      <div class="callout">
        <strong>Metabolic/Obesity Note:</strong> The obesity market is projected to exceed $100B by 2030. Differentiation is key — oral formulations, muscle-sparing profiles, and multi-receptor agonism (GLP-1/GIP/glucagon) command the highest premiums. MASH/NASH co-targeting adds significant optionality value.
      </div>
      ` : ''}
      ${inputs.therapeuticArea === 'cardiovascular' ? `
      <div class="callout">
        <strong>CV Note:</strong> Cardiovascular licensing benefits from large, well-characterized patient populations and established regulatory pathways. Novel mechanisms (PCSK9, siRNA-based lipid lowering, myosin activators) are commanding premium deal terms.
      </div>
      ` : ''}
      ${inputs.therapeuticArea === 'ophthalmology' ? `
      <div class="callout">
        <strong>Ophthalmology Note:</strong> Gene therapy for inherited retinal diseases and next-generation anti-VEGF/sustained-release platforms are driving the highest-value deals. Clear clinical endpoints and shorter trial timelines make this area attractive for licensing.
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
