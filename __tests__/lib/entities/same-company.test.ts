import { sameCompanyParts, isDistinctiveStem, isSameCompanyName, isInstitutional, planSameCompanyMerges, SAME_COMPANY_REASON } from '@/lib/entities/same-company';
import type { MergeCompanyRow } from '@/lib/entities/merge';

const row = (id: string, name: string, extra: Partial<MergeCompanyRow> = {}): MergeCompanyRow => ({
  id, name, name_variations: [name], company_type: null, owner_type: 'industry', hq_country: null, hq_region: null, ticker: null, cik: null, sec_cik: null,
  website_url: null, data_quality_score: 0, total_annual_revenue: null, deals_last_24mo: 0, merged_into: null, ...extra,
});

describe('sameCompanyParts', () => {
  it('strips legal forms and descriptors to a stem', () => {
    expect(sameCompanyParts('Regeneron Pharmaceuticals, Inc.')).toMatchObject({ stem: 'regeneron', descriptors: ['pharma'], classes: ['pharma'], affiliate: false, excluded: null });
    expect(sameCompanyParts('Regeneron').stem).toBe('regeneron');
    expect(sameCompanyParts('Allogene Therapeutics')).toMatchObject({ stem: 'allogene', classes: ['thera'] });
  });

  it('removes Chinese region prefixes and national-affiliate words', () => {
    expect(sameCompanyParts('Jiangsu Hansoh Pharmaceutical Co., Ltd.')).toMatchObject({ stem: 'hansoh', classes: ['pharma'] });
    expect(sameCompanyParts('Hansoh Pharma')).toMatchObject({ stem: 'hansoh', classes: ['pharma'] });
    expect(sameCompanyParts('Eli Lilly Canada Inc')).toMatchObject({ stem: 'eli lilly', affiliate: true });
    expect(sameCompanyParts('Kyowa Kirin China Pharmaceutical Co., Ltd.')).toMatchObject({ stem: 'kyowa kirin', affiliate: true, classes: ['pharma'] });
    expect(sameCompanyParts('Everest Medicines (Singapore) Pte. Ltd.')).toMatchObject({ stem: 'everest', affiliate: true, descriptors: ['medicines'] });
    expect(sameCompanyParts('Pfizer Inc. (USA)')).toMatchObject({ stem: 'pfizer', affiliate: true });
  });

  it('marks division and subsidiary rows as excluded and odd parentheticals as tagged', () => {
    expect(sameCompanyParts('Pfizer Oncology').excluded).toBe('division');
    expect(sameCompanyParts('Amgen Research (Munich) GmbH').excluded).toBe('division');
    expect(sameCompanyParts('Recordati (Enjaymo)').tagged).toEqual(['enjaymo']);
    expect(sameCompanyParts('Acadia (Proprietary)').tagged).toEqual(['proprietary']);
    // A parent tag or a protocol code is not a distinguishing tag.
    expect(sameCompanyParts('Janssen (J&J)')).toMatchObject({ stem: 'janssen', tagged: [] });
    expect(sameCompanyParts('Roche Products Limited (UK) (ref: MO21781)')).toMatchObject({ stem: 'roche', tagged: [], affiliate: true });
  });

  it('a name that is only a descriptor has no stem', () => {
    expect(sameCompanyParts('Pharma').stem).toBe('');
    expect(sameCompanyParts('Bio Group').stem).toBe('');
  });
});

