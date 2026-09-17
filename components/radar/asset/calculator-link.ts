/**
 * Deep link from a Radar asset into the calculator with prefilled inputs.
 *
 * components/Calculator.tsx reads ?therapeuticArea=&phase=&modality=&indication=&dealType=
 * from the URL on mount (calculator vocabulary, camelCase). Radar stores the
 * database vocabulary (lib/radar/vocab.ts), so map here; anything unmapped is
 * omitted rather than guessed.
 */

const TA_MAP: Record<string, string> = {
  oncology: 'oncology',
  neurology: 'neurology',
  immunology: 'immunology',
  metabolic: 'metabolic',
  cardiovascular: 'cardiovascular',
  infectious_disease: 'infectiousDisease',
  ophthalmology: 'ophthalmology',
  womens_health: 'womensHealth',
  rare_disease: 'rareDisease',
  hematology: 'hematology',
  dermatology: 'dermatology',
  gastroenterology: 'gastroenterology',
};

const PHASE_MAP: Record<string, string> = {
  early_phase_1: 'phase1',
  phase_1: 'phase1',
  phase_1_2: 'phase1_2',
  phase_2: 'phase2',
  phase_2_3: 'phase2_3',
  phase_3: 'phase3',
  phase_4: 'approved',
  approved: 'approved',
  preclinical: 'preclinical',
  discovery: 'discovery',
  nda_filed: 'nda_filed',
  bla_filed: 'nda_filed',
};

const MODALITY_MAP: Record<string, string> = {
  small_molecule: 'smallMolecule',
  antibody: 'mab',
  adc: 'adc',
  bispecific: 'bispecific',
  car_t: 'carT_heme',
  cell_therapy: 'cellTherapy',
  gene_therapy: 'geneTherapy',
  mrna: 'mrna',
  peptide: 'peptide',
  oligonucleotide: 'oligonucleotide',
  radiopharm: 'radiopharmaceutical',
  vaccine: 'therapeuticVaccine',
};

export interface CalculatorPrefill {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  indication?: string;
  dealType: 'licensing';
}

export function calculatorPrefill(asset: {
  therapeutic_area: string | null;
  phase: string | null;
  modality: string | null;
  indication_specific?: string | null;
  indication_category?: string | null;
}): CalculatorPrefill {
  const out: CalculatorPrefill = { dealType: 'licensing' };
  const ta = asset.therapeutic_area ? TA_MAP[asset.therapeutic_area] : undefined;
  const phase = asset.phase ? PHASE_MAP[asset.phase] : undefined;
  const modality = asset.modality ? MODALITY_MAP[asset.modality] : undefined;
  if (ta) out.therapeuticArea = ta;
  if (phase) out.phase = phase;
  if (modality) out.modality = modality;
  const indication = asset.indication_specific || asset.indication_category;
  if (indication) out.indication = indication;
  return out;
}

/** `/calculator?...` — the Calculator applies the params and runs immediately. */
export function calculatorHref(asset: Parameters<typeof calculatorPrefill>[0]): string {
  const prefill = calculatorPrefill(asset);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(prefill)) if (v) params.set(k, v);
  return `/calculator?${params.toString()}`;
}
