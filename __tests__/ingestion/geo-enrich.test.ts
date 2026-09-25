import { parseGeoAnswer } from '@/lib/ingestion/geo-enrich';

describe('geo enrichment answer parsing', () => {
  it('accepts an ISO-2 country with confidence', () => {
    expect(parseGeoAnswer('{"country":"dk","confidence":92}')).toEqual({ country: 'DK', confidence: 92 });
  });
  it('rejects unknown and malformed answers', () => {
    expect(parseGeoAnswer('{"country":"unknown","confidence":95}').country).toBeNull();
    expect(parseGeoAnswer('{"country":"Denmark","confidence":95}').country).toBeNull();
    expect(parseGeoAnswer('no json here').confidence).toBe(0);
  });
});
