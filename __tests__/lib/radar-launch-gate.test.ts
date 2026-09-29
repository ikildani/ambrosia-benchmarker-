import { isRadarPreviewEmail, radarVisibleTo } from '@/lib/radar/launch';

describe('Search & Evaluation launch gate', () => {
  it('lets internal accounts preview before launch and nobody else', () => {
    expect(isRadarPreviewEmail('ikildani@ambrosiaventures.co')).toBe(true);
    expect(isRadarPreviewEmail(' IKildani@AmbrosiaVentures.co ')).toBe(true);
    expect(isRadarPreviewEmail('someone@ambrosiaventures.co.evil.com')).toBe(false);
    expect(isRadarPreviewEmail('buyer@pfizer.com')).toBe(false);
    expect(isRadarPreviewEmail(null)).toBe(false);
    expect(radarVisibleTo('buyer@pfizer.com', false)).toBe(false);
    expect(radarVisibleTo('ikildani@ambrosiaventures.co', false)).toBe(true);
  });
  it('opens to everyone once public', () => {
    expect(radarVisibleTo('buyer@pfizer.com', true)).toBe(true);
    expect(radarVisibleTo(null, true)).toBe(true);
  });
});
