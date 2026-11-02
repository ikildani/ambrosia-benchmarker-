import { isPlaceholderProgramName } from '@/lib/ingestion/preclinical-pipeline';

describe('isPlaceholderProgramName', () => {
  it.each([
    'Undisclosed Program',
    'Multiple ADC/T-Cell Engager programs',
    'Multiple Discovery and Preclinical-Stage Programs Across Therapeutic Areas',
    'Other CNS Discovery Programs',
    '2026 ADHD program',
    "2027 Women's Health program",
    'Urology program',
    'Infectious Diseases program',
    'CNS / Epilepsy program',
    'Discovery program 1 (inflammation)',
    'Autoimmune disorder target discovery program',
    'Additional undisclosed oncology target program',
    'Candidate Product Discovery and Translational Biology Program',
    'Roche collaboration programs',
    'AbbVie Discovery Collaboration Targets',
    'MSD preclinical vaccine candidates (undisclosed)',
    'MUCOSA INNOVATIONS R&D pipeline',
    'Curadigm Nanoprimer platform',
    'In vivo TCR-T engineering platform for solid tumors',
    'Early-stage small-molecule programs Undisclosed',
    'Additional ion channel modulators for pain',
    'Researchers',
    '',
  ])('treats %p as a bucket', name => {
    expect(isPlaceholderProgramName(name)).toBe(true);
  });

  it.each([
    'KRAS preclinical program',
    'pan-KRAS degrader program',
    'NLRP3 siRNA program',
    'SYNGAP1 syndrome discovery program',
    'Undisclosed molecule (TBI)',
    'HFG1',
    'IDP-012',
    'BD18',
    'AN-018',
    'Surgical ureter visualization fluorescent agent program',
    'Filovirus vaccine program',
    'pembrolizumab',
    'BiSKIT platform lead candidate',
    'Next Generation Telomerase Inhibitor Discovery',
    "Crohn's disease target discovery collaboration",
    'Genmab ISAC collaboration program',
    'Precision ADC Program (SMARCA degrader payloads with AbCellera)',
  ])('keeps %p', name => {
    expect(isPlaceholderProgramName(name)).toBe(false);
  });
});
