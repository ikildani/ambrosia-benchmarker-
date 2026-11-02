import { latestAnnualRevenue, type XBRLUnit } from '@/lib/ingestion/sec-xbrl';

const fact = (start: string, end: string, val: number, fy: number, filed: string, form = '10-K'): XBRLUnit =>
  ({ start, end, val, fy, fp: 'FY', form, filed, accn: 'x' });

describe('latestAnnualRevenue', () => {
  it('takes the latest period end, not the filing fiscal year', () => {
    // One FY2025 10-K carries three years under fy 2025.
    const usGaap = { Revenues: { units: { USD: [
      fact('2025-01-01', '2025-12-31', 300, 2025, '2026-02-10'),
      fact('2023-01-01', '2023-12-31', 100, 2025, '2026-02-10'),
      fact('2024-01-01', '2024-12-31', 200, 2025, '2026-02-10'),
    ] } } };
    expect(latestAnnualRevenue(usGaap)?.fact.val).toBe(300);
  });

  it('uses the newer tag when the company switched tags', () => {
    const usGaap = {
      Revenues: { units: { USD: [fact('2020-01-01', '2020-12-31', 25, 2020, '2021-02-10')] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [fact('2025-01-01', '2025-12-31', 33, 2025, '2026-02-10')] } },
    };
    expect(latestAnnualRevenue(usGaap)).toMatchObject({ tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', fact: { val: 33 } });
  });

  it('ignores quarters, 10-Qs and facts without a start date', () => {
    const usGaap = { Revenues: { units: { USD: [
      fact('2025-10-01', '2025-12-31', 90, 2025, '2026-02-10'),
      fact('2025-01-01', '2025-12-31', 400, 2025, '2025-11-01', '10-Q'),
      { end: '2025-12-31', val: 5, fy: 2025, fp: 'FY', form: '10-K', filed: '2026-02-10', accn: 'x' },
      fact('2024-01-01', '2024-12-31', 350, 2024, '2025-02-10'),
    ] } } };
    expect(latestAnnualRevenue(usGaap)?.fact.val).toBe(350);
  });

  it('prefers the higher-priority tag for the same period', () => {
    const usGaap = {
      Revenues: { units: { USD: [fact('2025-01-01', '2025-12-31', 50, 2025, '2026-02-10')] } },
      SalesRevenueNet: { units: { USD: [fact('2025-01-01', '2025-12-31', 48, 2025, '2026-02-10')] } },
    };
    expect(latestAnnualRevenue(usGaap)?.tag).toBe('Revenues');
  });

  it('returns null with no annual facts', () => {
    expect(latestAnnualRevenue({})).toBeNull();
  });
});
