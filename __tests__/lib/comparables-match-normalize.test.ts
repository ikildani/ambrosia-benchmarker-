/**
 * Tests for lib/comparables/match-normalize.ts
 *
 * Regression coverage for the comps-matching vocabulary bug: calculator inputs
 * ('phase2', 'smallMolecule', 'pancreatic', 'licensing') never matched DB rows
 * ('phase_2', 'small_molecule', 'Pancreatic cancer', 'license') under strict
 * equality, so comp sets degraded to "same TA + recent".
 */

import {
  phaseKey,
  phasesMatch,
  phaseDistance,
  modalityKey,
  modalityFamily,
  modalitiesMatch,
  dealTypeKey,
  dealTypesMatch,
  indicationTokens,
  indicationMatches,
} from '@/lib/comparables/match-normalize';

describe('comparables match-normalize', () => {
  describe('phase', () => {
    it('matches calculator phase2 to DB phase_2', () => {
      expect(phasesMatch('phase2', 'phase_2')).toBe(true);
      expect(phaseKey('phase2')).toBe('phase_2');
    });

    it('collapses phase1_2 to phase_2 like the rest of the codebase', () => {
      expect(phasesMatch('phase1_2', 'phase_2')).toBe(true);
    });

    it('never matches unknown phases', () => {
      expect(phasesMatch('unknown', 'unknown')).toBe(false);
      expect(phasesMatch('phase2', 'unknown')).toBe(false);
      expect(phasesMatch('phase2', null)).toBe(false);
    });

    it('computes ladder distance', () => {
      expect(phaseDistance('phase2', 'phase_2')).toBe(0);
      expect(phaseDistance('phase2', 'phase_1')).toBe(1);
      expect(phaseDistance('phase2', 'approved')).toBe(2);
      expect(phaseDistance('phase2', 'unknown')).toBeNull();
    });
  });

  describe('modality', () => {
    it('matches smallMolecule to small_molecule', () => {
      expect(modalitiesMatch('smallMolecule', 'small_molecule')).toBe(true);
      expect(modalityKey('small_molecule')).toBe('smallmolecule');
    });

    it('matches mab to antibody', () => {
      expect(modalitiesMatch('mab', 'antibody')).toBe(true);
    });

    it('rolls ADC sub-types up to the ADC family', () => {
      expect(modalityFamily('adc_her2')).toBe('adc');
      expect(modalitiesMatch('adc', 'adc_her2')).toBe(true);
      expect(modalitiesMatch('adc', 'adc_trop2')).toBe(true);
    });

    it('matches CAR-T spellings', () => {
      expect(modalitiesMatch('carT_heme', 'car_t')).toBe(true);
      expect(modalitiesMatch('carT_solid', 'car_t')).toBe(true);
    });

    it('matches gene therapy spellings', () => {
      expect(modalitiesMatch('geneTherapy', 'gene_therapy')).toBe(true);
    });

    it('does not cross families', () => {
      expect(modalitiesMatch('smallMolecule', 'antibody')).toBe(false);
      expect(modalitiesMatch('adc', 'bispecific')).toBe(false);
      expect(modalitiesMatch('smallMolecule', 'other')).toBe(false);
      expect(modalitiesMatch('smallMolecule', null)).toBe(false);
    });
  });

  describe('deal type', () => {
    it('matches licensing to license', () => {
      expect(dealTypesMatch('licensing', 'license')).toBe(true);
      expect(dealTypeKey('licensing')).toBe('license');
    });

    it('matches codevelopment to co_development', () => {
      expect(dealTypesMatch('codevelopment', 'co_development')).toBe(true);
    });

    it('does not match different types or empty values', () => {
      expect(dealTypesMatch('acquisition', 'license')).toBe(false);
      expect(dealTypesMatch('', '')).toBe(false);
      expect(dealTypesMatch('acquisition', null)).toBe(false);
    });
  });

  describe('indication', () => {
    it('tokenizes calculator ids', () => {
      expect(indicationTokens('lung_nsclc')).toEqual(['lung', 'nsclc']);
      expect(indicationTokens('headNeck')).toEqual(['head', 'neck']);
      expect(indicationTokens('pancreatic')).toEqual(['pancreatic']);
    });

    it('matches pancreatic against the spellings actually in the DB', () => {
      expect(indicationMatches('pancreatic', 'solid_tumor', 'Pancreatic')).toBe(true);
      expect(indicationMatches('pancreatic', null, 'pancreatic cancer')).toBe(true);
      expect(indicationMatches('pancreatic', 'solid_tumor', 'pancreatic and lung cancers')).toBe(true);
      expect(indicationMatches('pancreatic', 'solid_tumor', 'colorectal, pancreatic and lung cancer')).toBe(true);
    });

    it('does not match generic categories', () => {
      expect(indicationMatches('pancreatic', 'solid_tumor', null)).toBe(false);
      expect(indicationMatches('pancreatic', 'oncology', 'Breast cancer')).toBe(false);
      expect(indicationMatches('pancreatic', null, null)).toBe(false);
      expect(indicationMatches('', 'solid_tumor', 'pancreatic')).toBe(false);
    });

    it('matches NSCLC spellings', () => {
      expect(indicationMatches('lung_nsclc', null, 'non-small cell lung cancer')).toBe(true);
      expect(indicationMatches('lung_nsclc', null, 'NSCLC / solid tumors')).toBe(true);
      expect(indicationMatches('lung_nsclc', null, 'lung_nsclc')).toBe(true);
      expect(indicationMatches('lung_nsclc', null, 'small cell lung cancer')).toBe(false);
    });

    it('matches breast sub-types only when the sub-type is present', () => {
      expect(indicationMatches('breast_her2', null, 'HER2-positive breast cancer')).toBe(true);
      expect(indicationMatches('breast_her2', null, 'Breast cancer')).toBe(false);
      expect(indicationMatches('breast_tnbc', null, 'triple-negative breast cancer')).toBe(true);
    });

    it('matches heme abbreviations', () => {
      expect(indicationMatches('aml', null, 'acute myeloid leukemia')).toBe(true);
      expect(indicationMatches('cml', 'chronic_myeloid_leukemia', null)).toBe(true);
      expect(indicationMatches('myeloma', 'multiple_myeloma', null)).toBe(true);
    });
  });
});
