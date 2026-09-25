/**
 * Diligence readiness — what a buyer's diligence team will ask for.
 *
 * Curated static checklist by phase bucket (preclinical / phase_1 / phase_2 /
 * phase_3) and modality family (small molecule / biologic / cell & gene / RNA
 * / device & other). Items are written the way a pharma diligence lead writes
 * a request list. `expectedAtPhase` marks what a buyer will expect to see at
 * the asset's phase; items expected only later are listed so the client can
 * see what is coming.
 */

import type { AssetProfile, DiligenceChecklist, DiligenceItem } from './types';

type PhaseBucket = 'preclinical' | 'phase_1' | 'phase_2' | 'phase_3';
type Family = 'small_molecule' | 'biologic' | 'cell_gene' | 'rna' | 'device_other';

const PHASE_ORDER: PhaseBucket[] = ['preclinical', 'phase_1', 'phase_2', 'phase_3'];

export const AREAS = [
  'Chemistry & CMC',
  'Nonclinical',
  'Clinical',
  'Regulatory',
  'IP & FTO',
  'Commercial',
  'Corporate & contracts',
] as const;
type Area = typeof AREAS[number];

interface Template {
  area: Area;
  item: string;
  /** First phase bucket at which a buyer expects this. */
  from: PhaseBucket;
  /** Restrict to modality families; omitted = all. */
  families?: Family[];
  /** Only list once the asset is at or past this phase (keeps early lists short). */
  showFrom?: PhaseBucket;
}

