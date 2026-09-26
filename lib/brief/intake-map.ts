/**
 * Intake → engine mapping for the Deal Intelligence Brief.
 *
 * The wizard stores human labels ("Neurology", "Phase 2", "mAb", "Alzheimer's
 * Disease"). The engine wants keys ('neurology', 'phase2', 'mab', 'alzheimers').
 * Everything here is deterministic and tolerant of free text; when a value
 * cannot be resolved we fall back to the therapeutic-area default and say so
 * in `notes` so the generate route can log it and the MP can correct it.
 */

import type { CalculationInput, TherapeuticArea, Phase, Modality, DealType } from '@/lib/calculations';
import { INDICATION_REGISTRY } from '@/lib/benchmarkPagesIndication';
import type { AssetProfile } from './types';

export interface BenchmarkRequestRow {
  id: string;
  name?: string | null;
  company?: string | null;
  therapeutic_area: string;
  indication: string;
  phase: string;
  territory?: string | null;
  modality?: string | null;          // wizard abbr (mAb, SM, ADC…) or engine key
  modalities?: string[] | null;      // legacy matrix selection
  deal_types?: string[] | null;
  target_deal_type?: string | null;
  asset_name?: string | null;
  mechanism?: string | null;
  target?: string | null;
  differentiation_notes?: string | null;
  data_package_stage?: string | null;
  custom_notes?: string | null;
  /** Migration 137: structure, territory and evidence answers from the adaptive intake. */
  structure_prefs?: Record<string, unknown> | null;
}

const ROUTE_KEYS = new Set(['iv', 'sc', 'oral', 'intrathecal', 'intravitreal', 'inhaled', 'topical', 'implantable', 'gene_therapy_vector', 'device_combo', 'autoinjector', 'intranasal']);
const yes = (v: unknown) => v === true || (typeof v === 'string' && /^(yes|true|y)$/i.test(v));

