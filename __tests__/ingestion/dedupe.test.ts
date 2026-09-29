import { partyKey, pairKey, assetKey, looksRoleReversed } from '@/lib/ingestion/dedupe';

describe('dedupe keys', () => {
  it('collapses legal and sector suffixes and punctuation', () => {
    expect(partyKey('Bristol-Myers Squibb Company')).toBe('bristolmyerssquibb');
    expect(partyKey('Bristol Myers Squibb')).toBe('bristolmyerssquibb');
    expect(partyKey('Alexion Pharmaceuticals, Inc.')).toBe('alexion');
    expect(partyKey('Alexion (AstraZeneca)')).toBe('alexion');
    expect(partyKey('Shanghai Fosun Pharmaceutical Industrial Development Co., Ltd.')).toBe('shanghaifosunindustrialdevelopment');
  });
  it('is orientation-independent', () => {
    expect(pairKey('AstraZeneca', 'Alexion Pharmaceuticals')).toBe(pairKey('Alexion', 'AstraZeneca plc'));
  });
  it('normalises asset names', () => {
    expect(assetKey('TAVNEOS')).toBe(assetKey('Tavneos'));
    expect(assetKey('etranacogene dezaparvovec (Hemgenix)')).not.toBe(assetKey('etranacogene dezaparvovec'));
  });
  it('spots a big buyer listed as licensor', () => {
    expect(looksRoleReversed('Amgen', 'ChemoCentryx')).toBe(true);
    expect(looksRoleReversed('ChemoCentryx', 'Amgen')).toBe(false);
    expect(looksRoleReversed('AstraZeneca', 'Daiichi Sankyo')).toBe(false); // both big; cannot tell
  });
});

describe('partyRoot (Sep 29 2026: insert-time finder missed multi-word names)', () => {
  const { partyRoot, rootSearchTerms } = require('@/lib/ingestion/dedupe');
  it('collapses name variants of the same company', () => {
    expect(partyRoot('Eli Lilly and Company')).toBe('lilly');
    expect(partyRoot('Lilly')).toBe('lilly');
    expect(partyRoot('F. Hoffmann-La Roche Ltd')).toBe('roche');
    expect(partyRoot('MSD')).toBe('merck');
    expect(partyRoot('Merck & Co., Inc.')).toBe('merck');
    expect(partyRoot('Bristol-Myers Squibb')).toBe('bristol');
    expect(partyRoot('GlaxoSmithKline plc')).toBe('gsk');
  });
  it('keeps Merck KGaA apart from Merck & Co.', () => {
    expect(partyRoot('Merck KGaA, Darmstadt, Germany')).toBe('merckkgaa');
  });
  it('gives non-Latin names their own root', () => {
    expect(partyRoot('北京吉伦泰医药有限公司')).not.toBe(partyRoot('成都国为生物医药有限公司'));
    expect(partyRoot('北京吉伦泰医药有限公司')).not.toBe('');
  });
  it('searches alias spellings', () => {
    expect(rootSearchTerms('merck')).toEqual(expect.arrayContaining(['merck', 'msd']));
    expect(rootSearchTerms('gsk')).toEqual(expect.arrayContaining(['glaxo']));
  });
});
