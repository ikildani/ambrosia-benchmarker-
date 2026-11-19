import {
  MODEL_MIN_CONFIDENCE,
  ModelAnswer,
  acquisitionProposal,
  brandGroups,
  buildReviewPrompt,
  cjkBrandBigrams,
  membersHash,
  parentPhrase,
  proposalsFromAnswer,
  type CodePair,
  type DomainMember,
  type FamilyCompany,
  type ReviewSubject,
} from '@/lib/entities/company-family';

const member = (id: string, name: string, extra: Partial<DomainMember> = {}): DomainMember => ({
  id, name, owner_type: 'industry', via: ['cde_contact_email'], trials: 1, ...extra,
});

describe('parentPhrase', () => {
  it.each([
    ['Kymab Ltd, A Sanofi Company', 'Sanofi'],
    ['Albireo, an Ipsen Company', 'Ipsen'],
    ['Juno Therapeutics, a Subsidiary of Celgene', 'Celgene'],
    ['Ajax Therapeutics, Inc., a wholly owned subsidiary of Eli Lilly and Company', 'Eli Lilly and Company'],
    ['Oncoethix GmbH, a subsidiary of Merck & Co., Inc. (Rahway, New Jersey USA)', 'Merck & Co., Inc'],
    ['Hospira, now a wholly owned subsidiary of Pfizer', 'Pfizer'],
    ['Corthera, Inc.(formerly BAS Medical, Inc.), a member of the Novartis group of companies', 'Novartis'],
    ['Baxalta now part of Shire', 'Shire'],
    ['OnTrack Therapeutics Limited (a wholly owned subsidiary of Pangea Botanica Ltd [trading as Pangea Bio])', 'Pangea Botanica Ltd'],
    ['CSPC NBP Pharmaceutical Co, Ltd, subsidiary of CSPC Pharma Group', 'CSPC Pharma Group'],
  ])('%s → %s', (name, parent) => {
    expect(parentPhrase(name)).toBe(parent);
  });

  it.each([
    'The Medicines Company',
    'Vaccine Company, Inc',
    'Regeneron Pharmaceuticals',
    'Acme Bio, a Delaware company',
    '',
  ])('no parent in %s', (name) => {
    expect(parentPhrase(name)).toBeNull();
  });
});

