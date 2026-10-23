import {
  assetFromCalculation,
  buildCompSetReport,
  buildUserCompSet,
  compSetIsSendable,
  compSetReportUrl,
  dedupeForDisplay,
  fmtM,
  indicationLabel,
  newReportToken,
  type CalculationRow,
} from '@/lib/onboarding/comp-set-report';
import { buildCompSetEmail } from '@/lib/onboarding/comp-set-email';
import type { RawDealRow } from '@/lib/brief/comp-set';

const calc: CalculationRow = {
  id: 'calc-1',
  user_id: 'user-1',
  created_at: '2026-09-28T10:00:00Z',
  therapeutic_area: 'oncology',
  modality: 'smallMolecule',
  development_phase: 'phase2',
  indication_category: 'pancreatic',
  indication_specific: 'pancreatic',
  territory_scope: 'global',
  deal_type: 'licensing',
  output_upfront_low: '27',
  output_upfront_mid: '80',
  output_upfront_high: '135',
  output_total_deal_value_low: '465',
  output_total_deal_value_high: '1861',
  output_royalty_low: '9',
  output_royalty_high: '21',
};

function deal(i: number, over: Partial<RawDealRow> = {}): RawDealRow {
  return {
    id: `d${i}`,
    licensor_name: `Biotech ${i}`,
    licensee_name: `Pharma ${i}`,
    asset_name: `ASSET-${i}`,
    announced_date: `202${i % 6}-03-01`,
    phase_at_signing: 'phase_2',
    deal_type: 'license',
    modality: 'small_molecule',
    indication_category: 'pancreatic cancer',
    indication_specific: 'pancreatic ductal adenocarcinoma',
    therapeutic_area: 'oncology',
    territory: 'global',
    upfront_usd: (20 + i * 10) * 1_000_000,
    total_deal_value_usd: (400 + i * 100) * 1_000_000,
    milestones_total_usd: null,
    royalty_low_pct: 8,
    royalty_high_pct: 14,
    equity_investment_usd: null,
    verified: true,
    source_type: 'sec_filing',
    source_url: `https://www.sec.gov/doc${i}`,
    press_release_url: null,
    deal_status: null,
    ...over,
  } as unknown as RawDealRow;
}

describe('comp set email', () => {
  it('maps a saved calculation to an asset profile with a readable indication', () => {
    const asset = assetFromCalculation(calc)!;
    expect(asset).toMatchObject({ phase: 'phase2', indication: 'pancreatic', therapeuticArea: 'oncology', targetDealType: 'licensing' });
    expect(asset.indicationLabel).toBe('Pancreatic Cancer');
    expect(assetFromCalculation({ ...calc, development_phase: null })).toBeNull();
  });

  it('labels unknown indication keys readably', () => {
    expect(indicationLabel('rheumatoidArthritis')).toMatch(/Rheumatoid/);
    expect(indicationLabel('some_new_key')).toBe('Some new key');
  });

  it('formats money in millions', () => {
    expect(fmtM(80)).toBe('$80M');
    expect(fmtM(1861)).toBe('$1.9B');
    expect(fmtM(4.25)).toBe('$4.3M');
    expect(fmtM(null)).toBe('n/d');
  });

  it('holds back a thin comp set', () => {
    const asset = assetFromCalculation(calc)!;
    expect(compSetIsSendable(buildUserCompSet([deal(1), deal(2)], asset))).toBe(false);
    expect(compSetIsSendable(buildUserCompSet([1, 2, 3, 4, 5, 6].map((i) => deal(i)), asset))).toBe(true);
  });

  function report(n = 7) {
    const asset = assetFromCalculation(calc)!;
    const compSet = buildUserCompSet(Array.from({ length: n }, (_, i) => deal(i + 1)), asset);
    return buildCompSetReport({ calc, asset, compSet, preparedFor: 'John Smith', token: 'abcdEFGH12345678', now: new Date('2026-09-29T12:00:00Z') });
  }

  it('snapshots the report: program labels, benchmark, headline stats, sourced rows', () => {
    const r = report();
    expect(r.reportId).toBe('CS-20260929-ABCD');
    expect(r.program).toMatchObject({ phaseLabel: 'Phase 2', modalityLabel: 'small molecule', indicationLabel: 'Pancreatic Cancer', therapeuticAreaLabel: 'Oncology', dealTypeLabel: 'License' });
    expect(r.benchmark.upfront).toEqual({ low: 27, high: 135, mid: 80 });
    expect(r.benchmark.royalty).toMatchObject({ low: 9, high: 21 });
    expect(r.headline.upfront?.p50).toBeGreaterThan(0);
    expect(r.rows.length).toBe(7);
    expect(r.sameIndicationCount).toBe(7);
    expect(r.rows[0].sourceUrl).toMatch(/^https:\/\/www\.sec\.gov\//);
  });

  it('makes unguessable 16-character tokens and report URLs', () => {
    const t = newReportToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(newReportToken()).not.toBe(t);
    expect(compSetReportUrl(t)).toBe(`https://solidus.ambrosiaventures.co/comps/${t}`);
  });

  it('emails a short note that links to the report, with headline numbers and a trial line', () => {
    const r = report();
    const url = compSetReportUrl('abcdEFGH12345678');
    const { subject, html } = buildCompSetEmail({ name: 'John Smith', report: r, reportUrl: url, cta: { kind: 'trial' } });
    expect(subject).toBe(`Your Pancreatic Cancer comp set: ${r.rows.length} comparable deals`);
    expect(html).toContain('Hi John,');
    expect(html).toContain('Phase 2 small molecule program in Pancreatic Cancer');
    expect(html).toContain('Open your comp set');
    expect(html).toContain(url);
    expect(html).toContain('Median upfront');
    expect(html).toContain('/trial?ref=comp_set');
    // The rows live on the report page, not in the email.
    expect(html).not.toContain('https://www.sec.gov/doc1');
  });

  it('points Pro users at alerts, not a trial', () => {
    const { html } = buildCompSetEmail({ name: null, report: report(6), reportUrl: 'https://x/comps/t', cta: { kind: 'pro' } });
    expect(html).toContain('Hi,');
    expect(html).toContain('deal alert');
    expect(html).not.toContain('free for 7 days');
  });

  it('escapes names in the email', () => {
    const { html } = buildCompSetEmail({ name: '<img src=x onerror=alert(1)>', report: report(6), reportUrl: 'https://x/comps/t', cta: { kind: 'trial' } });
    expect(html).not.toContain('<img src=x');
  });

  it('shows one deal filed twice under two licensor names only once', () => {
    const asset = assetFromCalculation(calc)!;
    const rows = buildUserCompSet([1, 2, 3, 4, 5, 6].map((i) => deal(i)), asset).rows;
    const twin = { ...rows[0], id: 'twin', licensor: 'Other name for licensor' };
    expect(dedupeForDisplay([rows[0], twin, rows[1]]).map((r) => r.id)).toEqual([rows[0].id, rows[1].id]);
  });
});