describe('isSameCompanyName', () => {
  it.each([
    ['Regeneron', 'Regeneron Pharmaceuticals, Inc.'],
    ['Allogene', 'Allogene Therapeutics'],
    ['Hansoh Pharma', 'Jiangsu Hansoh Pharmaceutical Co., Ltd.'],
    ['Chiesi', 'Chiesi Farmaceutici'],
    ['Chiesi Group', 'Chiesi'],
    ['Centessa', 'Centessa Pharmaceuticals'],
    ['MacroGenics', 'MacroGenics, Inc.'],
    ['Mitsubishi Tanabe', 'Mitsubishi Tanabe Pharma'],
    ['Everest Medicines', 'Everest Medicines (Beijing) Co., Ltd.'],
    ['Harbour BioMed', 'Harbour BioMed US, Inc.'],
    ['Pfizer', 'Pfizer Canada Inc'],
    ['Lantheus Holdings', 'Lantheus'],
    ['Sun Pharma', 'Sun Pharmaceutical'],
    ['Roche', 'Roche Pharmaceuticals (UK)'],
    ['Gracell Biotechnologies', 'Gracell Biotechnology LTD'],
    ['Immune Response BioPharma, Inc.', 'The Immune Response Corporation'],
    ['University of Oxford', 'University of Oxford (UK)'],
    ['Karolinska Institutet', 'Karolinska Institutet (Sweden)'],
    ['Health Protection Agency (HPA) (UK)', 'Health Protection Agency (HPA)'],
    ['Academic Medical Center (AMC) (The Netherlands)', 'Academic Medical Center'],
    ['University of the Basque Country (UPV/EHU)', 'University of the Basque Country'],
    ['Novo Nordisk Limited (UK & Ireland)', 'Novo Nordisk'],
    ['Sanofi Aventis South Africa (Pty) Ltd (South Africa)', 'Sanofi Aventis'],
    ['Moberg Pharma AB (publ)', 'Moberg Pharma'],
  ])('%s is %s', (a, b) => {
    expect(isSameCompanyName(a, b)).toBe(true);
  });

  it.each([
    ['Arbor Pharmaceuticals, Inc.', 'Arbor Biotechnologies'],
    ['Alpha Biopharma (Jiangsu) Co., Ltd.', 'Alpha Pharma'],
    ['Boston Therapeutics', 'Boston Pharmaceuticals Inc'],
    ['Hope Medicine', 'Hope Biosciences LLC'],
    ['Forward Pharmaceuticals Co., Ltd.', 'Forward Therapeutics Inc.'],
    ['Arrowhead Pharmaceuticals', 'Arrowhead Therapeutics'],
    ['Pfizer', 'Pfizer Oncology'],
    ['Kite Pharma', 'Gilead Sciences'],
    ['Recordati', 'Recordati (Enjaymo)'],
    ['JW Therapeutics', 'JW Pharmaceutical'],
    ['Merck', 'Merck KGaA'],
    ['Orphan Medical', 'Orphan Australia'],
    ['Formation Bio', 'Formation Biologics'],
    ['Odyssey Group International, Inc.', 'Odyssey Therapeutics'],
    ['Phenomix', 'Phenomix Sciences'],
    ['Aramis Biotechnologies Inc.', 'Aramis Biosciences, Inc.'],
    ['Vibrant Sciences Limited', 'Vibrant Ltd.'],
    ['Beijing Children\'s Hospital', 'Shanghai Children\'s Hospital'],
    ['Tabriz University', 'Tabriz University of Medical Sciences'],
    ['National Cancer Center, Korea', 'National Cancer Center, Japan'],
    ['Ministry of Health, Brazil', 'Ministry of Health, Spain'],
    ['Zhejiang University', 'The University of Hong Kong'],
    ['Shanghai Cell Therapy Group Co.,Ltd', 'Cell Therapy Limited'],
    ['Undisclosed European biotech company', 'Undisclosed'],
    ['Department of Health (UK)', 'Department of Health (Taiwan)'],
    ['Centers for Disease Control and Prevention', 'Centers for Disease Control and Prevention, China'],
    ['Malaria Consortium', 'Malaria Consortium, UK'],
    ['Summit Therapeutics', 'Summit (Oxford) Limited'],
    ['Cook Medical', 'Cook Medical (reproductive health business)'],
    ['Individual Sponsor (Denmark)', 'Individual Sponsor (Germany)'],
  ])('%s is not %s', (a, b) => {
    expect(isSameCompanyName(a, b)).toBe(false);
  });
});