describe('Chinese brand grouping', () => {
  it('drops places, descriptors and parenthetical cities', () => {
    expect([...cjkBrandBigrams('武汉九珑人福药业有限责任公司')]).toEqual(['九珑', '珑人', '人福']);
    expect([...cjkBrandBigrams('明慧医药（杭州）有限公司')]).toEqual(['明慧']);
  });

  it('groups subsidiaries sharing the dominant brand and leaves licensees out', () => {
    const groups = brandGroups([
      member('a', '四川科伦药业股份有限公司', { trials: 40 }),
      member('b', '广西科伦制药有限公司'),
      member('c', '湖南科伦制药有限公司'),
      member('d', '浙江国镜药业有限公司'),
      member('e', 'Sichuan Kelun-Biotech Biopharmaceutical Co. Ltd.'),
    ]);
    expect(groups).toEqual([{ brand: '科伦', member_ids: ['a', 'b', 'c'], anchor_id: 'a' }]);
  });

  it('never groups institutions', () => {
    const groups = brandGroups([
      member('a', '中国人民解放军军事医学科学院毒物药物研究所', { owner_type: 'academic' }),
      member('b', '中国人民解放军军事医学科学院放射与辐射医学研究所', { owner_type: 'academic' }),
    ]);
    expect(groups).toEqual([]);
  });

  it('absorbs a row sharing a second brand with the group', () => {
    const groups = brandGroups([
      member('a', '华润双鹤药业股份有限公司', { trials: 9 }),
      member('b', '华润双鹤利民药业（济南）有限公司'),
      member('c', '双鹤药业（海南）有限责任公司'),
      member('d', '华润赛科药业有限责任公司'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ brand: '华润', anchor_id: 'a' });
    expect(groups[0].member_ids.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('finds two brands on one domain', () => {
    const groups = brandGroups([
      member('a', '扬子江药业集团有限公司', { trials: 9 }),
      member('b', '扬子江药业集团江苏紫龙药业有限公司'),
      member('c', '上海海雁医药科技有限公司'),
      member('d', '海雁医药（南京）有限公司'),
    ]);
    expect(groups.map(g => [...g.member_ids].sort().join(',')).sort()).toEqual(['a,b', 'c,d']);
  });
});

describe('acquisitionProposal', () => {
  const companies = new Map<string, FamilyCompany>([
    ['shire', { id: 'shire', name: 'Shire' }],
    ['takeda', { id: 'takeda', name: 'Takeda' }],
    ['pfizer', { id: 'pfizer', name: 'Pfizer' }],
    ['biogen', { id: 'biogen', name: 'Biogen' }],
    ['aerie', { id: 'aerie', name: 'Aerie Pharmaceuticals' }],
    ['alcon', { id: 'alcon', name: 'Alcon Research' }],
  ]);
  const pair = (p: Partial<CodePair>): CodePair => ({
    a_id: 'x', b_id: 'y', shared: 1, codes: ['X1'], licensing_deal: false,
    acquirer_id: null, acquired_id: null, acquisition_deal_id: null, acquisition_asset: null, ...p,
  });

  it('accepts a company acquisition with several shared codes', () => {
    const p = acquisitionProposal(pair({ shared: 9, codes: ['DX2930', 'TAK755'], acquirer_id: 'takeda', acquired_id: 'shire', acquisition_deal_id: 'd1', acquisition_asset: 'Shire plc' }), companies);
    expect(p).toMatchObject({ company_id: 'shire', parent_id: 'takeda', relation: 'subsidiary', source: 'acquisition_codes' });
  });

  it('accepts one shared code when the deal names the acquired company', () => {
    const p = acquisitionProposal(pair({ acquirer_id: 'alcon', acquired_id: 'aerie', acquisition_deal_id: 'd2', acquisition_asset: 'Aerie Pharmaceuticals (AR-15512)' }), companies);
    expect(p?.parent_id).toBe('alcon');
  });

  it('rejects a single-asset purchase', () => {
    expect(acquisitionProposal(pair({ acquirer_id: 'biogen', acquired_id: 'pfizer', acquisition_deal_id: 'd3', acquisition_asset: 'PF-05251749' }), companies)).toBeNull();
  });

  it('never makes large pharma a subsidiary from a deal record', () => {
    const big = new Map(companies);
    big.set('gsk', { id: 'gsk', name: 'GSK', company_type: 'large_pharma' });
    big.set('novartis', { id: 'novartis', name: 'Novartis', company_type: 'large_pharma' });
    expect(acquisitionProposal(pair({ shared: 2, acquirer_id: 'novartis', acquired_id: 'gsk', acquisition_deal_id: 'd4', acquisition_asset: 'ofatumumab' }), big)).toBeNull();
  });

  it('needs an acquisition', () => {
    expect(acquisitionProposal(pair({ shared: 5 }), companies)).toBeNull();
  });
});

describe('model adjudication', () => {
  const subject: ReviewSubject = {
    subject: 'domain:kelun.com',
    kind: 'domain',
    domain: 'kelun.com',
    members: [
      member('kelun', 'Kelun Pharmaceutical', { website_url: 'https://www.kelun.com', via: ['website'] }),
      member('sk', '四川科伦药业股份有限公司', { trials: 40 }),
      member('cro', '浙江国镜药业有限公司'),
    ],
  };

  it('lists every member with its evidence', () => {
    const prompt = buildReviewPrompt(subject);
    expect(prompt).toContain('"kelun.com"');
    expect(prompt).toContain('[1] 四川科伦药业股份有限公司');
    expect(prompt).toContain('website https://www.kelun.com');
  });

  it('accepts confident groups and drops the rest', () => {
    const answer = ModelAnswer.parse({
      groups: [
        { members: [0, 1], parent: 0, relation: 'same_entity', confidence: 0.95, reason: 'Kelun = 科伦' },
        { members: [0, 2], parent: 0, confidence: MODEL_MIN_CONFIDENCE - 0.1, reason: 'unsure' },
        { members: [1, 7], parent: 1, confidence: 0.99, reason: 'bad index' },
      ],
    });
    const props = proposalsFromAnswer(subject, answer, 'test-model');
    expect(props).toEqual([
      expect.objectContaining({ company_id: 'sk', parent_id: 'kelun', relation: 'same_entity', source: 'model', decided_by: 'model', confidence: 0.95 }),
    ]);
  });

  it('ignores a parent outside its group', () => {
    const answer = ModelAnswer.parse({ groups: [{ members: [1, 2], parent: 0, confidence: 0.9 }] });
    expect(proposalsFromAnswer(subject, answer, 'm')).toEqual([]);
  });

  it('hashes members independent of order', () => {
    expect(membersHash([{ id: 'b' }, { id: 'a' }])).toBe(membersHash([{ id: 'a' }, { id: 'b' }]));
  });
});
