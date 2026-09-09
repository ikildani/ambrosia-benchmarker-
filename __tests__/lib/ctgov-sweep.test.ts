/**
 * Sponsor-agnostic ClinicalTrials.gov sweep — pure parts only.
 * No network: fetchWithTimeout is mocked to throw.
 */

jest.mock('../../lib/fetch-with-timeout', () => ({
  fetchWithTimeout: jest.fn(() => { throw new Error('network disabled in tests'); }),
}));

import {
  normalizeSponsorName,
  buildCompanyLookupNames,
  isCroSponsor,
  deriveOwnerType,
  relationshipForOwnerType,
  mapArmRole,
  strongestArmRole,
  normalizeInterventionName,
  interventionNameFromArmRef,
  isBackgroundComparatorName,
  computeIsPrimaryAsset,
  parseStudy,
  attributeStudy,
  buildTrialRow,
  buildInterventionRows,
  buildSweepFilter,
  buildSweepQuery,
  advanceCursor,
  resolveStart,
  isoDateMinusDays,
  ctgovCountryToIso,
  dominantLocationCountry,
  resolveSponsorGeography,
  SWEEP_EPOCH,
  SWEEP_FIELDS,
} from '../../lib/ingestion/ctgov-sweep';

// ═══════════════════════════════════════════════════════════════════════
// FIXTURE — hand-built CT.gov API v2 study, modelled on the live payload
// (interventions repeated once per arm, "Drug: X" arm refs, MeSH terms)
// ═══════════════════════════════════════════════════════════════════════

const COMBO_STUDY = {
  protocolSection: {
    identificationModule: { nctId: 'NCT09990001', briefTitle: 'ACM-101 With or Without Pembrolizumab in NSCLC', acronym: 'ACME-1' },
    statusModule: {
      overallStatus: 'TERMINATED',
      whyStopped: 'Business decision',
      startDateStruct: { date: '2024-03' },
      primaryCompletionDateStruct: { date: '2026-06-30' },
      completionDateStruct: { date: '2026' },
      studyFirstPostDateStruct: { date: '2024-02-14' },
      lastUpdatePostDateStruct: { date: '2026-09-02' },
    },
    sponsorCollaboratorsModule: {
      leadSponsor: { name: 'Acme Oncology, Inc.', class: 'INDUSTRY' },
      collaborators: [{ name: 'Merck Sharp & Dohme LLC', class: 'INDUSTRY' }],
    },
    descriptionModule: { briefSummary: 'A phase 1/2 study of ACM-101, an oral KRAS G12C inhibitor.' },
    conditionsModule: { conditions: ['Non-Small Cell Lung Cancer'] },
    designModule: { studyType: 'INTERVENTIONAL', phases: ['PHASE1', 'PHASE2'], enrollmentInfo: { count: 120 } },
    armsInterventionsModule: {
      armGroups: [
        { label: 'Arm A: ACM-101 + Pembrolizumab', type: 'EXPERIMENTAL', interventionNames: ['Drug: ACM-101', 'Biological: Pembrolizumab'] },
        { label: 'Arm B: ACM-101 monotherapy', type: 'EXPERIMENTAL', interventionNames: ['Drug: ACM-101'] },
        { label: 'Arm C: Pembrolizumab alone', type: 'ACTIVE_COMPARATOR', interventionNames: ['Biological: Pembrolizumab'] },
        { label: 'Arm D: Placebo', type: 'PLACEBO_COMPARATOR', interventionNames: ['Drug: Placebo'] },
      ],
      interventions: [
        // Listed first so the "first drug-class intervention" rule alone would pick it.
        { type: 'BIOLOGICAL', name: 'Pembrolizumab', description: 'Anti-PD-1 antibody', armGroupLabels: ['Arm A: ACM-101 + Pembrolizumab', 'Arm C: Pembrolizumab alone'], otherNames: ['KEYTRUDA', 'MK-3475'] },
        { type: 'DRUG', name: 'ACM-101', description: 'Oral KRAS G12C inhibitor, 200 mg BID', armGroupLabels: ['Arm A: ACM-101 + Pembrolizumab'] },
        { type: 'DRUG', name: 'ACM-101', armGroupLabels: ['Arm B: ACM-101 monotherapy'], otherNames: ['ACM101'] },
        { type: 'DRUG', name: 'Placebo', armGroupLabels: ['Arm D: Placebo'] },
      ],
    },
    contactsLocationsModule: {
      locations: [{ country: 'China' }, { country: 'United States' }, { country: 'China' }],
    },
    outcomesModule: {
      primaryOutcomes: [{ measure: 'Objective response rate', description: 'RECIST 1.1', timeFrame: '24 weeks' }],
      secondaryOutcomes: [{ measure: 'Progression-free survival' }],
    },
  },
  derivedSection: { conditionBrowseModule: { meshes: [{ term: 'Carcinoma, Non-Small-Cell Lung' }] } },
};