describe('planSameCompanyMerges', () => {
  it('plans distinctive stems, keeps the best-populated row and unions aliases', () => {
    const rows = [
      row('a', 'Regeneron', { data_quality_score: 90, deals_last_24mo: 4 }),
      row('b', 'Regeneron Pharmaceuticals, Inc.', { data_quality_score: 20 }),
      row('c', 'Hansoh Pharma', { data_quality_score: 90, ticker: '3692.HK' }),
      row('d', 'Jiangsu Hansoh Pharmaceutical Co., Ltd.', { data_quality_score: 55 }),
      row('e', 'Hansoh Pharmaceutical', { data_quality_score: 40 }),
      row('f', 'Unrelated Biotech'),
    ];
    const r = planSameCompanyMerges(rows);
    expect(r.plans).toHaveLength(2);
    const regeneron = r.plans.find(p => p.canonicalId === 'a')!;
    expect(regeneron.merged.map(m => m.id)).toEqual(['b']);
    expect(regeneron.reason).toBe(SAME_COMPANY_REASON);
    expect(regeneron.aliasUnion).toEqual(expect.arrayContaining(['Regeneron', 'Regeneron Pharmaceuticals, Inc.']));
    const hansoh = r.plans.find(p => p.canonicalId === 'c')!;
    expect(hansoh.merged.map(m => m.id).sort()).toEqual(['d', 'e']);
    expect(r.stats.rowsToMerge).toBe(3);
  });

  it('sends descriptor-class disagreements and structured-id conflicts to review', () => {
    const rows = [
      row('a', 'Arrowhead Pharmaceuticals', { ticker: 'ARWR' }),
      row('b', 'Arrowhead Therapeutics'),
      row('c', 'Lantheus Holdings', { ticker: 'LNTH' }),
      row('d', 'Lantheus', { ticker: 'LNTH' }),
      row('e', 'Merck', { ticker: 'MRK' }),
      row('f', 'Merck Group', { ticker: 'MRK.DE' }),
    ];
    const r = planSameCompanyMerges(rows);
    expect(r.plans.map(p => p.canonicalId)).toEqual(['c']);
    expect(r.review.map(x => x.reason).sort()).toEqual(['descriptor_conflict', 'ticker_conflict']);
  });

  it('common-word stems merge only on identical descriptors', () => {
    const rows = [
      row('a', 'Everest Medicines', { data_quality_score: 55 }),
      row('b', 'Everest Medicines (China) Co.,Ltd.'),
      row('c', 'Everest Medicines (Singapore) Pte. Ltd.'),
      row('d', 'Everest Therapeutics'),
      row('e', 'Alpha Pharma'),
      row('f', 'Alpha Biopharma (Jiangsu) Co., Ltd.'),
    ];
    const r = planSameCompanyMerges(rows);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].canonicalId).toBe('a');
    expect(r.plans[0].merged.map(m => m.id).sort()).toEqual(['b', 'c']);
    expect(r.stats.affiliateRowsToMerge).toBe(2);
  });

  it('affiliates can be held back, and hand-checked groups are planned as given', () => {
    const rows = [row('a', 'Pfizer', { data_quality_score: 100 }), row('b', 'Pfizer Canada Inc'), row('c', 'Alpha Pharma', { data_quality_score: 60 }), row('d', 'Alpha Biopharma (Jiangsu) Co., Ltd.')];
    const held = planSameCompanyMerges(rows, { includeAffiliates: false });
    expect(held.plans).toHaveLength(0);
    expect(held.review[0].reason).toBe('affiliate');
    const extra = planSameCompanyMerges(rows, { includeAffiliates: false, extraGroups: [['c', 'd']] });
    expect(extra.plans).toHaveLength(1);
    expect(extra.plans[0].canonicalId).toBe('c');
    expect(extra.plans[0].merged[0].id).toBe('d');
  });

  it('never plans a row that carries a division marker or a tag', () => {
    const rows = [row('a', 'Pfizer', { data_quality_score: 100 }), row('b', 'Pfizer Oncology'), row('c', 'Pfizer (Proprietary)')];
    const r = planSameCompanyMerges(rows);
    expect(r.plans).toHaveLength(0);
  });

  it('ignores rows already folded', () => {
    const rows = [row('a', 'Regeneron'), row('b', 'Regeneron Pharmaceuticals', { merged_into: 'a' })];
    expect(planSameCompanyMerges(rows).plans).toHaveLength(0);
  });

  it('distinctive stems are five letters and not common words', () => {
    expect(isDistinctiveStem('regeneron')).toBe(true);
    expect(isDistinctiveStem('roche')).toBe(true);
    expect(isDistinctiveStem('everest')).toBe(false);
    expect(isDistinctiveStem('sun')).toBe(false);
    expect(isDistinctiveStem('kyowa kirin')).toBe(true);
  });

  it('institutions are recognised by owner_type or by name and keep every word', () => {
    expect(isInstitutional('Beijing Tongren Hospital', null)).toBe(true);
    expect(isInstitutional('Some Biotech', 'hospital')).toBe(true);
    expect(isInstitutional('Regeneron', 'industry')).toBe(false);
    expect(sameCompanyParts('Mount Sinai Hospital, Canada').stem).toBe('mount sinai hospital canada');
  });

  it('a national affiliate never becomes the canonical row when a parent-named row exists', () => {
    const rows = [row('a', 'Purdue Pharma (Canada)', { data_quality_score: 90 }), row('b', 'Purdue Pharma LP', { data_quality_score: 10 })];
    const r = planSameCompanyMerges(rows);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0].canonicalId).toBe('b');
  });

  it('institutions with different parenthetical countries go to review', () => {
    const rows = [row('a', 'Department of Health', { owner_type: 'government' }), row('b', 'Department of Health (UK)', { owner_type: 'government' }), row('c', 'Department of Health (Taiwan)', { owner_type: 'government' })];
    const r = planSameCompanyMerges(rows);
    expect(r.plans).toHaveLength(0);
    expect(r.review[0]?.reason).toBe('country_conflict');
    const ok = planSameCompanyMerges([row('a', 'University of Oxford', { owner_type: 'academic' }), row('b', 'University of Oxford (UK)', { owner_type: 'academic' })]);
    expect(ok.plans).toHaveLength(1);
  });

  it('a bracket-free name beats a better-populated tagged variant as canonical', () => {
    const rows = [row('a', 'Cartesian (Proprietary)', { data_quality_score: 90, deals_last_24mo: 5 }), row('b', 'Cartesian Therapeutics', { data_quality_score: 10 })];
    const r = planSameCompanyMerges(rows, { extraGroups: [['a', 'b']] });
    expect(r.plans[0].canonicalId).toBe('b');
  });

  it('different HQ countries among non-affiliate rows go to review', () => {
    const rows = [row('a', 'Progen Pharmaceuticals', { hq_country: 'Australia' }), row('b', 'ProGen Co., Ltd.', { hq_country: 'KR' })];
    const r = planSameCompanyMerges(rows);
    expect(r.plans).toHaveLength(0);
    expect(r.review[0]?.reason).toBe('country_conflict');
  });
});
