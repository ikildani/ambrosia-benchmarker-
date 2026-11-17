import { availabilityNote, RADAR_AVAILABILITY_REASONS } from '@/lib/radar/vocab';
import { DEFAULT_UI, SORT_COLUMNS, SORT_KEYS } from '@/lib/radar/client/filter-schema';
import { ASSET_LIST_COLUMNS } from '@/lib/radar/types';

describe('availability reasons', () => {
  it('labels every reason the migration can write', () => {
    for (const r of ['partnered', 'originator_elsewhere', 'large_pharma', 'approved_molecule', 'licensee', 'partial_deal']) {
      expect(RADAR_AVAILABILITY_REASONS[r]).toBeTruthy();
    }
  });

  it('joins known reasons and ignores unknown ones', () => {
    expect(availabilityNote(['large_pharma', 'partial_deal'])).toBe('Large pharma owner · Some rights licensed');
    expect(availabilityNote(['mystery'])).toBeNull();
    expect(availabilityNote([])).toBeNull();
    expect(availabilityNote(null)).toBeNull();
  });
});

describe('Best fit sort', () => {
  it('is the default sort and orders by score_rank', () => {
    expect(DEFAULT_UI.sort).toBe('fit');
    expect(SORT_KEYS[0]).toBe('fit');
    expect(SORT_COLUMNS.fit).toEqual({ column: 'score_rank', kind: 'number', defaultDir: 'desc' });
  });

  it('keeps the pure intent-score sort available', () => {
    expect(SORT_COLUMNS.score.column).toBe('score_logit');
  });

  it('selects the keyset column and the reasons in the feed', () => {
    const cols = ASSET_LIST_COLUMNS.split(',').map(c => c.trim());
    expect(cols).toEqual(expect.arrayContaining(['score_rank', 'availability_reasons']));
  });
});
