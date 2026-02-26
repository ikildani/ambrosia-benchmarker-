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

  // Competitive position (matches CompetitivePosition type)
  const compRisk: Record<string, number> = { firstInClass: 20, firstToPivotal: 25, bestInClass: 30, racing: 50, behind: 60, crowded: 75 };
  factors.push({
    name: 'Competitive Position',
    impact: compRisk[inputs.competitivePosition] > 50 ? 'negative' : 'positive',
    weight: compRisk[inputs.competitivePosition] || 50,
    description: inputs.competitivePosition === 'firstInClass' ? 'First-in-class novelty reduces competitive risk.' : inputs.competitivePosition === 'crowded' ? 'Crowded competitive landscape increases execution risk.' : 'Competitive dynamics introduce moderate uncertainty.',
  });

  // Data quality (matches DataQuality type)
  const dataRisk: Record<string, number> = { pivotalReady: 10, strongPhase2: 20, promising: 40, mixed: 55, limited: 70 };
  factors.push({
    name: 'Data Quality',
    impact: dataRisk[inputs.dataQuality] > 50 ? 'negative' : 'positive',
    weight: dataRisk[inputs.dataQuality] || 40,
    description: `${inputs.dataQuality === 'pivotalReady' || inputs.dataQuality === 'strongPhase2' ? 'Strong supporting data' : inputs.dataQuality === 'limited' || inputs.dataQuality === 'mixed' ? 'Limited or mixed data package' : 'Promising data'} ${dataRisk[inputs.dataQuality] <= 30 ? 'reduces' : 'increases'} valuation uncertainty.`,
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

  // Therapeutic-area-specific risk factor (the 6th factor — unique per TA)
  const taFactor = getTherapeuticAreaRiskFactor(inputs);
  if (taFactor) factors.push(taFactor);

  return factors;
}

/** Returns a TA-specific risk factor tailored to the unique challenges of each therapeutic area */
function getTherapeuticAreaRiskFactor(inputs: PDFReportData['inputs']): RiskFactor | null {
  const ta = inputs.therapeuticArea;

  if (ta === 'oncology') {
    const isFirstLine = inputs.lineOfTherapy === '1L';
    const isCrowded = inputs.competitivePosition === 'crowded' || inputs.competitivePosition === 'racing';
    const weight = (isFirstLine ? 40 : 15) + (isCrowded ? 20 : 0);
    return {
      name: 'Oncology Trial Complexity',
      impact: weight > 50 ? 'negative' : weight > 30 ? 'neutral' : 'positive',
      weight,
      description: isFirstLine
        ? 'First-line oncology requires large Phase 3 trials with OS/PFS endpoints against SOC. Extended timelines (3-5 years) and $200M+ trial costs increase execution risk substantially.'
        : inputs.lineOfTherapy === '3L+'
        ? 'Later-line indications enable smaller, faster trials with accelerated approval pathways. Reduced development risk but smaller commercial opportunity.'
        : 'Second-line positioning balances trial feasibility with commercial opportunity. Well-defined patient populations and established endpoints reduce regulatory uncertainty.',
    };
  }

  if (ta === 'neurology') {
    const isDiseaseModifying = inputs.treatmentApproach === 'diseaseModifying';
    const isBBBChallenge = ['geneTherapy', 'aso', 'bbbPlatform', 'antibody'].includes(inputs.modality);
    const weight = (isDiseaseModifying ? 45 : 15) + (isBBBChallenge ? 20 : 0);
    return {
      name: 'CNS Delivery & Endpoint Risk',
      impact: weight > 50 ? 'negative' : weight > 30 ? 'neutral' : 'positive',
      weight,
      description: isDiseaseModifying
        ? 'Disease-modifying CNS endpoints require 18-36+ month trials with validated biomarkers. Blood-brain barrier delivery adds manufacturing complexity. Historically high failure rate (>99% in Alzheimer\'s) demands premium risk pricing.'
        : 'Symptomatic CNS endpoints are well-established with shorter trial timelines. Reduced BBB delivery concerns for small molecules. More predictable development path supports milestone-weighted deal structures.',
    };
  }

  if (ta === 'immunology') {
    const isCurative = inputs.immuneResetPotential === 'curativeIntent';
    const isBroadTarget = inputs.targetSpecificity === 'broadImmunosuppression';
    const weight = (isCurative ? 40 : 15) + (isBroadTarget ? 25 : 0);
    return {
      name: 'Immune Modulation Safety',
      impact: weight > 50 ? 'negative' : weight > 30 ? 'neutral' : 'positive',
      weight,
      description: isCurative
        ? 'Curative-intent immune reset (CAR-T, tolerance induction) carries significant CRS/ICANS and long-term immunosuppression risk. Requires extended safety monitoring and REMS programs. High reward potential offset by manufacturing and durability uncertainties.'
        : isBroadTarget
        ? 'Broad immunosuppression increases opportunistic infection and malignancy risk. Long-term safety data requirements extend development timelines. Partners demand larger safety databases before commercial milestones trigger.'
        : 'Targeted immune modulation with well-characterized safety profile. Established comparators (anti-TNF, anti-IL-6) provide clear development benchmarks. Standard regulatory pathway with predictable timelines.',
    };
  }

  if (ta === 'metabolic') {
    const isGLP1Space = ['glp1Agonist', 'dualIncretin', 'tripleIncretin'].includes(inputs.modality);
    const weight = isGLP1Space ? 65 : 30;
    return {
      name: 'Metabolic Competitive & CVOT Risk',
      impact: weight > 50 ? 'negative' : 'neutral',
      weight,
      description: isGLP1Space
        ? 'GLP-1/incretin space is dominated by Lilly (tirzepatide) and Novo (semaglutide) with massive commercial leads. New entrants face CVOT requirements ($500M+), intense formulary competition, and oral vs. injectable differentiation pressure. Bar for partnership interest is exceptionally high.'
        : 'Novel metabolic mechanism differentiates from the crowded GLP-1 landscape. Partners value orthogonal approaches (SGLT2i, amylin, microbiome) for combination potential and unique patient segments. CVOT may still be required for broad labeling.',
    };
  }

  if (ta === 'cardiovascular') {
    const isMACE = inputs.cvTrialEndpoint === 'maceEndpoint';
    const isMortality = inputs.cvOutcomeBenefit === 'mortalityReduction';
    const weight = (isMACE ? 35 : 15) + (isMortality ? 30 : 5);
    return {
      name: 'CV Outcome Trial Burden',
      impact: weight > 50 ? 'negative' : weight > 30 ? 'neutral' : 'positive',
      weight,
      description: isMACE
        ? 'MACE endpoint trials require 10,000+ patients over 3-5 years with $500M+ investment. FDA mandates CVOTs for novel CV mechanisms. While definitive outcomes data commands premium valuations, the trial investment creates significant execution and financing risk.'
        : 'Surrogate or functional endpoints enable faster, smaller trials. Accelerated approval pathways available for serious conditions with unmet need. However, payers increasingly demand outcomes data for premium pricing — post-marketing CVOT may be required.',
    };
  }

  if (ta === 'infectiousDisease') {
    const isNovelTarget = inputs.resistanceProfile === 'novelTarget';
    const isAcute = inputs.infectionChronicity === 'acute';
    const weight = (isAcute ? 35 : 10) + (isNovelTarget ? -10 : 15);
    const clampedWeight = Math.max(10, Math.min(80, weight));
    return {
      name: 'Market Access & Resistance Dynamics',
      impact: clampedWeight > 50 ? 'negative' : clampedWeight > 30 ? 'neutral' : 'positive',
      weight: clampedWeight,
      description: isNovelTarget
        ? 'Novel resistance target qualifies for pull incentives (PASTEUR Act, UK subscription model) and BARDA/CARB-X funding. Priority pathogen designation reduces development cost. Portfolio protection value attracts big pharma partners even for smaller market sizes.'
        : isAcute
        ? 'Acute infection treatments face a challenging commercial model — short courses with limited per-patient revenue. Generic competition is intense for established pathogen classes. Market size depends on unpredictable incidence rates and pandemic preparedness contracts.'
        : 'Chronic infection therapies (HBV, HIV) offer recurring revenue and large addressable markets. Functional cure approaches command the highest premiums. Established regulatory pathways with well-defined endpoints reduce development uncertainty.',
    };
  }

  if (ta === 'ophthalmology') {
    const isImplant = inputs.ocularDelivery === 'implant';
    const isOneTime = inputs.treatmentDurability === 'oneTime';
    const isAntiVEGF = inputs.modality === 'antiVegf';
    const weight = (isAntiVEGF ? 50 : 20) + (isImplant || isOneTime ? -15 : 10);
    const clampedWeight = Math.max(10, Math.min(80, weight));
    return {
      name: 'Ocular Delivery & Competition',
      impact: clampedWeight > 50 ? 'negative' : clampedWeight > 30 ? 'neutral' : 'positive',
      weight: clampedWeight,
      description: isAntiVEGF
        ? 'Anti-VEGF space faces intense competition from aflibercept, ranibizumab, and faricimab. Biosimilar pressure is accelerating. Differentiation through durability (fewer injections) is the primary value driver. Without clear superiority data, deal valuations are compressed.'
        : isImplant || isOneTime
        ? 'Sustained-release or gene therapy delivery dramatically reduces treatment burden — the top unmet need in retinal disease. These platforms command premium valuations (Luxturna: $850K per eye). Partners value the transformative patient experience narrative.'
        : 'Novel ocular mechanism with differentiation potential beyond anti-VEGF. Partners value platform approaches that address multiple retinal/anterior segment conditions. Delivery strategy and durability data are the key value drivers in deal negotiations.',
    };
  }

  if (ta === 'womensHealth') {
    const isPregnancy = inputs.whRegulatory === 'pregnancyComplexity';
    const isUnmet = inputs.whUnmetNeed === 'noApprovedTherapy';
    const weight = (isPregnancy ? 55 : 20) + (isUnmet ? -15 : 5);
    const clampedWeight = Math.max(10, Math.min(80, weight));
    return {
      name: 'Women\'s Health Regulatory & Market',
      impact: clampedWeight > 50 ? 'negative' : clampedWeight > 30 ? 'neutral' : 'positive',
      weight: clampedWeight,
      description: isPregnancy
        ? 'Pregnancy-related indications face stringent regulatory requirements including teratogenicity studies, REMS programs, and restricted distribution networks. Development timelines are 2-3 years longer than standard pathways. However, the high barrier to entry creates durable competitive moats for approved products.'
        : isUnmet
        ? 'No approved therapy creates breakthrough designation opportunity with accelerated review pathways. Women\'s health is experiencing a renaissance in partner interest — Myovant, Dare, ObsEva precedents show 25%+ deal premiums for first-to-market assets in underserved indications.'
        : 'Established therapeutic landscape with existing treatment options. Differentiation through improved safety, convenience (oral vs. injectable), or novel mechanism required. Generic/biosimilar pressure in mature categories limits pricing power.',
    };
  }

  return null;
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
      ${pageHeader(meta.currentPage, meta.pageCount, 'Risk Analysis')}

      <div class="section-title-lg">Risk Analysis & Probability-Weighted Value</div>

      <!-- Risk Hero: Gauge + Summary on navy -->
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 24px; background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 22px 28px; color: white; margin-bottom: 18px;">
        <div style="text-align: center; flex-shrink: 0;">
          <div class="chart-container" style="margin: 0;">${gaugeHtml}</div>
          <div style="font-size: 8px; color: rgba(255,255,255,0.35); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em;">Overall Risk Score</div>
        </div>
        <div style="display: flex; flex-direction: column; justify-content: center;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.7; margin-bottom: 14px;">
            This deal carries a risk score of <strong style="color: #fff;">${riskScore}/100</strong>, implying
            an estimated <strong style="color: ${COLORS.tealMid};">${successProb}%</strong> probability of achieving projected deal economics.
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; padding: 10px 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 800; color: ${COLORS.tealMid};">${formatUsd(riskAdjustedLow)}</div>
              <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-top: 3px;">Risk-Adj Low</div>
            </div>
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; padding: 10px 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 800; color: #fff;">${formatUsd(riskAdjustedMedian)}</div>
              <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-top: 3px;">Risk-Adj Median</div>
            </div>
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; padding: 10px 12px; text-align: center;">
              <div style="font-size: 18px; font-weight: 800; color: ${COLORS.tealMid};">${formatUsd(riskAdjustedHigh)}</div>
              <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-top: 3px;">Risk-Adj High</div>
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
                <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 2px;">${f.weight}/100</div>
              </td>
              <td style="font-size: 10px; color: ${COLORS.gray500}; line-height: 1.5;">${escapeHtml(f.description)}</td>
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
