/**
 * lib/radar/qa/audit.ts — the /admin/radar-audit queue: sampling, review rows, corrections.
 */
import {
  auditProgress,
  availabilityClaim,
  buildOverride,
  buildReviewRows,
  pickNext,
  registryUrl,
  validateSubmission,
  type AuditQueueRow,
  type AuditSubmission,
} from '@/lib/radar/qa/audit';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const allOk = (over: Partial<AuditSubmission> = {}): AuditSubmission => ({
  assetId: A, owner: { agrees: true }, availability: { agrees: true }, duplicate: { agrees: true }, ...over,
});

describe('audit queue', () => {
  const q: AuditQueueRow[] = [
    { asset_id: A, rank: 1, reviewed_fields: ['owner', 'availability', 'duplicate'], last_reviewed_at: '2026-11-20' },
    { asset_id: B, rank: 2, reviewed_fields: ['owner'], last_reviewed_at: '2026-11-20' },
    { asset_id: C, rank: 3, reviewed_fields: [], last_reviewed_at: null },
  ];

  it('counts reviewed programs and per-field reviews', () => {
    expect(auditProgress(q)).toEqual({ total: 3, reviewed: 1, byField: { owner: 2, availability: 1, duplicate: 1 } });
  });

  it('picks uniformly among programs not fully reviewed, honouring skips', () => {
    expect(pickNext(q, new Set(), () => 0)?.asset_id).toBe(B);
    expect(pickNext(q, new Set(), () => 0.99)?.asset_id).toBe(C);
    expect(pickNext(q, new Set([B]), () => 0)?.asset_id).toBe(C);
    expect(pickNext(q, new Set([B, C]))).toBeNull();
  });
});

describe('registryUrl', () => {
  it('links each registry to its public page', () => {
    expect(registryUrl('NCT01234567')).toBe('https://clinicaltrials.gov/study/NCT01234567');
    expect(registryUrl('CTR20240001')).toContain('chinadrugtrials.org.cn');
    expect(registryUrl('2023-509876-12-00')).toContain('euclinicaltrials.eu');
    expect(registryUrl('ChiCTR2400080000')).toBe('https://trialsearch.who.int/Trial2.aspx?TrialID=ChiCTR2400080000');
  });
});

describe('validateSubmission', () => {
  it('accepts a plain all-correct review', () => expect(validateSubmission(allOk())).toBeNull());
  it('rejects bad ids, values and self-duplicates', () => {
    expect(validateSubmission(allOk({ assetId: 'x' }))).toMatch(/uuid/);
    expect(validateSubmission(allOk({ owner: { agrees: false, status: 'originator' } }))).toMatch(/correction value/);
    expect(validateSubmission(allOk({ owner: { agrees: false, relation: 'subsidiary', relationParentId: null } }))).toMatch(/relationParentId/);
    expect(validateSubmission(allOk({ duplicate: { agrees: false, duplicateOf: A } }))).toMatch(/itself/);
    expect(validateSubmission({ ...allOk(), availability: {} as never })).toMatch(/availability.agrees/);
  });
});

describe('buildReviewRows', () => {
  const current = { companyName: 'Corxel Bio', ownershipStatus: 'originator', partnershipStatus: 'unpartnered', availabilityReasons: [] };

  it('writes one row per field with the claim the reviewer judged', () => {
    const rows = buildReviewRows(allOk(), 'issa@x', current);
    expect(rows.map(r => [r.field, r.agrees])).toEqual([['owner', true], ['availability', true], ['duplicate', true]]);
    expect(rows[0].model_value).toBe('Corxel Bio (originator)');
    expect(rows[1].model_value).toBe('Available (no partner found)');
    expect(rows.every(r => r.human_value === null)).toBe(true);
  });

  it('records the corrected values', () => {
    const rows = buildReviewRows(allOk({
      owner: { agrees: false, status: 'licensee', ownerCompanyId: B },
      availability: { agrees: false, partnership: 'partnered' },
      duplicate: { agrees: false, duplicateOf: C },
      comment: ' LENZ licensed Greater China rights ',
    }), 'issa@x', current);
    expect(rows[0]).toMatchObject({ agrees: false, human_value: `status=licensee; owner_company=${B}`, comment: 'LENZ licensed Greater China rights' });
    expect(rows[1]).toMatchObject({ agrees: false, human_value: 'partnered' });
    expect(rows[2]).toMatchObject({ agrees: false, human_value: `duplicate_of=${C}` });
  });

  it('describes availability flags', () => {
    expect(availabilityClaim('partially_partnered', ['partial_deal', 'large_pharma'])).toBe('Partly available (regional or partial rights out); flags: partial_deal, large_pharma');
  });
});

describe('buildOverride', () => {
  const now = '2026-11-24T00:00:00.000Z';
  it('nothing to override when everything is right or only a relation is given', () => {
    expect(buildOverride(allOk(), 'r', null, now)).toBeNull();
    expect(buildOverride(allOk({ owner: { agrees: false, relation: 'subsidiary', relationParentId: B } }), 'r', null, now)).toBeNull();
  });
  it('a duplicate wins over an owner status and keeps the target', () => {
    const o = buildOverride(allOk({ owner: { agrees: false, status: 'licensee' }, duplicate: { agrees: false, duplicateOf: C } }), 'r', null, now);
    expect(o).toMatchObject({ asset_id: A, ownership_status: 'duplicate_program', duplicate_of: C, reviewer: 'r', updated_at: now });
  });
  it('merges over an existing override', () => {
    const o = buildOverride(allOk({ availability: { agrees: false, partnership: 'partnered' } }), 'r2', { asset_id: A, ownership_status: 'licensee', note: 'old' }, now);
    expect(o).toMatchObject({ ownership_status: 'licensee', partnership_status: 'partnered', note: 'old', reviewer: 'r2' });
  });
});