/** Engine inputs the adaptive intake can set: designations, biomarker, route, targets. */
export function engineInputsFromPrefs(prefs: Record<string, unknown> | null | undefined, target: string | null | undefined): Partial<CalculationInput> & { notes: string[] } {
  const p = prefs ?? {};
  const notes: string[] = [];
  const regulatoryDesignations = { breakthrough: yes(p.breakthrough), fastTrack: yes(p.fastTrack), orphan: yes(p.orphan), prime: yes(p.prime) };
  const designations = Object.entries(regulatoryDesignations).filter(([, v]) => v).map(([k]) => k);
  if (designations.length) notes.push(`Designations from intake: ${designations.join(', ')}.`);
  const biomarker: CalculationInput['biomarker'] = yes(p.biomarkerSelected) ? 'selected' : 'unselected';
  if (biomarker === 'selected') notes.push('Biomarker-selected population from intake.');
  const route = typeof p.route === 'string' && ROUTE_KEYS.has(p.route) ? (p.route as NonNullable<CalculationInput['deliveryRoute']>) : undefined;
  if (route) notes.push(`Route of administration from intake: ${route}.`);
  const molecularTargets = target && target.trim() ? target.split(/[,/;+]/).map(t => t.trim()).filter(Boolean).slice(0, 4) : undefined;
  return { regulatoryDesignations, biomarker, ...(route ? { deliveryRoute: route } : {}), ...(molecularTargets?.length ? { molecularTargets } : {}), notes };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const TA_KEYS: Record<string, TherapeuticArea> = {
  oncology: 'oncology', neurology: 'neurology', immunology: 'immunology', metabolic: 'metabolic',
  cardiovascular: 'cardiovascular', infectiousdisease: 'infectiousDisease', ophthalmology: 'ophthalmology',
  womenshealth: 'womensHealth', raredisease: 'rareDisease', hematology: 'hematology',
  dermatology: 'dermatology', gastroenterology: 'gastroenterology',
};

export function resolveTherapeuticArea(label: string): TherapeuticArea {
  return TA_KEYS[norm(label)] ?? 'oncology';
}

export const PHASE_KEYS: Record<string, Phase> = {
  discovery: 'discovery', preclinical: 'preclinical', phase1: 'phase1', phase12: 'phase1_2',
  phase2: 'phase2', phase23: 'phase2_3', phase3: 'phase3', ndafiled: 'nda_filed', nda: 'nda_filed',
  approved: 'approved', commercial: 'approved',
};

export function resolvePhase(label: string): Phase {
  return PHASE_KEYS[norm(label)] ?? 'phase2';
}

/** Wizard abbreviations and common names → engine modality keys. */
export const MODALITY_KEYS: Record<string, Modality> = {
  sm: 'smallMolecule', smallmolecule: 'smallMolecule',
  mab: 'mab', monoclonalantibody: 'mab', antibody: 'mab',
  adc: 'adc', antibodydrugconjugate: 'adc',
  bsab: 'bispecific', bispecific: 'bispecific',
  tsab: 'trispecificAntibody', trispecific: 'trispecificAntibody', trispecificantibody: 'trispecificAntibody',
  gt: 'geneTherapy', genetherapy: 'geneTherapy',
  rnai: 'rnai', rnainterference: 'rnai',
  pep: 'peptide', peptide: 'peptide',
  aso: 'aso', antisenseoligonucleotide: 'aso',
  bbb: 'bbbPlatform', bbbplatform: 'bbbPlatform',
  mrna: 'mrna',
  tau: 'tauTargeting', tautargeting: 'tauTargeting',
  sc: 'stemCell', stemcell: 'stemCell',
  celltherapy: 'cellTherapy', cart: 'carT_solid', tce: 'tCellEngager', tcellengager: 'tCellEngager',
  protac: 'protac', molecularglue: 'molecularGlue', radiopharmaceutical: 'radiopharmaceutical',
  vaccine: 'therapeuticVaccine', therapeuticvaccine: 'therapeuticVaccine', oncolyticvirus: 'oncolyticVirus',
  oligonucleotide: 'oligonucleotide',
};

export function resolveModality(value: string | null | undefined, fallback: Modality = 'mab'): Modality {
  if (!value) return fallback;
  const k = norm(value);
  if (MODALITY_KEYS[k]) return MODALITY_KEYS[k];
  // Already an engine key?
  const engineKeys = new Set(Object.values(MODALITY_KEYS));
  if (engineKeys.has(value as Modality)) return value as Modality;
  return fallback;
}

export const DEAL_TYPE_KEYS: Record<string, DealType> = {
  licensing: 'licensing', license: 'licensing', option: 'option', optiontolicense: 'option',
  codevelopment: 'codevelopment', collaboration: 'collaboration',
  maacquisition: 'acquisition', acquisition: 'acquisition', ma: 'acquisition', sale: 'acquisition',
  reformulation: 'reformulation',
};

export function resolveDealType(value: string | null | undefined): DealType {
  if (!value) return 'licensing';
  return DEAL_TYPE_KEYS[norm(value)] ?? 'licensing';
}

/**
 * Free-text indication → engine key. Exact key, exact label, then token
 * overlap against the registry restricted to the therapeutic area, then the
 * TA default. Returns the resolution path so the route can log it.
 */
export function resolveIndication(
  text: string,
  ta: TherapeuticArea,
): { key: string; label: string; how: 'key' | 'label' | 'fuzzy' | 'default' } {
  const n = norm(text);
  const inTa = INDICATION_REGISTRY.filter(d => d.ta === ta);
  const pool = inTa.length ? inTa : INDICATION_REGISTRY;

  const byKey = pool.find(d => norm(d.value) === n) ?? INDICATION_REGISTRY.find(d => norm(d.value) === n);
  if (byKey) return { key: byKey.value, label: byKey.label, how: 'key' };

  const byLabel = pool.find(d => norm(d.label) === n) ?? INDICATION_REGISTRY.find(d => norm(d.label) === n);
  if (byLabel) return { key: byLabel.value, label: byLabel.label, how: 'label' };

  // Token overlap: "alzheimer's disease" vs "Alzheimer's Disease" / "alzheimers"
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
  let best: { def: typeof pool[number]; score: number } | null = null;
  for (const d of pool) {
    const hay = `${d.label} ${d.value}`.toLowerCase();
    const hayNorm = norm(hay);
    let score = 0;
    for (const t of tokens) {
      if (hayNorm.includes(norm(t))) score += t.length;
    }
    if (n.length >= 4 && hayNorm.includes(n)) score += n.length * 2;
    if (score > 0 && (!best || score > best.score)) best = { def: d, score };
  }
  if (best && best.score >= 4) return { key: best.def.value, label: best.def.label, how: 'fuzzy' };

  const def = inTa[0] ?? INDICATION_REGISTRY[0];
  return { key: def.value, label: def.label, how: 'default' };
}

export interface ResolvedIntake {
  input: CalculationInput;
  asset: AssetProfile;
  labels: { phase: string; modality: string; indication: string };
  notes: string[];
}

/** Engine DataQuality bucket implied by phase when the client has not told us more. */
export function dataQualityForPhase(phase: Phase): CalculationInput['dataQuality'] {
  switch (phase) {
    case 'discovery':
    case 'preclinical': return 'limited';
    case 'phase1':
    case 'phase1_2': return 'promising';
    case 'phase2':
    case 'phase2_3': return 'strongPhase2';
    default: return 'pivotalReady';
  }
}

const PHASE_LABEL: Record<Phase, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase1: 'Phase 1', phase1_2: 'Phase 1/2',
  phase2: 'Phase 2', phase2_3: 'Phase 2/3', phase3: 'Phase 3', nda_filed: 'NDA/BLA filed', approved: 'Approved',
};

