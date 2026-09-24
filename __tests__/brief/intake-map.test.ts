import { resolveIndication, resolveModality, resolvePhase, resolveTherapeuticArea, resolveDealType, resolveIntake } from '@/lib/brief/intake-map';

describe('intake-map', () => {
  it('maps wizard labels to engine keys', () => {
    expect(resolveTherapeuticArea('Neurology')).toBe('neurology');
    expect(resolveTherapeuticArea("Women's Health")).toBe('womensHealth');
    expect(resolveTherapeuticArea('Infectious Disease')).toBe('infectiousDisease');
    expect(resolvePhase('Phase 2')).toBe('phase2');
    expect(resolvePhase('Preclinical')).toBe('preclinical');
    expect(resolveModality('mAb')).toBe('mab');
    expect(resolveModality('SM')).toBe('smallMolecule');
    expect(resolveModality('geneTherapy')).toBe('geneTherapy');
    expect(resolveModality(undefined)).toBe('mab');
    expect(resolveDealType('M&A / Acquisition')).toBe('acquisition');
    expect(resolveDealType('Co-Development')).toBe('codevelopment');
  });

  it('resolves free-text indications to registry keys', () => {
    expect(resolveIndication("Alzheimer's Disease", 'neurology')).toMatchObject({ key: 'alzheimers', how: 'label' });
    expect(resolveIndication('alzheimers', 'neurology')).toMatchObject({ key: 'alzheimers', how: 'key' });
    expect(resolveIndication('early alzheimer disease', 'neurology').key).toBe('alzheimers');
    expect(resolveIndication('Non-Small Cell Lung Cancer', 'oncology').key).toBe('lung_nsclc');
    expect(resolveIndication('zzzz unknown', 'neurology').how).toBe('default');
  });

  it('builds engine input and asset profile from a request row', () => {
    const r = resolveIntake({
      id: 'x', therapeutic_area: 'Neurology', indication: "Alzheimer's Disease", phase: 'Preclinical',
      modality: 'mAb', target_deal_type: 'Licensing', asset_name: 'AV-101', mechanism: 'anti-pTau217',
      data_package_stage: 'IND-enabling complete / IND filed', differentiation_notes: 'biomarker-selected',
    }, { mab: 'Monoclonal Antibody' });
    expect(r.input.indication).toBe('alzheimers');
    expect(r.input.modality).toBe('mab');
    expect(r.input.phase).toBe('preclinical');
    expect(r.asset.assetName).toBe('AV-101');
    expect(r.labels.indication).toBe("Alzheimer's Disease");
    expect(r.labels.modality).toBe('Monoclonal Antibody');
    expect(r.notes).toHaveLength(0);
  });
});
