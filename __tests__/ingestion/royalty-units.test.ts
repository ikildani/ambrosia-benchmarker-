import { validateExtractedDeal, normalizeRoyaltyPct } from '@/lib/ingestion/deal-extraction-validator';

const base = {
  licensor: 'Arbutus Biopharma Corporation',
  licensee: 'Alexion Pharmaceuticals, Inc.',
  asset_name: 'LNP delivery technology',
  modality: 'other',
  confidence_score: 85,
  upfront_usd: 7_500_000,
};

describe('royalty units in the validator', () => {
  it('accepts a whole-percent royalty (9 = 9%)', () => {
    expect(validateExtractedDeal({ ...base, royalty_high_pct: 9 }).valid).toBe(true);
  });

  it('accepts a decimal royalty by normalising it (0.09 → 9%)', () => {
    expect(validateExtractedDeal({ ...base, royalty_high_pct: 0.09 }).valid).toBe(true);
  });

  it('still rejects an implausible royalty above 30%', () => {
    const r = validateExtractedDeal({ ...base, royalty_high_pct: 45 });
    expect(r.valid).toBe(false);
    expect(r.rejectCode).toBe('unrealistic_royalty');
    expect(r.rejectReason).toContain('45.0%');
  });

  it('normalizeRoyaltyPct leaves whole percents alone and scales fractions', () => {
    expect(normalizeRoyaltyPct(12)).toBe(12);
    expect(normalizeRoyaltyPct(0.125)).toBe(12.5);
    expect(normalizeRoyaltyPct(null)).toBeNull();
  });
});
