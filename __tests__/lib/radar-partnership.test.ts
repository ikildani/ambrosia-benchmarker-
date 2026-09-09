/**
 * Unit tests for lib/radar/partnership.ts (pure derivation, asset-name
 * matcher, territory algebra, reconciliation) and the press-release
 * classifier / mention resolver in lib/ingestion/press-releases.ts.
 * No Supabase.
 */

import {
  TERRITORIES,
  classifyOwnerType,
  codeTokens,
  companyKey,
  dealTerritoryScope,
  derivePartnership,
  extractCounterparty,
  isEligibleDeal,
  matchAssetName,
  nameSegments,
  pressMentionsAsset,
  reconcilePartnership,
  sameCompany,
  territoryAlgebra,
  territoryScopeFromLabel,
  type PartnershipAsset,
  type PartnershipDeal,
  type PressHit,
} from '@/lib/radar/partnership';

import {
  buildCompanyMentionIndex,
  classifyPressRelease,
  pressItemToRow,
  resolveCompanyMentions,
} from '@/lib/ingestion/press-releases';

const ACME_ID = '11111111-1111-1111-1111-111111111111';
const BIGPHARMA_ID = '22222222-2222-2222-2222-222222222222';

function asset(overrides: Partial<PartnershipAsset> = {}): PartnershipAsset {
  return {
    id: 'asset-1',
    company_id: ACME_ID,
    company_name: 'Acme Therapeutics',
    company_name_variations: ['Acme Therapeutics, Inc.', 'Acme'],
    asset_name: 'ACM-101',
    asset_aliases: ['acmelizumab'],
    nct_ids: ['NCT01234567'],
    ...overrides,
  };
}

function deal(overrides: Partial<PartnershipDeal> = {}): PartnershipDeal {
  return {
    id: 'deal-1',
    licensor_id: ACME_ID,
    licensor_name: 'Acme Therapeutics',
    licensee_id: BIGPHARMA_ID,
    licensee_name: 'BigPharma AG',
    asset_name: 'ACM-101',
    territory: 'global',
    territories_included: [],
    deal_type: 'license',
    deal_status: 'active',
    exclusivity: 'exclusive',
    announced_date: '2026-03-01',
    source_url: 'https://example.com/deal',
    verification_status: 'verified',
    is_synthetic: false,
    is_canonical: true,
    ...overrides,
  };
}

function derive(args: { deals?: PartnershipDeal[]; collaborators?: { nct_id: string; collaborator_name: string; collaborator_class?: string | null }[]; press?: PressHit[]; a?: Partial<PartnershipAsset> }) {
  return derivePartnership({
    asset: asset(args.a),
    deals: args.deals ?? [],
    trialCollaborators: args.collaborators ?? [],
    pressHits: args.press ?? [],
  });
}

// ═══════════════════════════════════════════════════════════════════════
// derivePartnership
// ═══════════════════════════════════════════════════════════════════════

