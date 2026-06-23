/**
 * Canonical modality display map.
 * Single source of truth for converting raw modality keys to display names.
 * Import `formatModality` from this file instead of defining local maps.
 */
export const MODALITY_DISPLAY: Record<string, string> = {
  smallMolecule: 'Small Molecule',
  small_molecule: 'Small Molecule',
  mab: 'mAb',
  monoclonal_antibody: 'mAb',
  monoclonalAntibody: 'mAb',
  antibody: 'mAb',
  adc: 'ADC',
  bispecific: 'Bispecific',
  bispecific_antibody: 'Bispecific',
  car_t: 'CAR-T',
  carT_heme: 'CAR-T',
  carT_solid: 'CAR-T',
  cellTherapy: 'Cell Therapy',
  cell_therapy: 'Cell Therapy',
  geneTherapy: 'Gene Therapy',
  gene_therapy: 'Gene Therapy',
  geneTherapyRare: 'Gene Therapy',
  mrna: 'mRNA',
  rnai: 'RNAi',
  sirna: 'RNAi',
  aso: 'ASO',
  antisense_oligonucleotide: 'ASO',
  oligonucleotide: 'ASO',
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharm',
  radiopharm: 'Radiopharm',
  protein_degrader: 'PROTAC',
  protac: 'PROTAC',
  gene_editing: 'Gene Editing',
  geneEditing: 'Gene Editing',
  oncolytic_virus: 'Oncolytic Virus',
  oncolyticVirus: 'Oncolytic Virus',
  antibody_fragment: 'Ab Fragment',
  vaccine: 'Vaccine',
  therapeuticVaccine: 'Vaccine',
  other: 'Other',
  adc_her2: 'ADC (HER2)',
  adc_trop2: 'ADC (TROP2)',
  adc_claudin18_2: 'ADC (Claudin 18.2)',
  topicalOphthalmic: 'Topical Ophthalmic',
  antiviral: 'Antiviral',
  allosteric_inhibitor: 'Allosteric Inhibitor',
  antibioticNovel: 'Novel Antibiotic',
  vaccinePreventive: 'Preventive Vaccine',
  geneTherapyOcular: 'Ocular Gene Therapy',
  intravitreal: 'Intravitreal',
  antiVegf: 'Anti-VEGF',
  carT_allogeneic: 'Allogeneic CAR-T',
  carT_autoimmune: 'Autoimmune CAR-T',
  covalent_inhibitor: 'Covalent Inhibitor',
  crispr_base_editing: 'CRISPR Base Editing',
  inVivoCarT: 'In Vivo CAR-T',
  bbb_platform: 'BBB Platform',
  glp1Agonist: 'GLP-1 Agonist',
  dualIncretin: 'Dual Incretin',
  tripleIncretin: 'Triple Incretin',
  amylinAnalog: 'Amylin Analog',
  jakInhibitor: 'JAK Inhibitor',
  jakInhibitorDerm: 'JAK Inhibitor',
  tl1aInhibitor: 'Anti-TL1A',
  s1pModulator: 'S1P Modulator',
  fcrnAntagonist: 'FcRn Antagonist',
  complementInhibitor: 'Complement Inhibitor',
};

/**
 * Convert a raw modality key to its canonical display name.
 * Handles null/undefined, camelCase keys, snake_case keys, and unknown modalities.
 */
export function formatModality(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  if (MODALITY_DISPLAY[raw]) return MODALITY_DISPLAY[raw];
  if (MODALITY_DISPLAY[raw.toLowerCase()]) return MODALITY_DISPLAY[raw.toLowerCase()];
  // Fallback: split on underscores AND camelCase boundaries, then title-case
  return raw
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
