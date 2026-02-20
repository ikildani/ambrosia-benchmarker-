// Smart validation: detect contradictory or unlikely input combinations
// Returns contextual warnings to help users make informed selections

export interface ValidationWarning {
  id: string;
  message: string;
  /** Which fields are involved — used to show warning on the right wizard step */
  fields: string[];
}

interface ValidationInput {
  phase: string;
  dataQuality: string;
  competitivePosition: string;
  combinationPotential: string;
  biomarker: string;
  modality: string;
  territory: string;
}

export function getValidationWarnings(input: ValidationInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Approved + Limited data is contradictory
  if (input.phase === 'approved' && input.dataQuality === 'limited') {
    warnings.push({
      id: 'approved-limited-data',
      message: 'Approved products typically have extensive clinical data. "Limited" data quality is unusual here — did you mean a different phase or data quality?',
      fields: ['phase', 'dataQuality'],
    });
  }

  // Preclinical + Pivotal-ready data is contradictory
  if (input.phase === 'preclinical' && input.dataQuality === 'pivotalReady') {
    warnings.push({
      id: 'preclinical-pivotal-data',
      message: 'Preclinical assets rarely have pivotal-ready data. Consider whether "Promising" or "Limited" better describes your data package.',
      fields: ['phase', 'dataQuality'],
    });
  }

  // Phase 1 + Pivotal-ready data is unlikely
  if (input.phase === 'phase1' && input.dataQuality === 'pivotalReady') {
    warnings.push({
      id: 'phase1-pivotal-data',
      message: 'Phase 1 assets with pivotal-ready data are rare. This typically applies to accelerated programs with registrational Phase 1 trials.',
      fields: ['phase', 'dataQuality'],
    });
  }

  // Preclinical + First to pivotal is contradictory
  if (input.phase === 'preclinical' && input.competitivePosition === 'firstToPivotal') {
    warnings.push({
      id: 'preclinical-first-pivotal',
      message: '"First to Pivotal" implies a Phase 3 race, which is inconsistent with a preclinical asset. Consider "First-in-Class" or "Racing" instead.',
      fields: ['phase', 'competitivePosition'],
    });
  }

  // Standalone combination + Strong combo potential is contradictory
  if (input.modality === 'cellTherapy' && input.combinationPotential === 'strong') {
    // Not contradictory for cell therapy — skip
  }

  // Crowded competitive position + First in class is somewhat contradictory
  // (already covered by the fact that they're different options, skip)

  // Biomarker-selected but preclinical — unusual
  if (input.phase === 'preclinical' && input.biomarker === 'biomarkerSelected') {
    warnings.push({
      id: 'preclinical-biomarker-selected',
      message: 'Biomarker-selected populations are typically defined in later clinical stages. Preclinical assets usually have "No biomarker" or "Biomarker identified".',
      fields: ['phase', 'biomarker'],
    });
  }

  // Approved + Breakthrough designation is unusual (already approved, designation less relevant)
  // This is technically valid (accelerated approval) so skip

  // China-only territory + Gene therapy (manufacturing complexity)
  if (input.territory === 'chinaOnly' && (input.modality === 'geneTherapy' || input.modality === 'cellTherapy')) {
    warnings.push({
      id: 'china-only-advanced-modality',
      message: 'Gene/cell therapy China-only deals are rare due to manufacturing and regulatory complexities. Most pharma partners seek broader rights for advanced modalities.',
      fields: ['territory', 'modality'],
    });
  }

  return warnings;
}