describe('derivePartnership', () => {
  it('global deal -> partnered, nothing available, deal evidence, high confidence', () => {
    const r = derive({ deals: [deal()] });
    expect(r.status).toBe('partnered');
    expect(r.territoriesGranted).toEqual([...TERRITORIES]);
    expect(r.territoriesAvailable).toEqual([]);
    expect(r.partnerCompanyName).toBe('BigPharma AG');
    expect(r.partnerCompanyId).toBe(BIGPHARMA_ID);
    expect(r.dealIds).toEqual(['deal-1']);
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0]).toMatchObject({ type: 'deal', id: 'deal-1', url: 'https://example.com/deal', date: '2026-03-01' });
    expect(r.confidence).toBeGreaterThanOrEqual(80);
  });

  it('worldwide spelled out and acquisition both mean global', () => {
    expect(derive({ deals: [deal({ territory: 'Worldwide' })] }).status).toBe('partnered');
    expect(derive({ deals: [deal({ territory: null, deal_type: 'acquisition' })] }).status).toBe('partnered');
  });

  it('us_only deal -> partially partnered with eu/japan/china/row available', () => {
    const r = derive({ deals: [deal({ territory: 'us_only' })] });
    expect(r.status).toBe('partially_partnered');
    expect(r.territoriesGranted).toEqual(['us']);
    expect(r.territoriesAvailable).toEqual(['eu', 'japan', 'china', 'row']);
    expect(r.confidence).toBeGreaterThanOrEqual(80);
  });

  it('ex_us deal -> only the US is available', () => {
    const r = derive({ deals: [deal({ territory: 'ex_us' })] });
    expect(r.status).toBe('partially_partnered');
    expect(r.territoriesAvailable).toEqual(['us']);
    expect(r.territoriesGranted).toEqual(['eu', 'japan', 'china', 'row']);
  });

  it('two regional deals union into full coverage', () => {
    const r = derive({ deals: [deal({ id: 'd1', territory: 'us_only' }), deal({ id: 'd2', territory: 'ex-US', licensee_name: 'Nippon KK' })] });
    expect(r.status).toBe('partnered');
    expect(r.territoriesAvailable).toEqual([]);
    expect(r.dealIds.sort()).toEqual(['d1', 'd2']);
  });

  it('territories_included is unioned with territory', () => {
    const r = derive({ deals: [deal({ territory: 'regional', territories_included: ['japan', 'Greater China'] })] });
    expect(r.status).toBe('partially_partnered');
    expect(r.territoriesGranted).toEqual(['japan', 'china']);
    expect(r.territoriesAvailable).toEqual(['us', 'eu', 'row']);
  });

  it('undisclosed territory is assumed worldwide at reduced confidence', () => {
    const r = derive({ deals: [deal({ territory: null, territories_included: null })] });
    expect(r.status).toBe('partnered');
    expect(r.confidence).toBeLessThanOrEqual(65);
    expect(r.evidence[0].note).toMatch(/assumed worldwide/);
  });

  it('in-licensed deal (company is the licensee) is ignored', () => {
    const r = derive({
      deals: [deal({ licensor_id: BIGPHARMA_ID, licensor_name: 'BigPharma AG', licensee_id: ACME_ID, licensee_name: 'Acme Therapeutics' })],
    });
    expect(r.status).toBe('unpartnered');
    expect(r.evidence).toHaveLength(0);
    expect(r.territoriesAvailable).toEqual(['global']);
  });

  it("another company's deal on a same-named asset is ignored", () => {
    const r = derive({ deals: [deal({ licensor_id: '33333333-3333-3333-3333-333333333333', licensor_name: 'Other Bio' })] });
    expect(r.status).toBe('unpartnered');
  });

  it('licensor matched by name variation when licensor_id is missing', () => {
    const r = derive({ deals: [deal({ licensor_id: null, licensor_name: 'Acme Therapeutics, Inc.' })] });
    expect(r.status).toBe('partnered');
  });

  it('deal on a different asset of the same company does not match', () => {
    const r = derive({ deals: [deal({ asset_name: 'ACM-202' })] });
    expect(r.status).toBe('unpartnered');
  });

  it('rejected, flagged, synthetic and non-canonical deals never count', () => {
    expect(derive({ deals: [deal({ verification_status: 'rejected' })] }).status).toBe('unpartnered');
    expect(derive({ deals: [deal({ verification_status: 'flagged' })] }).status).toBe('unpartnered');
    expect(derive({ deals: [deal({ is_synthetic: true })] }).status).toBe('unpartnered');
    expect(derive({ deals: [deal({ is_canonical: false })] }).status).toBe('unpartnered');
    expect(isEligibleDeal(deal({ verification_status: null, is_canonical: null, is_synthetic: null }))).toBe(true);
  });

  it('terminated deal: rights reverted, evidence kept, no grant', () => {
    const r = derive({ deals: [deal({ deal_status: 'terminated' })] });
    expect(r.status).toBe('unpartnered');
    expect(r.dealIds).toEqual([]);
    expect(r.evidence[0].note).toMatch(/rights reverted/);
  });

  it('non-exclusive licence leaves rights available', () => {
    const r = derive({ deals: [deal({ exclusivity: 'non_exclusive' })] });
    expect(r.status).toBe('partially_partnered');
    expect(r.territoriesGranted).toEqual([]);
    expect(r.territoriesAvailable).toEqual(['global']);
    expect(r.confidence).toBeLessThanOrEqual(60);
  });

  it('industry trial collaborator -> partially partnered, confidence <= 60, NCT evidence', () => {
    const r = derive({ collaborators: [{ nct_id: 'NCT01234567', collaborator_name: 'BigPharma AG' }] });
    expect(r.status).toBe('partially_partnered');
    expect(r.confidence).toBeLessThanOrEqual(60);
    expect(r.partnerCompanyName).toBe('BigPharma AG');
    expect(r.evidence[0]).toMatchObject({ type: 'trial_collaborator', id: 'NCT01234567', url: 'https://clinicaltrials.gov/study/NCT01234567' });
    expect(r.territoriesAvailable).toEqual(['global']);
  });

  it('academic, hospital, government and foundation collaborators do not count', () => {
    const r = derive({
      collaborators: [
        { nct_id: 'NCT01234567', collaborator_name: 'University of Oxford' },
        { nct_id: 'NCT01234567', collaborator_name: 'Massachusetts General Hospital' },
        { nct_id: 'NCT01234567', collaborator_name: 'National Cancer Institute (NCI)' },
        { nct_id: 'NCT01234567', collaborator_name: 'Cystic Fibrosis Foundation' },
        { nct_id: 'NCT01234567', collaborator_name: 'Children\'s Oncology Group', collaborator_class: 'NETWORK' },
      ],
    });
    expect(r.status).toBe('unpartnered');
    expect(r.evidence).toHaveLength(0);
  });

  it('the owning company listed as its own collaborator does not count', () => {
    const r = derive({ collaborators: [{ nct_id: 'NCT01234567', collaborator_name: 'Acme Therapeutics, Inc.' }] });
    expect(r.status).toBe('unpartnered');
  });

  it('press hit only -> partially partnered, confidence <= 70, counterparty from headline', () => {
    const r = derive({
      press: [{
        id: 'pr-1',
        headline: 'Acme Therapeutics and BigPharma AG Announce Exclusive License Agreement for ACM-101',
        body_text: 'Under the agreement BigPharma receives global rights to ACM-101.',
        published_at: '2026-05-01T12:00:00Z',
        source_url: 'https://example.com/pr',
        companies_mentioned: ['Acme Therapeutics'],
        company_ids: [ACME_ID],
      }],
    });
    expect(r.status).toBe('partially_partnered');
    expect(r.confidence).toBeLessThanOrEqual(70);
    expect(r.partnerCompanyName).toBe('BigPharma AG');
    expect(r.evidence[0]).toMatchObject({ type: 'press_release', id: 'pr-1', url: 'https://example.com/pr', date: '2026-05-01' });
  });

  it('press hit uses the canonical co-mentioned company as counterparty', () => {
    const r = derive({
      press: [{
        id: 'pr-2',
        headline: 'Acme Therapeutics enters licensing agreement for acmelizumab',
        published_at: '2026-05-01',
        companies_mentioned: ['Acme Therapeutics', 'BigPharma'],
        company_ids: [ACME_ID, BIGPHARMA_ID],
      }],
    });
    expect(r.partnerCompanyName).toBe('BigPharma');
    expect(r.partnerCompanyId).toBe(BIGPHARMA_ID);
  });

  it('press releases that do not name the asset or lack licensing language are ignored', () => {
    const r = derive({
      press: [
        { id: 'pr-3', headline: 'Acme Therapeutics Announces Exclusive License Agreement for ACM-999', published_at: '2026-05-01', companies_mentioned: ['Acme Therapeutics'] },
        { id: 'pr-4', headline: 'Acme Therapeutics presents ACM-101 data at ASCO', published_at: '2026-05-01', companies_mentioned: ['Acme Therapeutics'] },
      ],
    });
    expect(r.status).toBe('unpartnered');
  });

  it('deal evidence dominates soft signals in status and confidence', () => {
    const r = derive({
      deals: [deal({ territory: 'us_only' })],
      collaborators: [{ nct_id: 'NCT01234567', collaborator_name: 'BigPharma AG' }],
    });
    expect(r.status).toBe('partially_partnered');
    expect(r.confidence).toBeGreaterThanOrEqual(80);
    expect(r.evidence.map(e => e.type).sort()).toEqual(['deal', 'trial_collaborator']);
  });

  it('unpartnered confidence is higher when the company has deals in the table at all', () => {
    const none = derive({});
    const covered = derive({ deals: [deal({ asset_name: 'ACM-202' })] });
    expect(none.status).toBe('unpartnered');
    expect(covered.confidence).toBeGreaterThan(none.confidence);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// reconcilePartnership (never downgrade deal-confirmed)
// ═══════════════════════════════════════════════════════════════════════

describe('reconcilePartnership', () => {
  const dealConfirmedExisting = {
    partnership_status: 'partnered',
    partner_company_name: 'BigPharma AG',
    partner_company_id: BIGPHARMA_ID,
    territory_rights_available: [] as string[],
    partnership_evidence: [{ type: 'deal' as const, id: 'deal-1', note: 'license with BigPharma AG: worldwide rights' }],
    partnership_confidence: 90,
    deal_ids: ['deal-1'],
  };

  it('deal-confirmed partnered is never downgraded when the new run has only soft evidence', () => {
    const derived = derive({ collaborators: [{ nct_id: 'NCT01234567', collaborator_name: 'Other Pharma' }] });
    expect(derived.status).toBe('partially_partnered');
    const r = reconcilePartnership(dealConfirmedExisting, derived);
    expect(r.status).toBe('partnered');
    expect(r.partnerCompanyName).toBe('BigPharma AG');
    expect(r.dealIds).toEqual(['deal-1']);
    expect(r.evidence.map(e => e.type)).toEqual(['deal', 'trial_collaborator']);
    expect(r.confidence).toBe(90);
  });

  it('deal-confirmed partnered is never downgraded to unpartnered', () => {
    const r = reconcilePartnership(dealConfirmedExisting, derive({}));
    expect(r.status).toBe('partnered');
  });

  it('new deal evidence (e.g. termination) may change the status', () => {
    const derived = derive({ deals: [deal({ deal_status: 'terminated' })] });
    expect(derived.status).toBe('unpartnered');
    // derived has no active deal ids, but carries deal evidence -> still protected
    const r = reconcilePartnership(dealConfirmedExisting, derived);
    expect(r.status).toBe('partnered');
    // whereas an active regional deal re-derivation wins
    const regional = derive({ deals: [deal({ territory: 'us_only' })] });
    expect(reconcilePartnership(dealConfirmedExisting, regional).status).toBe('partially_partnered');
  });

  it('legacy indexer rows without an evidence array are re-evaluated strictly', () => {
    const legacy = { ...dealConfirmedExisting, partnership_evidence: null, deal_ids: ['legacy-deal'] };
    const r = reconcilePartnership(legacy, derive({}));
    expect(r.status).toBe('unpartnered');
  });

  it('upgrades always pass through', () => {
    const existing = { ...dealConfirmedExisting, partnership_status: 'partially_partnered' };
    const r = reconcilePartnership(existing, derive({ deals: [deal()] }));
    expect(r.status).toBe('partnered');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Asset-name matcher
// ═══════════════════════════════════════════════════════════════════════

describe('matchAssetName', () => {
  it('normalized equality', () => {
    expect(matchAssetName(['ACM-101'], 'acm 101')).toBe('exact');
    expect(matchAssetName(['Acmelizumab'], 'ACMELIZUMAB')).toBe('exact');
  });

  it('code-name token inside a longer deal asset string', () => {
    expect(matchAssetName(['MK-3475'], 'Pembrolizumab (MK-3475)')).toBe('exact'); // parenthetical is its own segment
    expect(matchAssetName(['MK-3475'], 'Pembrolizumab MK-3475 injection')).toBe('code');
    expect(matchAssetName(['MK-3475'], 'pembrolizumab mk 3475')).toBe('code');
    expect(matchAssetName(['pembrolizumab'], 'MK-3475 (pembrolizumab)')).toBe('exact');
    expect(matchAssetName(['BNT162b2'], 'BNT162b2 and BNT162b1')).toBe('exact');
    expect(matchAssetName(['DS-8201a'], 'DS8201a')).toBe('exact');
  });

  it('never substring-matches short names', () => {
    expect(matchAssetName(['ABC'], 'ABC-123')).toBeNull();
    expect(matchAssetName(['ACM-101'], 'ACM-1010')).toBeNull();
    expect(matchAssetName(['ACM-101'], 'ACM-102')).toBeNull();
    expect(matchAssetName(['AB'], 'AB-123 program')).toBeNull();
    expect(matchAssetName(['IL-2'], 'IL-2 fusion protein XYZ-9')).toBeNull();
  });

  it('token overlap >= 0.8 with a strong shared token', () => {
    expect(matchAssetName(['olaparib'], 'olaparib tablets')).toBe('overlap'); // dosage form is a stopword
    expect(matchAssetName(['anti-CD47 antibody ALX-148'], 'ALX-148 anti-CD47 antibody')).toBe('code');
    expect(matchAssetName(['tirzepatide injection'], 'tirzepatide')).toBe('overlap');
    expect(matchAssetName(['alpha beta gamma delta eta'], 'alpha beta gamma delta theta')).toBe('overlap'); // 4/5
    expect(matchAssetName(['alpha beta gamma delta'], 'alpha beta gamma epsilon')).toBeNull(); // 3/4 < 0.8
    expect(matchAssetName(['drug alpha beta'], 'drug alpha gamma')).toBeNull();
  });

  it('aliases participate', () => {
    expect(matchAssetName(['ACM-101', 'acmelizumab'], 'Acmelizumab')).toBe('exact');
  });

  it('nameSegments splits parentheticals and lists', () => {
    expect(nameSegments('Pembrolizumab (MK-3475)')).toEqual(['Pembrolizumab', 'MK-3475']);
    expect(nameSegments('ABC-123 and ABC-456')).toEqual(['ABC-123', 'ABC-456']);
  });

  it('codeTokens', () => {
    expect([...codeTokens('MK-3475')]).toEqual(['mk3475']);
    expect([...codeTokens('AZD 1222')]).toEqual(['azd1222']);
    expect([...codeTokens('Phase 2 study')]).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Territory algebra
// ═══════════════════════════════════════════════════════════════════════

describe('territory algebra', () => {
  it('label mapping', () => {
    expect(territoryScopeFromLabel('global')).toEqual({ scope: 'global' });
    expect(territoryScopeFromLabel('Worldwide')).toEqual({ scope: 'global' });
    expect(territoryScopeFromLabel('us_only')).toEqual({ scope: 'regions', regions: ['us'] });
    expect(territoryScopeFromLabel('U.S.')).toEqual({ scope: 'regions', regions: ['us'] });
    expect(territoryScopeFromLabel('ex_us')).toEqual({ scope: 'regions', regions: ['eu', 'japan', 'china', 'row'] });
    expect(territoryScopeFromLabel('ex-China')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan', 'row'] });
    expect(territoryScopeFromLabel('greater_china')).toEqual({ scope: 'regions', regions: ['china'] });
    expect(territoryScopeFromLabel('europe')).toEqual({ scope: 'regions', regions: ['eu'] });
    expect(territoryScopeFromLabel('north_america')).toEqual({ scope: 'regions', regions: ['us'] });
    expect(territoryScopeFromLabel('asia')).toEqual({ scope: 'regions', regions: ['china', 'japan', 'row'] });
    expect(territoryScopeFromLabel('us_eu_japan')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan'] });
    expect(territoryScopeFromLabel('South Korea')).toEqual({ scope: 'regions', regions: ['row'] });
    expect(territoryScopeFromLabel('regional')).toEqual({ scope: 'regional_unknown' });
    // free-text values actually present in the deals table
    expect(territoryScopeFromLabel('global (ex-China)')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan', 'row'] });
    expect(territoryScopeFromLabel('global ex-Greater China')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan', 'row'] });
    expect(territoryScopeFromLabel('global excluding Japan')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'china', 'row'] });
    expect(territoryScopeFromLabel('global excluding South Korea')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan', 'china'] });
    expect(territoryScopeFromLabel('global excluding cardiovascular complications in end-stage kidney disease')).toEqual({ scope: 'global' });
    expect(territoryScopeFromLabel('outside Greater China')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan', 'row'] });
    expect(territoryScopeFromLabel('Lilly: worldwide/ex-China; Haisco: China/HK/Macau/Taiwan')).toEqual({ scope: 'regions', regions: ['us', 'eu', 'japan', 'row'] });
    expect(territoryScopeFromLabel('Latin America/Caribbean')).toEqual({ scope: 'regions', regions: ['row'] });
    expect(territoryScopeFromLabel('120 high-incidence resource-limited countries')).toEqual({ scope: 'regions', regions: ['row'] });
    expect(territoryScopeFromLabel('Mainland China')).toEqual({ scope: 'regions', regions: ['china'] });
    expect(territoryScopeFromLabel('us and europe (50/50); ex-US/Europe by Roche')).toEqual({ scope: 'regions', regions: ['us', 'eu'] });
    expect(territoryScopeFromLabel('')).toEqual({ scope: 'unknown' });
    expect(territoryScopeFromLabel(null)).toEqual({ scope: 'unknown' });
  });

  it('dealTerritoryScope unions territory and territories_included', () => {
    expect(dealTerritoryScope({ territory: 'us', territories_included: ['japan'] })).toEqual({ scope: 'regions', regions: ['us', 'japan'] });
    expect(dealTerritoryScope({ territory: 'us', territories_included: ['global'] })).toEqual({ scope: 'global' });
    expect(dealTerritoryScope({ territory: null, territories_included: [] })).toEqual({ scope: 'unknown' });
    expect(dealTerritoryScope({ territory: null, deal_type: 'acquisition' })).toEqual({ scope: 'global' });
  });

  it('territoryAlgebra: available = all - granted', () => {
    expect(territoryAlgebra([])).toEqual({ coverage: 'none', granted: [], available: ['global'] });
    expect(territoryAlgebra(['us'])).toEqual({ coverage: 'partial', granted: ['us'], available: ['eu', 'japan', 'china', 'row'] });
    expect(territoryAlgebra(['eu', 'japan', 'china', 'row'])).toEqual({ coverage: 'partial', granted: ['eu', 'japan', 'china', 'row'], available: ['us'] });
    expect(territoryAlgebra([...TERRITORIES])).toEqual({ coverage: 'full', granted: [...TERRITORIES], available: [] });
    expect(territoryAlgebra(['us', 'us', 'japan'])).toEqual({ coverage: 'partial', granted: ['us', 'japan'], available: ['eu', 'china', 'row'] });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Company / owner-type helpers
// ═══════════════════════════════════════════════════════════════════════

describe('company helpers', () => {
  it('companyKey strips legal suffixes only', () => {
    expect(companyKey('Pfizer Inc.')).toBe('pfizer');
    expect(companyKey('Merck & Co., Inc.')).toBe('merck');
    expect(companyKey('Acme Therapeutics, Inc.')).toBe('acmetherapeutics');
  });

  it('sameCompany is suffix-insensitive but never substring', () => {
    expect(sameCompany('Acme Therapeutics', 'Acme Therapeutics, Inc.')).toBe(true);
    expect(sameCompany('Genmab A/S', 'Genmab')).toBe(true);
    expect(sameCompany('Acme Therapeutics', 'Acme Pharmaceuticals')).toBe(false);
    expect(sameCompany('Novartis', 'Novartis Gene Therapies')).toBe(false);
    expect(sameCompany('Moderna, Inc.', 'Moderna Therapeutics')).toBe(true);
  });

  it('classifyOwnerType', () => {
    expect(classifyOwnerType('University of Oxford')).toBe('academic');
    expect(classifyOwnerType('Institut Curie')).toBe('academic');
    expect(classifyOwnerType('Mayo Clinic')).toBe('hospital');
    expect(classifyOwnerType('National Institutes of Health (NIH)')).toBe('government');
    expect(classifyOwnerType('Bill & Melinda Gates Foundation')).toBe('nonprofit');
    expect(classifyOwnerType('Alliance for Clinical Trials in Oncology')).toBe('nonprofit');
    expect(classifyOwnerType('Roche')).toBe('industry');
    expect(classifyOwnerType('Hospira Inc')).toBe('industry');
    expect(classifyOwnerType('Whatever Name', 'INDUSTRY')).toBe('industry');
    expect(classifyOwnerType('Some Sponsor', 'NIH')).toBe('government');
  });

  it('extractCounterparty from headline patterns', () => {
    const owner = ['Acme Therapeutics'];
    expect(extractCounterparty('Acme Therapeutics and BigPharma AG Announce Exclusive License Agreement', owner)).toBe('BigPharma AG');
    expect(extractCounterparty('BigPharma AG Licenses ACM-101 from Acme Therapeutics', owner)).toBe('BigPharma AG');
    expect(extractCounterparty('Acme Therapeutics Enters Into Global Licensing Agreement with Nippon Shinyaku', owner)).toBe('Nippon Shinyaku');
    expect(extractCounterparty('Acme Therapeutics Announces ACM-101 Data', owner)).toBeNull();
    expect(extractCounterparty('Acme Therapeutics and BigPharma AG announce exclusive license agreement for the development of ACM-101', owner)).toBe('BigPharma AG');
    expect(extractCounterparty('Acme Therapeutics Signs Agreement with Nippon Shinyaku for the development of ACM-101', owner)).toBe('Nippon Shinyaku');
    expect(extractCounterparty('Anything', owner, ['Acme Therapeutics', 'Roche'])).toBe('Roche');
  });

  it('pressMentionsAsset requires a word-boundary name or a code token', () => {
    expect(pressMentionsAsset('data for ACM-101 in NSCLC', ['ACM-101'])).toBe(true);
    expect(pressMentionsAsset('data for ACM 101 in NSCLC', ['ACM-101'])).toBe(true);
    expect(pressMentionsAsset('data for ACM-1010 in NSCLC', ['ACM-101'])).toBe(false);
    expect(pressMentionsAsset('acmelizumab shows benefit', ['ACM-101', 'acmelizumab'])).toBe(true);
    expect(pressMentionsAsset('nothing relevant', ['ACM-101'])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Press-release classifier and mention resolver
// ═══════════════════════════════════════════════════════════════════════

describe('press-release classifier', () => {
  it('licensing and m&a', () => {
    expect(classifyPressRelease('Acme and BigPharma Announce Exclusive License Agreement for ACM-101')).toContain('licensing');
    expect(classifyPressRelease('BigPharma to Acquire Acme Therapeutics for $2.1 Billion')).toContain('m&a');
    expect(classifyPressRelease('BigPharma to Acquire Acme Therapeutics for $2.1 Billion')).not.toContain('licensing');
  });

  it('financing, clinical, regulatory', () => {
    expect(classifyPressRelease('Acme Raises $120 Million Series B Financing')).toContain('financing');
    expect(classifyPressRelease('Acme Reports Positive Topline Phase 2 Results for ACM-101')).toContain('clinical');
    expect(classifyPressRelease('FDA Grants Breakthrough Therapy Designation to ACM-101')).toContain('regulatory');
  });

  it('executive_hire, conference, layoffs, strategic_review', () => {
    expect(classifyPressRelease('Acme Appoints Jane Doe as Chief Business Officer')).toContain('executive_hire');
    expect(classifyPressRelease('Acme to Present ACM-101 Data at ASCO 2026 Annual Meeting')).toContain('conference');
    expect(classifyPressRelease('Acme Announces Workforce Reduction and Pipeline Prioritization')).toContain('layoffs');
    expect(classifyPressRelease('Acme Initiates Review of Strategic Alternatives')).toContain('strategic_review');
  });

  it('returns an empty list for unrelated items', () => {
    expect(classifyPressRelease('Acme Publishes Sustainability Report')).toEqual([]);
  });

  it('resolves canonical company names case-insensitively via name and variations', () => {
    const index = buildCompanyMentionIndex([
      { id: ACME_ID, name: 'Acme Therapeutics', name_variations: ['Acme Therapeutics, Inc.', 'ACME'] },
      { id: BIGPHARMA_ID, name: 'BigPharma AG', name_variations: [] },
      { id: '44444444-4444-4444-4444-444444444444', name: 'Global Health Pharma', name_variations: ['Global'] },
    ]);
    const r = resolveCompanyMentions('ACME THERAPEUTICS, INC. and bigpharma ag announce a global deal', index);
    expect(r.names).toEqual(expect.arrayContaining(['Acme Therapeutics', 'BigPharma AG']));
    expect(r.ids).toEqual(expect.arrayContaining([ACME_ID, BIGPHARMA_ID]));
    expect(r.names).toHaveLength(2); // generic 'Global' never matches
    expect(resolveCompanyMentions('Acmeatron reports results', index).names).toEqual([]); // word boundary
  });

  it('pressItemToRow builds a canonical row', () => {
    const index = buildCompanyMentionIndex([{ id: ACME_ID, name: 'Acme Therapeutics', name_variations: [] }]);
    const row = pressItemToRow(
      {
        title: 'Acme Therapeutics Announces Exclusive License Agreement for ACM-101',
        link: 'https://www.globenewswire.com/news-release/2026/09/01/1/0/en/acme.html',
        description: 'Acme grants BigPharma worldwide rights.',
        pubDate: 'Tue, 01 Sep 2026 12:00:00 GMT',
        source: 'GlobeNewswire_Licensing',
        guid: 'guid-1',
      },
      { name: 'GlobeNewswire_Licensing', family: 'globenewswire' },
      index,
    );
    expect(row.source).toBe('globenewswire');
    expect(row.feed).toBe('GlobeNewswire_Licensing');
    expect(row.source_url).toBe('https://www.globenewswire.com/news-release/2026/09/01/1/0/en/acme.html');
    expect(row.published_at).toBe('2026-09-01T12:00:00.000Z');
    expect(row.companies_mentioned).toEqual(['Acme Therapeutics']);
    expect(row.company_ids).toEqual([ACME_ID]);
    expect(row.categories).toContain('licensing');
    expect(row.is_deal_announcement).toBe(true);
    expect(row.content_hash).toHaveLength(40);
  });

  it('pressItemToRow falls back to a hash URN when the item has no link', () => {
    const index = buildCompanyMentionIndex([]);
    const row = pressItemToRow(
      { title: 'No link item', link: '', description: '', pubDate: 'garbage', source: 'X', guid: '' },
      { name: 'X', family: 'other' },
      index,
      { now: new Date('2026-09-08T00:00:00Z') },
    );
    expect(row.source_url).toMatch(/^urn:press:[0-9a-f]{40}$/);
    expect(row.published_at).toBe('2026-09-08T00:00:00.000Z');
  });
});