const T: Template[] = [
  // Chemistry & CMC — common
  { area: 'Chemistry & CMC', item: 'Batch records and certificates of analysis for every lot used in pivotal nonclinical and clinical studies', from: 'phase_1' },
  { area: 'Chemistry & CMC', item: 'Analytical method validation summary and specification justification', from: 'phase_2' },
  { area: 'Chemistry & CMC', item: 'Stability data supporting the claimed shelf life at the proposed storage condition', from: 'phase_1' },
  { area: 'Chemistry & CMC', item: 'CMO agreements, tech-transfer status and capacity commitment for Phase 3 and launch supply', from: 'phase_2' },
  { area: 'Chemistry & CMC', item: 'Cost-of-goods estimate at commercial scale with the assumptions behind it', from: 'phase_2' },
  // Chemistry & CMC — by family
  { area: 'Chemistry & CMC', item: 'Route of synthesis, impurity profile and genotoxic impurity assessment; polymorph and salt screen', from: 'preclinical', families: ['small_molecule'] },
  { area: 'Chemistry & CMC', item: 'Clinical formulation and bioavailability data; bridging plan to the commercial formulation', from: 'phase_1', families: ['small_molecule'] },
  { area: 'Chemistry & CMC', item: 'Cell line history, clone selection and research cell bank / master cell bank characterisation', from: 'preclinical', families: ['biologic'] },
  { area: 'Chemistry & CMC', item: 'Product quality attributes: aggregation, charge variants, glycosylation and their link to potency', from: 'phase_1', families: ['biologic'] },
  { area: 'Chemistry & CMC', item: 'Vector or cell manufacturing process, comparability between process versions, and potency assay status', from: 'preclinical', families: ['cell_gene'] },
  { area: 'Chemistry & CMC', item: 'Vein-to-vein or vector-lot release timelines, failure rates and plan for closed / automated manufacturing', from: 'phase_1', families: ['cell_gene'] },
  { area: 'Chemistry & CMC', item: 'Oligonucleotide synthesis scale, purity by sequence variant, and delivery vehicle (LNP / conjugate) supply chain', from: 'preclinical', families: ['rna'] },
  { area: 'Chemistry & CMC', item: 'Lipid or conjugate IP and supply agreements for the delivery system', from: 'phase_1', families: ['rna'] },
  { area: 'Chemistry & CMC', item: 'Design history file, design controls and manufacturing quality system status', from: 'preclinical', families: ['device_other'] },

  // Nonclinical
  { area: 'Nonclinical', item: 'In vivo efficacy in at least one disease-relevant model with dose-response and exposure data', from: 'preclinical' },
  { area: 'Nonclinical', item: 'Mechanism-of-action package: target engagement, selectivity panel and biomarker linkage to the clinical hypothesis', from: 'preclinical' },
  { area: 'Nonclinical', item: 'GLP toxicology in two species (one non-rodent) with NOAEL and safety margins to the proposed clinical dose', from: 'phase_1' },
  { area: 'Nonclinical', item: 'Safety pharmacology (cardiovascular, respiratory, CNS) and hERG or equivalent', from: 'phase_1', families: ['small_molecule', 'rna', 'device_other'] },
  { area: 'Nonclinical', item: 'ADME / DMPK: metabolic stability, CYP inhibition and induction, transporter liabilities, predicted human PK', from: 'preclinical', families: ['small_molecule'] },
  { area: 'Nonclinical', item: 'Tissue cross-reactivity, cytokine release assessment and immunogenicity risk assessment', from: 'phase_1', families: ['biologic'] },
  { area: 'Nonclinical', item: 'Biodistribution, shedding and germline transmission assessment; insertional or off-target editing analysis', from: 'phase_1', families: ['cell_gene'] },
  { area: 'Nonclinical', item: 'Off-target and hybridisation-dependent toxicity screen; class effects (thrombocytopenia, renal, hepatic)', from: 'phase_1', families: ['rna'] },
  { area: 'Nonclinical', item: 'Chronic toxicology and carcinogenicity assessment or waiver rationale', from: 'phase_3', showFrom: 'phase_2' },
  { area: 'Nonclinical', item: 'Reproductive and developmental toxicology package or justified deferral', from: 'phase_2', showFrom: 'phase_1' },

  // Clinical
  { area: 'Clinical', item: 'Clinical development plan with target product profile, indication sequencing and go / no-go criteria', from: 'preclinical' },
  { area: 'Clinical', item: 'Phase 1 SAD / MAD data: safety, PK, PD and any early signal, with the clinical study report or interim tables', from: 'phase_1' },
  { area: 'Clinical', item: 'Dose selection rationale for the next study, with exposure-response modelling', from: 'phase_1' },
  { area: 'Clinical', item: 'Phase 2 efficacy on the primary endpoint with confidence intervals, subgroups and responder analyses', from: 'phase_2' },
  { area: 'Clinical', item: 'Integrated safety summary: SAEs, discontinuations, deaths and lab abnormalities across all studies', from: 'phase_2' },
  { area: 'Clinical', item: 'Phase 3 protocol, statistical analysis plan, enrolment status and data monitoring committee charter', from: 'phase_3' },
  { area: 'Clinical', item: 'Investigator brochure, current edition, and full study listing on ClinicalTrials.gov with sponsor obligations', from: 'phase_1' },

  // Regulatory
  { area: 'Regulatory', item: 'Pre-IND or scientific advice meeting minutes and the agency’s written responses', from: 'preclinical' },
  { area: 'Regulatory', item: 'IND / CTA package, clearance letters and any clinical holds with resolution', from: 'phase_1' },
  { area: 'Regulatory', item: 'End-of-Phase-2 meeting outcome and agreed pivotal design, endpoints and population', from: 'phase_3', showFrom: 'phase_2' },
  { area: 'Regulatory', item: 'Designations held or applied for (orphan, fast track, breakthrough, RMAT, PRIME) with grant letters', from: 'phase_1' },
  { area: 'Regulatory', item: 'Paediatric plan status (PIP / PSP) and any agreed waivers or deferrals', from: 'phase_2' },
  { area: 'Regulatory', item: 'Ex-US regulatory strategy and any interactions with EMA, PMDA or NMPA', from: 'phase_2' },

  // IP & FTO
  { area: 'IP & FTO', item: 'Composition-of-matter patent family: filings, grants, expiry by territory and PTE / SPC eligibility', from: 'preclinical' },
  { area: 'IP & FTO', item: 'Freedom-to-operate opinion from outside counsel, dated within 12 months, covering target, modality and delivery', from: 'preclinical' },
  { area: 'IP & FTO', item: 'Chain of title: assignments from all inventors and institutions, with employment and consulting IP terms', from: 'preclinical' },
  { area: 'IP & FTO', item: 'In-licensed IP: licence terms, field, territory, diligence obligations, royalty stacking and sublicensing rights', from: 'preclinical' },
  { area: 'IP & FTO', item: 'Method-of-use, formulation and process filings that extend exclusivity beyond the primary family', from: 'phase_2' },
  { area: 'IP & FTO', item: 'Data exclusivity and orphan exclusivity analysis by territory as a floor under the patent estate', from: 'phase_2' },

  // Commercial
  { area: 'Commercial', item: 'Target product profile against current and expected standard of care, with the differentiation claim and its evidence', from: 'preclinical' },
  { area: 'Commercial', item: 'Competitive landscape by mechanism and phase, including expected readouts in the next 24 months', from: 'preclinical' },
  { area: 'Commercial', item: 'Epidemiology and patient funnel from prevalence to addressable population in the licensed territory', from: 'phase_1' },
  { area: 'Commercial', item: 'Pricing and reimbursement view: reference products, payer evidence requirements and expected net price', from: 'phase_2' },
  { area: 'Commercial', item: 'Peak sales model with share, price and uptake assumptions, reconciled to the buyer’s own forecast', from: 'phase_2' },
  { area: 'Commercial', item: 'Key opinion leader feedback on the profile, with names and dates', from: 'phase_1' },

  // Corporate & contracts
  { area: 'Corporate & contracts', item: 'Capitalisation table, financing history and any rights (ROFR, ROFN, anti-dilution) that touch the asset', from: 'preclinical' },
  { area: 'Corporate & contracts', item: 'Material agreements: research collaborations, CRO / CMO contracts, MTAs and any encumbrances on the asset', from: 'preclinical' },
  { area: 'Corporate & contracts', item: 'Grant and government funding terms, including march-in rights and manufacturing obligations', from: 'preclinical' },
  { area: 'Corporate & contracts', item: 'Litigation, disputes and regulatory inspection history (FDA 483s, warning letters)', from: 'phase_1' },
  { area: 'Corporate & contracts', item: 'Key-person and retention arrangements for the scientific team through transition', from: 'phase_1' },
  { area: 'Corporate & contracts', item: 'Data privacy and clinical data ownership: informed consent scope for secondary use and transfer', from: 'phase_1' },
];

