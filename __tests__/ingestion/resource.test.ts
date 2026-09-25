import { mentionsBoth } from '@/lib/ingestion/resource';

describe('re-sourcing party match', () => {
  it('matches when both parties appear under their core names', () => {
    const text = 'Bristol Myers Squibb Company today announced a global license with BioNTech SE for BNT327.';
    expect(mentionsBoth(text, 'Bristol-Myers Squibb', 'BioNTech')).toBe(true);
  });
  it('rejects a document naming only one party', () => {
    expect(mentionsBoth('Amgen reports quarterly results', 'ChemoCentryx', 'Amgen')).toBe(false);
  });
  it('rejects very short party keys that would match anything', () => {
    expect(mentionsBoth('the ono deal', 'Ono', 'BMS')).toBe(false);
  });
});

import { filerIsParty } from '@/lib/ingestion/resource';

describe('re-sourcing filer check', () => {
  it('accepts a filing by either party', () => {
    expect(filerIsParty('ALEXION PHARMACEUTICALS, INC.', 'Alexion', 'AstraZeneca')).toBe(true);
    expect(filerIsParty('ASTRAZENECA PLC', 'CSPC Pharmaceutical Group', 'AstraZeneca')).toBe(true);
  });
  it('rejects a third-party filer that merely mentions both', () => {
    expect(filerIsParty('Corbus Pharmaceuticals Holdings, Inc.', 'CSPC', 'AstraZeneca')).toBe(false);
    expect(filerIsParty('ASTRAZENECA PLC', 'Daiichi Sankyo', 'Merck')).toBe(false);
  });
});