const CRO_STUDY = {
  protocolSection: {
    identificationModule: { nctId: 'NCT09990002', briefTitle: 'HZ-22 in Psoriasis' },
    statusModule: { overallStatus: 'RECRUITING', lastUpdatePostDateStruct: { date: '2026-09-03' } },
    sponsorCollaboratorsModule: {
      leadSponsor: { name: 'IQVIA', class: 'INDUSTRY' },
      collaborators: [
        { name: 'Peking University', class: 'OTHER' },
        { name: 'Hangzhou Zhongmei Biotech Co., Ltd.', class: 'INDUSTRY' },
      ],
    },
    conditionsModule: { conditions: ['Psoriasis'] },
    designModule: { studyType: 'INTERVENTIONAL', phases: ['PHASE3'] },
    armsInterventionsModule: {
      interventions: [{ type: 'DRUG', name: 'HZ-22' }],
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SPONSOR NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════

describe('normalizeSponsorName', () => {
  it.each([
    ['Pfizer Inc.', 'pfizer'],
    ['Jiangsu Hengrui Pharmaceuticals Co., Ltd.', 'jiangsu hengrui pharma'],
    ['Novo Nordisk A/S', 'novo nordisk'],
    ['Grünenthal GmbH', 'grunenthal'],
    ['The University of Oxford', 'university of oxford'],
    ['Merck Sharp & Dohme LLC', 'merck sharp and dohme'],
    ['Hoffmann-La Roche', 'hoffmann la roche'],
    ['AstraZeneca', 'astrazeneca'],
    ['Daiichi Sankyo Co., Ltd.', 'daiichi sankyo'],
    ['Takeda Pharmaceutical Company Limited', 'takeda pharma'],
    ['Abbott Laboratories', 'abbott labs'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSponsorName(input)).toBe(expected);
  });

  it('never strips the whole name', () => {
    expect(normalizeSponsorName('Inc.')).toBe('inc');
    expect(normalizeSponsorName('')).toBe('');
  });
});

describe('buildCompanyLookupNames', () => {
  it('adds suffix-stripped variants after the verbatim name', () => {
    expect(buildCompanyLookupNames('Pfizer Inc.')).toEqual(['Pfizer Inc.', 'Pfizer']);
    expect(buildCompanyLookupNames('Jiangsu Hengrui Pharmaceuticals Co., Ltd.')).toEqual([
      'Jiangsu Hengrui Pharmaceuticals Co., Ltd.',
      'Jiangsu Hengrui Pharmaceuticals Co.',
      'Jiangsu Hengrui Pharmaceuticals',
    ]);
    expect(buildCompanyLookupNames('AstraZeneca')).toEqual(['AstraZeneca']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CRO DETECTION + OWNER TYPE
// ═══════════════════════════════════════════════════════════════════════

describe('isCroSponsor', () => {
  it.each([
    'IQVIA', 'IQVIA Biotech', 'Quintiles, Inc.', 'Parexel International', 'PPD', 'Syneos Health',
    'Medpace, Inc.', 'ICON Clinical Research', 'ICON plc', 'Labcorp Drug Development', 'Covance',
    'Hangzhou Tigermed Consulting Co., Ltd.', 'Charles River Laboratories', 'Fortrea', 'WuXi Clinical',
    'Novotech (Australia) Pty Limited', 'PRA Health Sciences', 'Worldwide Clinical Trials',
  ])('%s is a CRO', name => {
    expect(isCroSponsor(name)).toBe(true);
  });

  it.each(['Pfizer', 'Icon Bioscience, Inc.', 'Micro Labs Limited', 'Acme Oncology, Inc.', 'University of Oxford', 'Macro Therapeutics'])(
    '%s is not a CRO',
    name => {
      expect(isCroSponsor(name)).toBe(false);
    },
  );
});

describe('deriveOwnerType', () => {
  it.each([
    ['Jiangsu Hengrui Pharmaceuticals Co., Ltd.', 'INDUSTRY', 'industry'],
    ['IQVIA', 'INDUSTRY', 'cro'],
    ['National Cancer Institute (NCI)', 'NIH', 'government'],
    ['US Department of Veterans Affairs', 'FED', 'government'],
    ["Children's Oncology Group", 'NETWORK', 'network'],
    ['University of Oxford', 'OTHER', 'academic'],
    ['Massachusetts General Hospital', 'OTHER', 'hospital'],
    ['University Hospital, Basel, Switzerland', 'OTHER', 'hospital'],
    ['Institut Curie', 'OTHER', 'academic'],
    ['Bill & Melinda Gates Foundation', 'OTHER', 'network'],
    ['Ministry of Health, Brazil', 'OTHER', 'government'],
    ['Zhejiang Haichang Biotech', 'OTHER', 'industry'],
    ['Dongmei Huang', 'OTHER', 'other'],
    ['Dongmei Huang', undefined, 'unknown'],
    ['Assistance Publique - Hôpitaux de Paris', 'OTHER', 'hospital'],
  ])('%s (%s) → %s', (name, cls, expected) => {
    expect(deriveOwnerType(name, cls)).toBe(expected);
  });
});

describe('relationshipForOwnerType', () => {
  it('maps owner types onto sponsor_aliases.relationship', () => {
    expect(relationshipForOwnerType('industry')).toBe('self');
    expect(relationshipForOwnerType('cro')).toBe('cro');
    expect(relationshipForOwnerType('academic')).toBe('academic');
    expect(relationshipForOwnerType('hospital')).toBe('hospital');
    expect(relationshipForOwnerType('government')).toBe('government');
    expect(relationshipForOwnerType('network')).toBe('unknown');
    expect(relationshipForOwnerType('unknown')).toBe('unknown');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ARM ROLES + INTERVENTION NAMES
// ═══════════════════════════════════════════════════════════════════════

describe('mapArmRole', () => {
  it.each([
    ['EXPERIMENTAL', 'experimental'],
    ['ACTIVE_COMPARATOR', 'active_comparator'],
    ['PLACEBO_COMPARATOR', 'placebo_comparator'],
    ['SHAM_COMPARATOR', 'sham'],
    ['Sham Comparator', 'sham'],
    ['NO_INTERVENTION', 'no_intervention'],
    ['OTHER', 'other'],
    [undefined, 'unknown'],
    ['SOMETHING_NEW', 'unknown'],
  ])('%s → %s', (input, expected) => {
    expect(mapArmRole(input)).toBe(expected);
  });

  it('takes the strongest role when an intervention sits in several arms', () => {
    expect(strongestArmRole(['placebo_comparator', 'experimental'])).toBe('experimental');
    expect(strongestArmRole(['other', 'active_comparator'])).toBe('active_comparator');
    expect(strongestArmRole([])).toBe('unknown');
  });
});

describe('intervention name helpers', () => {
  it('normalizes for the (nct_id, name_normalized) key', () => {
    expect(normalizeInterventionName('Pembrolizumab (MK-3475)')).toBe('pembrolizumab mk 3475');
    expect(normalizeInterventionName('  ACM-101 ')).toBe('acm 101');
  });

  it('strips the "Type: " prefix from armGroups.interventionNames', () => {
    expect(interventionNameFromArmRef('Drug: Pembrolizumab')).toBe('Pembrolizumab');
    expect(interventionNameFromArmRef('Combination Product: X + Y')).toBe('X + Y');
    expect(interventionNameFromArmRef('Vitamin D3: high dose')).toBe('Vitamin D3: high dose');
  });

  it('recognises approved backbone drugs by name', () => {
    expect(isBackgroundComparatorName('Pembrolizumab')).toBe(true);
    expect(isBackgroundComparatorName('Pembrolizumab (MK-3475)')).toBe(true);
    expect(isBackgroundComparatorName('Carboplatin AUC 5')).toBe(true);
    expect(isBackgroundComparatorName('ACM-101')).toBe(false);
  });
});

describe('computeIsPrimaryAsset', () => {
  const ctx = { experimentalDrugCount: 2, hasArmGroups: true };

  it('keeps a novel drug in an experimental arm', () => {
    expect(computeIsPrimaryAsset({ name: 'ACM-101', type: 'DRUG', armRole: 'experimental', armRoles: ['experimental'] }, ctx)).toBe(true);
  });

  it('drops comparators, placebo and devices', () => {
    expect(computeIsPrimaryAsset({ name: 'Docetaxel', type: 'DRUG', armRole: 'active_comparator', armRoles: ['active_comparator'] }, ctx)).toBe(false);
    expect(computeIsPrimaryAsset({ name: 'Placebo', type: 'DRUG', armRole: 'placebo_comparator', armRoles: ['placebo_comparator'] }, ctx)).toBe(false);
    expect(computeIsPrimaryAsset({ name: 'Matching placebo', type: 'DRUG', armRole: 'experimental', armRoles: ['experimental'] }, ctx)).toBe(false);
    expect(computeIsPrimaryAsset({ name: 'Infusion pump', type: 'DEVICE', armRole: 'experimental', armRoles: ['experimental'] }, ctx)).toBe(false);
  });

  it('drops a backbone that appears in both experimental and comparator arms', () => {
    expect(computeIsPrimaryAsset({ name: 'Osimertinib', type: 'DRUG', armRole: 'experimental', armRoles: ['experimental', 'active_comparator'] }, ctx)).toBe(false);
  });

  it('drops a known approved backbone only when the arm has another experimental drug', () => {
    expect(computeIsPrimaryAsset({ name: 'Pembrolizumab', type: 'BIOLOGICAL', armRole: 'experimental', armRoles: ['experimental'] }, ctx)).toBe(false);
    // Merck's own pembrolizumab monotherapy trial
    expect(computeIsPrimaryAsset({ name: 'Pembrolizumab', type: 'BIOLOGICAL', armRole: 'experimental', armRoles: ['experimental'] }, { experimentalDrugCount: 1, hasArmGroups: true })).toBe(true);
  });

  it('accepts unknown roles only on records with no arm groups at all', () => {
    expect(computeIsPrimaryAsset({ name: 'HZ-22', type: 'DRUG', armRole: 'unknown', armRoles: [] }, { experimentalDrugCount: 1, hasArmGroups: false })).toBe(true);
    expect(computeIsPrimaryAsset({ name: 'HZ-22', type: 'DRUG', armRole: 'unknown', armRoles: [] }, { experimentalDrugCount: 1, hasArmGroups: true })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// STUDY PARSING
// ═══════════════════════════════════════════════════════════════════════

describe('parseStudy', () => {
  const study = parseStudy(COMBO_STUDY)!;

  it('maps identification, status, phase, sponsor and dates like the existing ingester', () => {
    expect(study.nctId).toBe('NCT09990001');
    expect(study.phase).toBe('phase_1_2');
    expect(study.status).toBe('terminated');
    expect(study.whyStopped).toBe('Business decision');
    expect(study.studyType).toBe('INTERVENTIONAL');
    expect(study.leadSponsorName).toBe('Acme Oncology, Inc.');
    expect(study.leadSponsorClass).toBe('INDUSTRY');
    expect(study.collaborators).toEqual([{ name: 'Merck Sharp & Dohme LLC', class: 'INDUSTRY' }]);
    expect(study.startDate).toBe('2024-03-01');
    expect(study.completionDate).toBe('2026-01-01');
    expect(study.firstPostedDate).toBe('2024-02-14');
    expect(study.lastUpdatePosted).toBe('2026-09-02');
    expect(study.enrollmentCount).toBe(120);
    expect(study.locationCountries).toEqual(['China', 'United States', 'China']);
    expect(study.meshTerms).toEqual(['Carcinoma, Non-Small-Cell Lung']);
    expect(study.hasResults).toBe(false);
  });

  it('merges per-arm duplicates and unions their arm roles / other names', () => {
    expect(study.interventions.map(i => i.name)).toEqual(['Pembrolizumab', 'ACM-101', 'Placebo']);
    const acm = study.interventions.find(i => i.name === 'ACM-101')!;
    expect(acm.armRoles).toEqual(['experimental']);
    expect(acm.armRole).toBe('experimental');
    expect(acm.otherNames).toEqual(['ACM101']);
    expect(acm.description).toBe('Oral KRAS G12C inhibitor, 200 mg BID');
  });

  it('derives arm roles from armGroupLabels and armGroups.interventionNames', () => {
    const pembro = study.interventions.find(i => i.name === 'Pembrolizumab')!;
    expect(pembro.armRole).toBe('experimental');
    expect(new Set(pembro.armRoles)).toEqual(new Set(['experimental', 'active_comparator']));
    const placebo = study.interventions.find(i => i.name === 'Placebo')!;
    expect(placebo.armRole).toBe('placebo_comparator');
  });

  it('marks only the sponsor\'s novel drug as the primary asset', () => {
    expect(study.interventions.filter(i => i.isPrimaryAsset).map(i => i.name)).toEqual(['ACM-101']);
  });

  it('handles records without arm groups', () => {
    const cro = parseStudy(CRO_STUDY)!;
    expect(cro.hasArmGroups).toBe(false);
    expect(cro.interventions[0].armRole).toBe('unknown');
    expect(cro.interventions[0].isPrimaryAsset).toBe(true);
    expect(cro.phase).toBe('phase_3');
  });

  it('returns null without an NCT id', () => {
    expect(parseStudy({ protocolSection: {} })).toBeNull();
    expect(parseStudy({} as never)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ATTRIBUTION + ROW BUILDERS
// ═══════════════════════════════════════════════════════════════════════

describe('attributeStudy', () => {
  it('attributes to the lead sponsor when it is not a CRO', () => {
    expect(attributeStudy(parseStudy(COMBO_STUDY)!)).toEqual({ sponsorName: 'Acme Oncology, Inc.', sponsorClass: 'INDUSTRY', viaCollaborator: false });
  });

  it('attributes a CRO-led trial to the first industry collaborator', () => {
    expect(attributeStudy(parseStudy(CRO_STUDY)!)).toEqual({ sponsorName: 'Hangzhou Zhongmei Biotech Co., Ltd.', sponsorClass: 'INDUSTRY', viaCollaborator: true });
  });

  it('leaves a CRO-led trial unattributed when no industry collaborator exists', () => {
    const noIndustry = JSON.parse(JSON.stringify(CRO_STUDY));
    noIndustry.protocolSection.sponsorCollaboratorsModule.collaborators = [{ name: 'Peking University', class: 'OTHER' }];
    expect(attributeStudy(parseStudy(noIndustry)!)).toBeNull();
  });
});

describe('buildTrialRow', () => {
  const study = parseStudy(COMBO_STUDY)!;
  const row = buildTrialRow(study, { companyId: 'c-1', companyName: 'Acme Oncology' });

  it('keeps company_name consistent with companies.name and records sponsor provenance', () => {
    expect(row.company_id).toBe('c-1');
    expect(row.company_name).toBe('Acme Oncology');
    expect(row.lead_sponsor_name).toBe('Acme Oncology, Inc.');
    expect(row.lead_sponsor_class).toBe('INDUSTRY');
    expect(row.lead_sponsor_type).toBe('INDUSTRY');
    expect(row.registry).toBe('ctgov');
    expect(row.why_stopped).toBe('Business decision');
    expect(row.study_type).toBe('INTERVENTIONAL');
  });

  it('uses the primary asset as intervention_name even when a backbone is listed first', () => {
    expect(row.intervention_name).toBe('ACM-101');
    expect(row.intervention_type).toBe('DRUG');
  });

  it('maps phase, status, indication, geography and outcomes like the existing ingester', () => {
    expect(row.phase).toBe('phase_1_2');
    expect(row.status).toBe('terminated');
    expect(row.indication_category).toBe('solid_tumor');
    // inferIndicationFromConditions matches 'lung cancer' before 'nsclc' (existing classifier order)
    expect(row.indication_specific).toBe('lung');
    expect(row.locations_countries).toEqual(['China', 'United States']);
    expect(row.is_collaboration).toBe(true);
    expect(row.collaborator_names).toEqual(['Merck Sharp & Dohme LLC']);
    expect(row.primary_outcomes).toEqual(['Objective response rate']);
    expect(row.secondary_outcomes).toEqual(['Progression-free survival']);
    expect(row.enrollment_count).toBe(120);
  });

  it('falls back to the lead sponsor name for unattributed trials', () => {
    const orphan = buildTrialRow(study, { companyId: null, companyName: null });
    expect(orphan.company_id).toBeNull();
    expect(orphan.company_name).toBe('Acme Oncology, Inc.');
  });
});

describe('buildInterventionRows', () => {
  it('writes one row per merged intervention with arm role and primary flag', () => {
    const rows = buildInterventionRows(parseStudy(COMBO_STUDY)!, 'c-1');
    expect(rows).toHaveLength(3);
    expect(rows.map(r => [r.name, r.arm_role, r.is_primary_asset])).toEqual([
      ['Pembrolizumab', 'experimental', false],
      ['ACM-101', 'experimental', true],
      ['Placebo', 'placebo_comparator', false],
    ]);
    expect(rows[0].other_names).toEqual(['KEYTRUDA', 'MK-3475']);
    expect(rows.every(r => r.nct_id === 'NCT09990001' && r.company_id === 'c-1')).toBe(true);
    expect(rows[1].name_normalized).toBe('acm 101');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QUERY + CURSOR
// ═══════════════════════════════════════════════════════════════════════

describe('buildSweepQuery', () => {
  it('pins the exact CT.gov v2 request', () => {
    const params = new URLSearchParams(buildSweepQuery({ from: '2024-01-01', pageSize: 1000, countTotal: true }));
    expect(params.get('filter.advanced')).toBe(
      'AREA[StudyType]INTERVENTIONAL AND (AREA[InterventionType]DRUG OR AREA[InterventionType]BIOLOGICAL OR AREA[InterventionType]GENETIC OR AREA[InterventionType]COMBINATION_PRODUCT) AND AREA[LastUpdatePostDate]RANGE[2024-01-01,MAX]',
    );
    expect(params.get('sort')).toBe('LastUpdatePostDate:asc');
    expect(params.get('pageSize')).toBe('1000');
    expect(params.get('countTotal')).toBe('true');
    expect(params.get('fields')).toBe(SWEEP_FIELDS.join(','));
    expect(params.has('pageToken')).toBe(false);
    expect(buildSweepFilter('2000-01-01')).toContain('RANGE[2000-01-01,MAX]');
  });

  it('carries the page token and caps the page size at 1000', () => {
    const params = new URLSearchParams(buildSweepQuery({ from: '2024-01-01', pageSize: 5000, pageToken: 'abc' }));
    expect(params.get('pageToken')).toBe('abc');
    expect(params.get('pageSize')).toBe('1000');
    expect(params.has('countTotal')).toBe(false);
  });
});

describe('advanceCursor', () => {
  it('stops one day short of the page max while more pages remain', () => {
    const r = advanceCursor({ cursor: '2024-01-01', queryFrom: '2024-01-01', pageMaxDate: '2024-03-15', nextPageToken: 'tok' });
    expect(r.cursor).toBe('2024-03-14');
    expect(r.state).toMatchObject({ query_from: '2024-01-01', page_token: 'tok', caught_up: false });
  });

  it('reaches the page max on the final page', () => {
    const r = advanceCursor({ cursor: '2024-03-14', queryFrom: '2024-01-01', pageMaxDate: '2026-09-08', nextPageToken: null, lastNct: 'NCT1', totalCount: 225079 });
    expect(r.cursor).toBe('2026-09-08');
    expect(r.state).toEqual({ query_from: '2024-01-01', page_token: null, caught_up: true, last_nct: 'NCT1', total_count: 225079 });
  });

  it('never moves backwards and tolerates a page without dates', () => {
    expect(advanceCursor({ cursor: '2025-01-01', queryFrom: '2025-01-01', pageMaxDate: '2024-12-01', nextPageToken: null }).cursor).toBe('2025-01-01');
    expect(advanceCursor({ cursor: '2025-01-01', queryFrom: '2025-01-01', pageMaxDate: null, nextPageToken: 'tok' }).cursor).toBe('2025-01-01');
    expect(advanceCursor({ cursor: null, queryFrom: SWEEP_EPOCH, pageMaxDate: null, nextPageToken: null }).cursor).toBe(SWEEP_EPOCH);
  });

  it('subtracts days across month and leap boundaries', () => {
    expect(isoDateMinusDays('2024-03-01', 1)).toBe('2024-02-29');
    expect(isoDateMinusDays('2025-01-01', 1)).toBe('2024-12-31');
  });
});

describe('resolveStart', () => {
  it('starts at the epoch with no cursor, or on ?full=true', () => {
    expect(resolveStart(null, {}, false)).toEqual({ from: SWEEP_EPOCH, pageToken: null });
    expect(resolveStart('2025-06-01', { query_from: '2025-06-01', page_token: 'tok' }, true)).toEqual({ from: SWEEP_EPOCH, pageToken: null });
  });

  it('resumes an in-flight page token for the same query window', () => {
    expect(resolveStart('2025-06-01', { query_from: '2025-01-01', page_token: 'tok' }, false)).toEqual({ from: '2025-01-01', pageToken: 'tok' });
  });

  it('ignores a token whose window is ahead of the cursor, and restarts from the cursor day', () => {
    expect(resolveStart('2025-06-01', { query_from: '2025-07-01', page_token: 'tok' }, false)).toEqual({ from: '2025-06-01', pageToken: null });
    expect(resolveStart('2025-06-01', { query_from: '2025-06-01', page_token: null, caught_up: true }, false)).toEqual({ from: '2025-06-01', pageToken: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GEOGRAPHY
// ═══════════════════════════════════════════════════════════════════════

describe('geography', () => {
  it('maps CT.gov location country names to ISO-2', () => {
    expect(ctgovCountryToIso('United States')).toBe('US');
    expect(ctgovCountryToIso('Korea, Republic of')).toBe('KR');
    expect(ctgovCountryToIso('South Korea')).toBe('KR');
    expect(ctgovCountryToIso('Turkey (Türkiye)')).toBe('TR');
    expect(ctgovCountryToIso('UK')).toBe('GB');
    expect(ctgovCountryToIso('Atlantis')).toBeNull();
  });

  it('picks the dominant location country', () => {
    expect(dominantLocationCountry(['China', 'United States', 'China'])).toBe('China');
    expect(dominantLocationCountry(['Japan', 'Israel'])).toBe('Japan');
    expect(dominantLocationCountry([])).toBeNull();
  });

  it('uses the name classifier when confident, else the trial locations', () => {
    expect(resolveSponsorGeography('Pfizer Inc.', ['China'])).toEqual({ country: 'US', region: 'north_america', source: 'name' });
    expect(resolveSponsorGeography('Hangzhou Zhongmei Biotech Co., Ltd.', [])).toMatchObject({ country: 'CN', region: 'china' });
    expect(resolveSponsorGeography('Acme Oncology, Inc.', ['China', 'United States', 'China'])).toEqual({ country: 'CN', region: 'china', source: 'location' });
    expect(resolveSponsorGeography('Acme Oncology, Inc.', [])).toEqual({ country: null, region: null, source: null });
  });
});
