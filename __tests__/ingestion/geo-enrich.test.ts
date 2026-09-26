import { parseGeoAnswer } from '@/lib/ingestion/geo-enrich';

describe('geo enrichment answer parsing', () => {
  it('accepts an ISO-2 country with confidence', () => {
    expect(parseGeoAnswer('{"country":"dk","confidence":92,"type":"mid_biotech","type_confidence":88}')).toEqual({ country: 'DK', confidence: 92, type: 'mid_biotech', typeConfidence: 88 });
    expect(parseGeoAnswer('{"country":"US","confidence":99,"type":"government","type_confidence":97}').type).toBe('government');
    expect(parseGeoAnswer('{"country":"US","confidence":99,"type":"startup","type_confidence":97}').type).toBeNull();
  });
  it('rejects unknown and malformed answers', () => {
    expect(parseGeoAnswer('{"country":"unknown","confidence":95}').country).toBeNull();
    expect(parseGeoAnswer('{"country":"Denmark","confidence":95}').country).toBeNull();
    expect(parseGeoAnswer('no json here').confidence).toBe(0);
  });
});
