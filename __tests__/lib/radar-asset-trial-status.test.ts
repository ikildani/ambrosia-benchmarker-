import { assetTrialStatus } from '@/lib/radar/asset-universe';

const now = new Date('2026-10-29T00:00:00Z');

describe('asset trial status', () => {
  it('is active only when an open trial was updated in the last 2 years', () => {
    expect(assetTrialStatus([{ status: 'recruiting', last_update_posted: '2025-06-01' }], now)).toBe('active');
    expect(assetTrialStatus([{ status: 'recruiting', last_update_posted: '2022-09-21' }], now)).toBe('unverified');
    expect(assetTrialStatus([
      { status: 'recruiting', last_update_posted: '2022-09-21' },
      { status: 'active_not_recruiting', last_update_posted: '2026-07-21' },
    ], now)).toBe('active');
  });
  it('falls back to completed, then other', () => {
    expect(assetTrialStatus([{ status: 'completed', last_update_posted: '2020-01-01' }], now)).toBe('completed');
    expect(assetTrialStatus([{ status: 'withdrawn', last_update_posted: '2018-11-13' }], now)).toBe('other');
    expect(assetTrialStatus([], now)).toBe('other');
  });
});
