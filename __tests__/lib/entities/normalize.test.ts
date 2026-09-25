import {
  normalizeCompanyName,
  normalizeAssetName,
  compactKey,
  sameCompanyKey,
  trigrams,
  similarity,
  companySimilarity,
  rankBySimilarity,
  anchorToken,
  isUuid,
  FUZZY_MATCH_THRESHOLD,
  CANDIDATE_FLOOR,
  MAX_CANDIDATES,
} from '@/lib/entities/normalize';

describe('normalizeCompanyName', () => {
  it('lowercases, strips punctuation and legal-form suffixes', () => {
    expect(normalizeCompanyName('Pfizer Inc.')).toBe('pfizer');
    expect(normalizeCompanyName('Pfizer, Inc')).toBe('pfizer');
    expect(normalizeCompanyName('AstraZeneca PLC')).toBe('astrazeneca');
    expect(normalizeCompanyName('Novartis AG')).toBe('novartis');
    expect(normalizeCompanyName('Kyowa Kirin Co., Ltd.')).toBe('kyowa kirin');
    expect(normalizeCompanyName('Janssen-Cilag G.m.b.H')).toBe('janssen cilag');
    expect(normalizeCompanyName('Janssen Cilag N.V./S.A.')).toBe('janssen cilag');
    expect(normalizeCompanyName('Vertex Pharmaceuticals Incorporated')).toBe('vertex pharmaceuticals');
    expect(normalizeCompanyName('Takeda Kabushiki Kaisha')).toBe('takeda');
    expect(normalizeCompanyName('Novo Nordisk A/S')).toBe('novo nordisk');
  });

  it('collapses "Eli Lilly and Company" / "Eli Lilly & Co." to "eli lilly"', () => {
    expect(normalizeCompanyName('Eli Lilly and Company')).toBe('eli lilly');
    expect(normalizeCompanyName('Eli Lilly & Co.')).toBe('eli lilly');
    expect(normalizeCompanyName('Eli Lilly')).toBe('eli lilly');
  });

  it('expands & and keeps distinguishing tokens', () => {
    expect(normalizeCompanyName('Merck & Co., Inc.')).toBe('merck');
    expect(normalizeCompanyName('Merck KGaA')).toBe('merck kgaa');
    expect(normalizeCompanyName('Roche Holding AG')).toBe('roche holding');
    expect(normalizeCompanyName('The Medicines Company')).toBe('medicines');
  });

  it('never strips the last token and handles empty input', () => {
    expect(normalizeCompanyName('Inc')).toBe('inc');
    expect(normalizeCompanyName('')).toBe('');
    expect(normalizeCompanyName(null)).toBe('');
    expect(normalizeCompanyName('™®')).toBe('');
  });

  it('compactKey / sameCompanyKey ignore spacing only', () => {
    expect(compactKey('astra zeneca')).toBe('astrazeneca');
    expect(sameCompanyKey(normalizeCompanyName('Astra Zeneca'), normalizeCompanyName('AstraZeneca plc'))).toBe(true);
    expect(sameCompanyKey('roche', 'roche holding')).toBe(false);
    expect(sameCompanyKey('', '')).toBe(true);
  });
});

describe('normalizeAssetName', () => {
  it('matches the drug_aliases.alias_normalized key', () => {
    expect(normalizeAssetName('MK-3475')).toBe('mk3475');
    expect(normalizeAssetName('Pembrolizumab (KEYTRUDA®)')).toBe('pembrolizumabkeytruda');
    expect(normalizeAssetName('nendocabtagene onogedleucel')).toBe('nendocabtageneonogedleucel');
  });
});

describe('trigrams / similarity', () => {
  it('pads words pg_trgm style', () => {
    expect([...trigrams('ab')].sort()).toEqual(['  a', ' ab', 'ab '].sort());
    expect(trigrams('roche').size).toBe(6);
  });

  it('is 1 for identical, 0 for disjoint, symmetric otherwise', () => {
    expect(similarity('pfizer', 'pfizer')).toBe(1);
    expect(similarity('pfizer', 'xyz')).toBe(0);
    expect(similarity('', '')).toBe(1);
    expect(similarity('abc', '')).toBe(0);
    expect(similarity('gilead sciences', 'gilead')).toBeCloseTo(similarity('gilead', 'gilead sciences'), 10);
  });

  it('Roche vs Roche Holding AG vs Genentech do NOT fuzzy-match as one', () => {
    expect(companySimilarity('Roche', 'Roche Holding AG')).toBeLessThan(FUZZY_MATCH_THRESHOLD);
    expect(companySimilarity('Roche', 'Genentech')).toBeLessThan(FUZZY_MATCH_THRESHOLD);
    expect(companySimilarity('Roche Holding AG', 'Genentech')).toBeLessThan(FUZZY_MATCH_THRESHOLD);
    // Still close enough to be offered as a candidate, never auto-picked.
    expect(companySimilarity('Roche', 'Roche Holding AG')).toBeGreaterThanOrEqual(CANDIDATE_FLOOR);
  });

  it('"Eli Lilly and Company" vs "Eli Lilly" DO match', () => {
    expect(companySimilarity('Eli Lilly and Company', 'Eli Lilly')).toBeGreaterThanOrEqual(FUZZY_MATCH_THRESHOLD);
    expect(companySimilarity('Eli Lilly & Co.', 'Eli Lilly and Company')).toBe(1);
  });

  it('a single-letter typo in a long name clears the threshold; a different company does not', () => {
    expect(similarity('astrazeneca', 'astrazenca')).toBeGreaterThanOrEqual(0.6);
    expect(companySimilarity('Merck', 'Merck KGaA')).toBeLessThan(FUZZY_MATCH_THRESHOLD);
    expect(companySimilarity('Pfizer', 'Pfizer Oncology')).toBeLessThan(FUZZY_MATCH_THRESHOLD);
  });
});

describe('rankBySimilarity', () => {
  const pool = [
    { id: 'a', keys: ['pfizer'] },
    { id: 'b', keys: ['pfizers'] },
    { id: 'c', keys: ['pfizer co'] },
    { id: 'd', keys: ['pfizer japan'] },
    { id: 'e', keys: ['novartis'] },
  ];

  it('returns the best above threshold and the rest as candidates', () => {
    const r = rankBySimilarity('pfizer', pool, p => p.keys);
    expect(r.best?.item.id).toBe('a');
    expect(r.best?.score).toBe(1);
    expect(r.candidates.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    expect(r.candidates.every(c => c.score < 1 && c.score >= CANDIDATE_FLOOR)).toBe(true);
    expect(r.candidates.some(c => c.item.id === 'e')).toBe(false);
  });

  it('returns no best and top-3 candidates when nothing clears the threshold', () => {
    const r = rankBySimilarity('pfizzer', pool, p => p.keys);
    expect(r.best).toBeNull();
    expect(r.candidates.length).toBe(3);
    expect(r.candidates[0].item.id).toBe('a');
  });

  it('scores an item on its best alias', () => {
    const r = rankBySimilarity('lilly', [{ id: 'x', keys: ['eli lilly', 'lilly'] }], p => p.keys);
    expect(r.best?.score).toBe(1);
  });
});

describe('helpers', () => {
  it('anchorToken picks the longest token', () => {
    expect(anchorToken('eli lilly')).toBe('lilly');
    expect(anchorToken('kyowa kirin')).toBe('kyowa');
    expect(anchorToken('')).toBe('');
  });
  it('isUuid', () => {
    expect(isUuid('3c849b12-4a78-4d75-b1c3-e3e5a9d6a83a')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
