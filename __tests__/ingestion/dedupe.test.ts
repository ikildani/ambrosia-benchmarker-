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
