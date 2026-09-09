/**
 * Single source of truth for the Asset Radar filter vocabulary.
 *
 * Every value here is the exact string stored in `clinical_assets`
 * (written by lib/ingestion/clinical-trials.ts and lib/radar/asset-universe.ts).
 * The UI, the mandate form, and the search parser must import from here —
 * the previous per-component copies used 'monoclonal_antibody',
 * 'radiopharmaceutical' and 'Phase 2' while the database holds 'antibody',
 * 'radiopharm' and 'phase_2', so those filters silently returned nothing.
 */

export interface VocabOption {
  value: string;
  label: string;
  /** Longer label for forms and detail views. */
  longLabel?: string;
}

export const RADAR_TA_OPTIONS: VocabOption[] = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'cardiovascular', label: 'Cardio', longLabel: 'Cardiovascular' },
  { value: 'rare_disease', label: 'Rare Disease' },
  { value: 'infectious_disease', label: 'Infectious', longLabel: 'Infectious Disease' },
  { value: 'ophthalmology', label: 'Ophtho', longLabel: 'Ophthalmology' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'dermatology', label: 'Derm', longLabel: 'Dermatology' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'gastroenterology', label: 'GI', longLabel: 'Gastroenterology & Hepatology' },
  { value: 'womens_health', label: "Women's", longLabel: "Women's Health" },
];

/** Values match lib/ingestion/clinical-trials.ts inferModality() output. */
export const RADAR_MODALITY_OPTIONS: VocabOption[] = [
  { value: 'small_molecule', label: 'Small Molecule' },
  { value: 'antibody', label: 'mAb', longLabel: 'Monoclonal Antibody' },
  { value: 'adc', label: 'ADC', longLabel: 'Antibody-Drug Conjugate' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'car_t', label: 'CAR-T' },
  { value: 'cell_therapy', label: 'Cell Therapy' },
  { value: 'gene_therapy', label: 'Gene Therapy' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'peptide', label: 'Peptide' },
  { value: 'oligonucleotide', label: 'Oligo', longLabel: 'Oligonucleotide' },
  { value: 'radiopharm', label: 'Radiopharma', longLabel: 'Radiopharmaceutical' },
  { value: 'vaccine', label: 'Vaccine' },
];

/** Values match the company_trials / clinical_assets phase slugs. Ordered by development stage. */
export const RADAR_PHASE_OPTIONS: VocabOption[] = [
  { value: 'early_phase_1', label: 'P1 Early', longLabel: 'Early Phase 1' },
  { value: 'phase_1', label: 'P1', longLabel: 'Phase 1' },
  { value: 'phase_1_2', label: 'P1/2', longLabel: 'Phase 1/2' },
  { value: 'phase_2', label: 'P2', longLabel: 'Phase 2' },
  { value: 'phase_2_3', label: 'P2/3', longLabel: 'Phase 2/3' },
  { value: 'phase_3', label: 'P3', longLabel: 'Phase 3' },
  { value: 'phase_4', label: 'P4', longLabel: 'Phase 4 / Approved' },
];

export const RADAR_PHASE_RANK: Record<string, number> = Object.fromEntries(
  RADAR_PHASE_OPTIONS.map((o, i) => [o.value, i + 1]),
);

export const RADAR_PARTNERSHIP_OPTIONS: VocabOption[] = [
  { value: 'unpartnered', label: 'Unpartnered' },
  { value: 'partially_partnered', label: 'Partial', longLabel: 'Partially Partnered' },
  { value: 'partnered', label: 'Partnered' },
];

/** Region slugs match lib/ingestion/company-geography.ts deriveRegion(). */
export const RADAR_REGION_OPTIONS: VocabOption[] = [
  { value: 'north_america', label: 'North America' },
  { value: 'europe', label: 'Europe' },
  { value: 'china', label: 'China' },
  { value: 'japan', label: 'Japan' },
  { value: 'south_korea', label: 'South Korea' },
  { value: 'israel', label: 'Israel' },
  { value: 'asia_pacific', label: 'Asia Pacific' },
  { value: 'middle_east', label: 'Middle East' },
  { value: 'latin_america', label: 'Latin America' },
  { value: 'africa', label: 'Africa' },
];

/** ISO 3166-1 alpha-2 codes for the originator's headquarters. Ordered by current asset count. */
export const RADAR_COUNTRY_OPTIONS: VocabOption[] = [
  { value: 'US', label: 'United States' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'KR', label: 'South Korea' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'DK', label: 'Denmark' },
  { value: 'BE', label: 'Belgium' },
  { value: 'IT', label: 'Italy' },
  { value: 'IE', label: 'Ireland' },
  { value: 'CA', label: 'Canada' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IL', label: 'Israel' },
  { value: 'IN', label: 'India' },
  { value: 'ES', label: 'Spain' },
  { value: 'AU', label: 'Australia' },
  { value: 'SE', label: 'Sweden' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'SG', label: 'Singapore' },
  { value: 'BR', label: 'Brazil' },
  { value: 'FI', label: 'Finland' },
  { value: 'NO', label: 'Norway' },
  { value: 'AT', label: 'Austria' },
];

const LABEL_INDEX: Record<string, string> = Object.fromEntries(
  [
    ...RADAR_TA_OPTIONS,
    ...RADAR_MODALITY_OPTIONS,
    ...RADAR_PHASE_OPTIONS,
    ...RADAR_PARTNERSHIP_OPTIONS,
    ...RADAR_REGION_OPTIONS,
    ...RADAR_COUNTRY_OPTIONS,
  ].map(o => [o.value, o.longLabel ?? o.label]),
);

/** Human label for any stored vocabulary value; falls back to Title Case of the slug. */
export function radarLabel(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return LABEL_INDEX[value] ?? value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function isRadarValue(list: VocabOption[], value: string | null | undefined): boolean {
  return !!value && list.some(o => o.value === value);
}
