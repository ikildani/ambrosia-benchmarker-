import { getValidationWarnings } from '@/lib/validationWarnings';

/** Baseline non-contradictory input */
const validInput = {
  phase: 'phase3',
  dataQuality: 'pivotalReady',
  competitivePosition: 'racing',
  combinationPotential: 'moderate',
  biomarker: 'noBiomarker',
  modality: 'smallMolecule',
  territory: 'global',
};

describe('getValidationWarnings', () => {
  it('returns empty array for valid, non-contradictory inputs', () => {
    const warnings = getValidationWarnings(validInput);
    expect(warnings).toEqual([]);
  });

  it('detects approved + limited data quality', () => {
    const warnings = getValidationWarnings({ ...validInput, phase: 'approved', dataQuality: 'limited' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('approved-limited-data');
    expect(warnings[0].fields).toEqual(['phase', 'dataQuality']);
  });

  it('detects nda_filed + limited data quality', () => {
    const warnings = getValidationWarnings({ ...validInput, phase: 'nda_filed', dataQuality: 'limited' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('approved-limited-data');
    expect(warnings[0].fields).toEqual(['phase', 'dataQuality']);
  });

  it('detects discovery + pivotalReady data quality', () => {
    const warnings = getValidationWarnings({ ...validInput, phase: 'discovery', dataQuality: 'pivotalReady' });
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('preclinical-pivotal-data');
  });

  it('detects preclinical + pivotalReady data quality', () => {
    const warnings = getValidationWarnings({ ...validInput, phase: 'preclinical', dataQuality: 'pivotalReady' });
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('preclinical-pivotal-data');
  });

  it('detects phase1 + pivotalReady data quality', () => {
    const warnings = getValidationWarnings({ ...validInput, phase: 'phase1', dataQuality: 'pivotalReady' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('phase1-pivotal-data');
    expect(warnings[0].fields).toEqual(['phase', 'dataQuality']);
  });

  it('detects preclinical + firstToPivotal competitive position', () => {
    const warnings = getValidationWarnings({
      ...validInput,
      phase: 'preclinical',
      dataQuality: 'limited',
      competitivePosition: 'firstToPivotal',
    });
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('preclinical-first-pivotal');
    const warning = warnings.find((w) => w.id === 'preclinical-first-pivotal')!;
    expect(warning.fields).toEqual(['phase', 'competitivePosition']);
  });

  it('detects discovery + biomarkerSelected', () => {
    const warnings = getValidationWarnings({ ...validInput, phase: 'discovery', biomarker: 'biomarkerSelected' });
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('preclinical-biomarker-selected');
    const warning = warnings.find((w) => w.id === 'preclinical-biomarker-selected')!;
    expect(warning.fields).toEqual(['phase', 'biomarker']);
  });

  it('detects chinaOnly + geneTherapy', () => {
    const warnings = getValidationWarnings({ ...validInput, territory: 'chinaOnly', modality: 'geneTherapy' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('china-only-advanced-modality');
    expect(warnings[0].fields).toEqual(['territory', 'modality']);
  });

  it('detects chinaOnly + cellTherapy', () => {
    const warnings = getValidationWarnings({ ...validInput, territory: 'chinaOnly', modality: 'cellTherapy' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].id).toBe('china-only-advanced-modality');
    expect(warnings[0].fields).toEqual(['territory', 'modality']);
  });

  it('returns multiple warnings when multiple contradictions exist', () => {
    const warnings = getValidationWarnings({
      ...validInput,
      phase: 'preclinical',
      dataQuality: 'pivotalReady',
      competitivePosition: 'firstToPivotal',
      biomarker: 'biomarkerSelected',
      territory: 'chinaOnly',
      modality: 'geneTherapy',
    });
    const ids = warnings.map((w) => w.id);
    expect(ids).toContain('preclinical-pivotal-data');
    expect(ids).toContain('preclinical-first-pivotal');
    expect(ids).toContain('preclinical-biomarker-selected');
    expect(ids).toContain('china-only-advanced-modality');
    expect(warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('each warning has a non-empty fields array', () => {
    const warnings = getValidationWarnings({
      ...validInput,
      phase: 'discovery',
      dataQuality: 'pivotalReady',
      competitivePosition: 'firstToPivotal',
      biomarker: 'biomarkerSelected',
    });
    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning.fields.length).toBeGreaterThan(0);
      expect(warning.id).toBeTruthy();
      expect(warning.message).toBeTruthy();
    }
  });
});