/** Build the engine input and the asset profile from a benchmark_requests row. */
export function resolveIntake(req: BenchmarkRequestRow, modalityLabels: Record<string, string>): ResolvedIntake {
  const notes: string[] = [];
  // Silent defaults are not allowed: every fallback is written to the build
  // notes so the operator sees it in admin_notes before the brief goes out.
  let ta = resolveTherapeuticArea(req.therapeutic_area);
  if (!TA_KEYS[norm(req.therapeutic_area)]) notes.push(`Therapeutic area "${req.therapeutic_area}" not recognised; defaulted to oncology. Confirm before delivery.`);
  // The indication decides the area. When the stated area disagrees with the
  // registry entry the indication resolves to (e.g. "Oncology" + "ALS"), the
  // comparable set, calibration and buyers would all be built in the wrong
  // area; the registry wins and the operator is told.
  const anyTaMatch = resolveIndication(req.indication, ta);
  const registryDef = anyTaMatch.how !== 'default' ? INDICATION_REGISTRY.find(d => d.value === anyTaMatch.key) : undefined;
  if (registryDef && registryDef.ta !== ta) {
    const exact = INDICATION_REGISTRY.filter(d => d.ta === ta).some(d => norm(d.label) === norm(req.indication) || norm(d.value) === norm(req.indication));
    if (!exact) {
      notes.push(`Therapeutic area "${req.therapeutic_area}" disagrees with the indication "${req.indication}" (${registryDef.label} is ${registryDef.ta}); the brief is built in ${registryDef.ta}. Confirm with the client.`);
      ta = registryDef.ta;
    }
  }
  const phase = resolvePhase(req.phase);
  if (!PHASE_KEYS[norm(req.phase)]) notes.push(`Phase "${req.phase}" not recognised; defaulted to Phase 2. Confirm before delivery.`);
  const modalitySource = req.modality || req.modalities?.[0] || null;
  const modality = resolveModality(modalitySource);
  if (!modalitySource) notes.push('No modality on the request; defaulted to monoclonal antibody. Confirm before delivery.');
  else if (!MODALITY_KEYS[norm(modalitySource)] && !new Set(Object.values(MODALITY_KEYS)).has(modalitySource as Modality)) notes.push(`Modality "${modalitySource}" not recognised; defaulted to monoclonal antibody. Confirm before delivery.`);
  const dealType = resolveDealType(req.target_deal_type || req.deal_types?.[0]);
  const ind = resolveIndication(req.indication, ta);
  if (ind.how === 'default') notes.push(`Indication "${req.indication}" not resolved; defaulted to ${ind.label}.`);
  if (ind.how === 'fuzzy') notes.push(`Indication "${req.indication}" matched to ${ind.label} by fuzzy match; confirm.`);
  const territory = (req.territory || 'global') as CalculationInput['territory'];

  const { notes: prefNotes, ...fromPrefs } = engineInputsFromPrefs(req.structure_prefs, req.target);
  notes.push(...prefNotes);
  const input = {
    therapeuticArea: ta,
    phase,
    dealType,
    modality,
    indication: ind.key,
    territory,
    competitivePosition: 'racing',
    dataQuality: dataQualityForPhase(phase),
    ...fromPrefs,
  } as unknown as CalculationInput;

  const asset: AssetProfile = {
    assetName: req.asset_name ?? null,
    company: req.company ?? null,
    mechanism: req.mechanism ?? null,
    target: req.target ?? null,
    modality,
    phase,
    indication: ind.key,
    indicationLabel: ind.label,
    therapeuticArea: ta,
    territory,
    targetDealType: dealType,
    differentiationNotes: req.differentiation_notes ?? req.custom_notes ?? null,
    dataPackageStage: req.data_package_stage ?? null,
  };

  return {
    input,
    asset,
    labels: { phase: PHASE_LABEL[phase], modality: modalityLabels[modality] ?? modality, indication: ind.label },
    notes,
  };
}
