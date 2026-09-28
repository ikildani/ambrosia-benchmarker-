import { normalizeAnnouncedDate } from '@/lib/ingestion/perplexity-deals';

describe('normalizeAnnouncedDate', () => {
  const today = '2026-09-28';

  it('keeps a full ISO date', () => {
    expect(normalizeAnnouncedDate('2026-09-10', today)).toBe('2026-09-10');
  });

  it('truncates a timestamp to the date part', () => {
    expect(normalizeAnnouncedDate('2026-09-10T14:00:00Z', today)).toBe('2026-09-10');
  });

  it('completes a month-only date to the 15th (the value that crashed the sweep insert)', () => {
    expect(normalizeAnnouncedDate('2026-09', today)).toBe('2026-09-15');
  });

  it('completes a year-only date to mid-year', () => {
    expect(normalizeAnnouncedDate('2025', today)).toBe('2025-06-15');
  });

  it('falls back to today for missing or unparseable input', () => {
    expect(normalizeAnnouncedDate(null, today)).toBe(today);
    expect(normalizeAnnouncedDate('', today)).toBe(today);
    expect(normalizeAnnouncedDate('Q3 2026', today)).toBe(today);
    expect(normalizeAnnouncedDate('2026-13', today)).toBe(today);
  });

  it('clamps future dates to today', () => {
    expect(normalizeAnnouncedDate('2027-01-05', today)).toBe(today);
    expect(normalizeAnnouncedDate('2026-10', today)).toBe(today);
  });
});
