/**
 * lib/radar/ownership.ts — pure mirror of radar_apply_ownership() (migration 125).
 * The cases below are the production shapes from the Sep 25 2026 audit.
 */

import { codePrefixOf, deriveOwnership, isComparatorNamed, isOwnershipHiddenByDefault, OWNERSHIP_EXCLUDED_IN, type OwnershipInput } from '@/lib/radar/ownership';

const MERCK = 'c-merck';
const SCHOLAR = 'c-scholar';
const BIOGEN = 'c-biogen';

function input(over: Partial<OwnershipInput>): OwnershipInput {
  return { companyId: SCHOLAR, phase: 'phase_2', drug: null, ownerRole: null, armRoles: [], ...over };
}

describe('deriveOwnership', () => {
  it('originator match: the company that made the drug owns the program', () => {
    const r = deriveOwnership(input({
      companyId: MERCK,
      drug: { id: 'd1', originatorCompanyId: MERCK, confidence: 90, maxPhase: 'approved' },
      armRoles: ['experimental'],
    }));
    expect(r.status).toBe('originator');
    expect(r.rule).toBe('originator_match');
    expect(r.evidence.originator_company_id).toBe(MERCK);
  });

  it('drug_owners role beats a foreign originator: in-licensed programs are licensee', () => {
    const r = deriveOwnership(input({
      drug: { id: 'd1', originatorCompanyId: BIOGEN, confidence: 95, maxPhase: 'phase_3' },
      ownerRole: 'licensee',
      armRoles: ['experimental'],
    }));
    expect(r.status).toBe('licensee');
    expect(r.rule).toBe('drug_owner_role');
    expect(r.evidence.owner_role).toBe('licensee');
  });

  it("Nusinersen at Scholar Rock: another company's approved drug is marketed_other", () => {
    const r = deriveOwnership(input({
      drug: { id: 'd-nusinersen', originatorCompanyId: BIOGEN, confidence: 95, maxPhase: 'approved' },
      armRoles: ['active_comparator'],
    }));
    expect(r.status).toBe('marketed_other');
    expect(r.rule).toBe('marketed_other');
  });

  it('phase_4 on the asset row counts as marketed even when max_phase is unknown', () => {
    const r = deriveOwnership(input({
      phase: 'phase_4',
      drug: { id: 'd1', originatorCompanyId: BIOGEN, confidence: 80, maxPhase: null },
      armRoles: ['experimental'],
    }));
    expect(r.status).toBe('marketed_other');
  });

  it("another company's investigational drug in a comparator arm only is comparator_or_background", () => {
    const r = deriveOwnership(input({
      drug: { id: 'd1', originatorCompanyId: BIOGEN, confidence: 80, maxPhase: 'phase_3' },
      armRoles: ['active_comparator', 'unknown'],
    }));
    expect(r.status).toBe('comparator_or_background');
    expect(r.rule).toBe('comparator');
    expect(r.evidence.arms).toEqual({ experimental: 0, comparator: 1, unknown: 1 });
  });

  it("another company's investigational drug in an experimental arm stays visible as unknown (possible licensee)", () => {
    const r = deriveOwnership(input({
      drug: { id: 'd1', originatorCompanyId: BIOGEN, confidence: 80, maxPhase: 'phase_2' },
      armRoles: ['experimental'],
    }));
    expect(r.status).toBe('unknown');
    expect(r.rule).toBe('originator_mismatch');
    expect(isOwnershipHiddenByDefault(r.status)).toBe(false);
  });

  it('a low-confidence originator is not trusted; the arm roles decide', () => {
    const r = deriveOwnership(input({
      drug: { id: 'd1', originatorCompanyId: BIOGEN, confidence: 40, maxPhase: 'approved' },
      armRoles: ['experimental'],
    }));
    expect(r.status).toBe('originator');
    expect(r.rule).toBe('sponsor_default');
  });

  it('no originator, comparator arms only: comparator_or_background', () => {
    const r = deriveOwnership(input({ armRoles: ['placebo_comparator', 'other'] }));
    expect(r.status).toBe('comparator_or_background');
    expect(r.rule).toBe('arm_comparator');
  });

  it('no originator, no matched arms (legacy row, unknown arms): unknown', () => {
    expect(deriveOwnership(input({ armRoles: [] })).rule).toBe('no_arm_evidence');
    expect(deriveOwnership(input({ armRoles: ['unknown', 'unknown'] })).status).toBe('unknown');
  });

  it('a row named after a comparator is comparator_or_background whatever drug_master says (migration 143)', () => {
    const r = deriveOwnership(input({
      companyId: MERCK,
      assetName: 'Comparators: simvastatin and ezetimibe',
      drug: { id: 'd1', originatorCompanyId: MERCK, confidence: 95, maxPhase: 'approved' },
      armRoles: ['unknown'],
    }));
    expect(r.rule).toBe('comparator_named');
    expect(r.status).toBe('comparator_or_background');
    expect(isComparatorNamed('Placebo')).toBe(true);
    expect(isComparatorNamed('Standard of Care')).toBe(true);
    expect(isComparatorNamed('Controlled-release ABC-123')).toBe(false);
    expect(isComparatorNamed('Socazolimab')).toBe(false);
  });

  it("the company's own code series beats a foreign originator and no-arm rows (migration 143)", () => {
    // Novartis JDQ443 with drug_master pointing at another company: the JDQ series is Novartis's.
    const foreign = deriveOwnership(input({
      companyId: 'c-novartis',
      assetName: 'JDQ443',
      drug: { id: 'd1', originatorCompanyId: BIOGEN, confidence: 90, maxPhase: 'phase_3' },
      armRoles: ['experimental'],
      codePrefixOriginators: 4,
    }));
    expect(foreign.rule).toBe('code_prefix_match');
    expect(foreign.status).toBe('originator');
    expect(foreign.evidence.code_prefix).toBe('JDQ');
    expect(foreign.evidence.code_prefix_originators).toBe(4);
    // Pfizer CP-742,033 with unknown arms only.
    const noArms = deriveOwnership(input({ companyId: 'c-pfizer', assetName: 'CP-742,033', armRoles: ['unknown'], codePrefixOriginators: 12 }));
    expect(noArms.rule).toBe('code_prefix_match');
    // One sibling is not a series; an INN is never a code.
    expect(deriveOwnership(input({ assetName: 'NB002', armRoles: ['unknown'], codePrefixOriginators: 1 })).rule).toBe('no_arm_evidence');
    expect(deriveOwnership(input({ assetName: 'Dotinurad', armRoles: ['unknown'], codePrefixOriginators: 9 })).rule).toBe('no_arm_evidence');
    expect(codePrefixOf('JDQ443')).toBe('JDQ');
    expect(codePrefixOf('CP-742,033')).toBe('CP');
    expect(codePrefixOf('TAK 079')).toBe('TAK');
    expect(codePrefixOf('Dotinurad')).toBeNull();
    // A trusted originator that IS the company still wins, and marketed_other still beats the series.
    expect(deriveOwnership(input({ companyId: MERCK, assetName: 'MK-1234', drug: { id: 'd', originatorCompanyId: MERCK, confidence: 90, maxPhase: null }, codePrefixOriginators: 5 })).rule).toBe('originator_match');
    expect(deriveOwnership(input({ assetName: 'AB-123', phase: 'phase_4', drug: { id: 'd', originatorCompanyId: BIOGEN, confidence: 90, maxPhase: 'approved' }, armRoles: ['experimental'], codePrefixOriginators: 5 })).rule).toBe('marketed_other');
  });

  it('evidence omits drug fields when there is no drug', () => {
    const r = deriveOwnership(input({ armRoles: ['experimental'] }));
    expect(r.evidence).toEqual({ rule: 'sponsor_default', arms: { experimental: 1, comparator: 0, unknown: 0 }, matched_interventions: 1 });
  });
});

describe('default exclusion', () => {
  it('hides comparator and marketed_other, keeps everything else', () => {
    expect(isOwnershipHiddenByDefault('comparator_or_background')).toBe(true);
    expect(isOwnershipHiddenByDefault('marketed_other')).toBe(true);
    for (const s of ['originator', 'licensee', 'co_developer', 'unknown']) expect(isOwnershipHiddenByDefault(s)).toBe(false);
    expect(isOwnershipHiddenByDefault(null)).toBe(false);
  });

  it('PostgREST literal matches the vocabulary', () => {
    expect(OWNERSHIP_EXCLUDED_IN).toBe('(comparator_or_background,marketed_other)');
  });
});
