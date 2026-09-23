import {
  DRIP_SUPPRESSION_COLUMN,
  dripSuppressionFilter,
  isDripSuppressed,
} from '@/lib/email/drip-suppression';

describe('dripSuppressionFilter', () => {
  const now = new Date('2026-09-10T07:00:00.000Z');

  it('passes NULL and past timestamps, blocks future ones', () => {
    expect(dripSuppressionFilter(now)).toBe(
      'drip_suppressed_until.is.null,drip_suppressed_until.lt.2026-09-10T07:00:00.000Z',
    );
  });

  it('uses the migration 108 column name', () => {
    expect(DRIP_SUPPRESSION_COLUMN).toBe('drip_suppressed_until');
    expect(dripSuppressionFilter(now).startsWith(`${DRIP_SUPPRESSION_COLUMN}.is.null`)).toBe(true);
  });
});

describe('isDripSuppressed', () => {
  const now = new Date('2026-09-10T07:00:00.000Z');

  it('is false when the column is null or missing', () => {
    expect(isDripSuppressed({ drip_suppressed_until: null }, now)).toBe(false);
    expect(isDripSuppressed({}, now)).toBe(false);
  });

  it('is true while the suppression window is in the future', () => {
    expect(isDripSuppressed({ drip_suppressed_until: '2026-10-05T00:00:00.000Z' }, now)).toBe(true);
  });

  it('is false once the window has passed', () => {
    expect(isDripSuppressed({ drip_suppressed_until: '2026-09-01T00:00:00.000Z' }, now)).toBe(false);
  });

  it('treats an unparseable value as not suppressed', () => {
    expect(isDripSuppressed({ drip_suppressed_until: 'not-a-date' }, now)).toBe(false);
  });
});
