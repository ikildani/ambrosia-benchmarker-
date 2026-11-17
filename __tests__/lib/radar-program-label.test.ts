import { ASSET_LIST_COLUMNS, programLabel } from '@/lib/radar/types';

describe('programLabel', () => {
  it('shows the program label when grouping produced one', () => {
    expect(programLabel({ program_name: 'Ivonescimab (AK112)', asset_name: 'AK112, Gemcitabine, Cisplatin' })).toBe('Ivonescimab (AK112)');
  });

  it('falls back to the registry arm name when the label is missing or blank', () => {
    expect(programLabel({ program_name: null, asset_name: 'HLX37' })).toBe('HLX37');
    expect(programLabel({ asset_name: 'HLX37' })).toBe('HLX37');
    expect(programLabel({ program_name: '   ', asset_name: 'HLX37' })).toBe('HLX37');
  });

  it('is selected by the feed', () => {
    expect(ASSET_LIST_COLUMNS.split(',').map(c => c.trim())).toContain('program_name');
  });
});