export function phaseBucketOf(phase: string): PhaseBucket {
  const k = (phase || '').replace(/_/g, '').toLowerCase();
  if (k === 'phase1' || k === 'phase12') return 'phase_1';
  if (k === 'phase2' || k === 'phase23') return 'phase_2';
  if (k === 'phase3' || k === 'ndafiled' || k === 'nda' || k === 'approved') return 'phase_3';
  return 'preclinical';
}

export function modalityFamilyOf(modality: string): Family {
  const m = (modality || '').toLowerCase();
  if (/cell|car-?t|car-?nk|tcr|gene|aav|lentiv|crispr|edit|invivocar/.test(m)) return 'cell_gene';
  if (/rnai|sirna|mrna|aso|antisense|oligo|rna\b|saRNA|lnp/i.test(m)) return 'rna';
  if (/mab|antibody|bispecific|trispecific|adc|conjugate|fusion|biologic|protein|enzyme|fcrn|complement|cytokine|vaccine|tl1a|baff|april|dualantagonist/.test(m)) return 'biologic';
  if (/small|molecule|degrader|protac|glue|peptide|inhibitor|modulator|antagonist|agonist|jak|s1p|integrin|psychedelic|radiopharm/.test(m)) return 'small_molecule';
  if (/device|diagnostic|digital|platform|bbb/.test(m)) return 'device_other';
  return 'device_other';
}

function matches(item: string, needles: string[]): boolean {
  const it = item.toLowerCase();
  return needles.some(n => {
    const s = n.trim().toLowerCase();
    return s.length > 0 && (it.includes(s) || s.includes(it));
  });
}

export function buildDiligenceChecklist(asset: AssetProfile, opts?: { ready?: string[]; gaps?: string[] }): DiligenceChecklist {
  const bucket = phaseBucketOf(asset.phase);
  const family = modalityFamilyOf(asset.modality);
  const phaseIdx = PHASE_ORDER.indexOf(bucket);
  const ready = opts?.ready ?? [];
  const gaps = opts?.gaps ?? [];

  const items: DiligenceItem[] = [];
  for (const area of AREAS) {
    const forArea = T.filter(t => t.area === area)
      .filter(t => !t.families || t.families.includes(family))
      .filter(t => PHASE_ORDER.indexOf(t.showFrom ?? t.from) <= Math.min(phaseIdx + 1, PHASE_ORDER.length - 1) || PHASE_ORDER.indexOf(t.from) <= phaseIdx)
      .sort((a, b) => PHASE_ORDER.indexOf(a.from) - PHASE_ORDER.indexOf(b.from))
      .slice(0, 7);
    for (const t of forArea) {
      const expectedAtPhase = PHASE_ORDER.indexOf(t.from) <= phaseIdx;
      const status: DiligenceItem['status'] = matches(t.item, gaps) ? 'gap' : matches(t.item, ready) ? 'ready' : 'unknown';
      items.push({ area: t.area, item: t.item, expectedAtPhase, status });
    }
  }

  const expectedGaps = items.filter(i => i.expectedAtPhase && i.status === 'gap').map(i => i.item);
  const derivedGaps = expectedGaps.length > 0
    ? expectedGaps
    : items.filter(i => i.expectedAtPhase && i.status === 'unknown').slice(0, 5).map(i => `Confirm ${i.item.charAt(0).toLowerCase()}${i.item.slice(1)}`);

  return { phase: bucket, modality: family, items, gaps: derivedGaps };
}
