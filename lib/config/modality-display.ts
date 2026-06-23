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
  return (
    MODALITY_DISPLAY[raw] ||
    MODALITY_DISPLAY[raw.toLowerCase()] ||
    raw
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}
