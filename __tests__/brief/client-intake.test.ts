import { intakeBodySchema, clientIntakeToColumns, parseClientIntake, dataPackageToDiligence, bestPriorOffer } from '@/lib/brief/client-intake';
import { buildClientComparison } from '@/lib/brief/client-comparison';
import { buildIndicativeTermSheet } from '@/lib/brief/indicative-term-sheet';
import { renderYourModelVsSolidusPage } from '@/lib/report/pages/yourModelVsSolidus';
import { renderIndicativeTermSheetPage } from '@/lib/report/pages/indicativeTermSheet';
import type { AssetProfile, DecisionSummary, ValuationBridge } from '@/lib/brief/types';
import type { RNPVResult } from '@/lib/financial/types';
import type { PDFReportData, ReportMeta } from '@/lib/report/types';

const body = {
  name: 'Dana Kim', email: 'dana@acme.bio', company: 'Acme Therapeutics', therapeuticArea: 'Neurology', indication: "Alzheimer's disease", phase: 'Preclinical', modality: 'mAb',
  assetName: 'AMB-201', targetDealType: 'Licensing', territory: 'global',
  client: {
    model: { peakSalesM: 1200, posToApprovalPct: 12, launchYear: 2033, devCostToApprovalM: 250, expectedUpfrontM: 60, expectedTotalM: 800, notes: 'US-only pricing' },
    financing: { cashOnHandM: 18, runwayMonths: 14, nextRaiseM: 40, nextRaiseDate: '2027-03' },
    priorOffers: [{ party: 'Eisai', date: '2026-08', upfrontM: 35, totalM: 520, status: 'negotiating' }, { party: 'Biogen', upfrontM: 50, totalM: 700, status: 'declined' }],
    termSheetsReceived: 2, targetBuyers: ['Eli Lilly', 'Roche'], excludedBuyers: ['Biogen'], dataPackage: { in_vivo_efficacy: true, glp_tox: false, com_patent: true },
  },
  billingEntity: 'Acme Therapeutics Inc.', intakePath: '/intake',
};

describe('intake schema and columns', () => {
  it('accepts a full intake and maps the client block to migration-135 columns', () => {
    const parsed = intakeBodySchema.parse(body);
    const cols = clientIntakeToColumns(parsed.client);
    expect(cols.client_peak_sales_m).toBe(1200);
    expect(cols.next_raise_date).toBe('2027-03-15');
    expect(cols.target_buyers).toEqual(['Eli Lilly', 'Roche']);
    expect((cols.prior_offers as unknown[]).length).toBe(2);
  });

  it('rejects a bad email and out-of-range probability', () => {
    expect(intakeBodySchema.safeParse({ ...body, email: 'nope' }).success).toBe(false);
    expect(intakeBodySchema.safeParse({ ...body, client: { ...body.client, model: { posToApprovalPct: 140 } } }).success).toBe(false);
  });

  it('round-trips through a benchmark_requests row and derives diligence from the package', () => {
    const parsed = intakeBodySchema.parse(body);
    const row = clientIntakeToColumns(parsed.client);
    const back = parseClientIntake(row);
    expect(back?.model?.peakSalesM).toBe(1200);
    expect(back?.financing?.nextRaiseM).toBe(40);
    expect(back?.priorOffers[0].party).toBe('Eisai');
    expect(dataPackageToDiligence(back?.dataPackage)).toEqual({ ready: ['In vivo efficacy in a relevant model', 'Composition-of-matter patent granted or allowed'], gaps: ['GLP toxicology complete'] });
    expect(parseClientIntake({})).toBeNull();
  });

  it('picks the best live offer, ignoring declined ones', () => {
    const parsed = intakeBodySchema.parse(body);
    expect(bestPriorOffer(parsed.client.priorOffers)?.party).toBe('Eisai');
  });
});

const asset: AssetProfile = { assetName: 'AMB-201', company: 'Acme', modality: 'mab', phase: 'preclinical', indication: 'alzheimers', therapeuticArea: 'neurology', territory: 'global', targetDealType: 'licensing' };
const bridge = { ask: { upfrontM: 75, totalM: 900 }, floor: { upfrontM: 45, totalM: 600 }, walkAway: { upfrontM: 36 } } as unknown as ValuationBridge;
const rnpv = { peakSalesApplied: { low: 800, median: 1500, high: 2200 }, cumulativePoS: 0.053, yearsToMarket: 10.5, phaseTransitions: [{ costEstimate: 20 }, { costEstimate: 35 }, { costEstimate: 70 }, { costEstimate: 200 }] } as unknown as RNPVResult;

describe('client comparison', () => {
  it('sets each supplied assumption against the engine and prints the offer against floor and ask', () => {
    const client = intakeBodySchema.parse(body).client;
    const cmp = buildClientComparison(client, { asset, bridge, rnpv, asOf: '2026-09-26' })!;
    const peak = cmp.rows.find(r => r.key === 'peak_sales')!;
    expect(peak.solidus).toBe(1500);
    expect(Math.round(peak.deltaPct! * 100)).toBe(-20);
    const pos = cmp.rows.find(r => r.key === 'pos')!;
    expect(pos.solidus).toBe(5.3);
    expect(cmp.rows.find(r => r.key === 'launch_year')!.solidus).toBe(2037);
    expect(cmp.rows.find(r => r.key === 'dev_cost')!.solidus).toBe(325);
    expect(cmp.priorOffer?.offer.party).toBe('Eisai');
    expect(Math.round(cmp.priorOffer!.vsFloorTotalPct! * 100)).toBe(-13);
    expect(cmp.summary).toMatch(/Eisai/);
  });

  it('is null without client data', () => {
    expect(buildClientComparison(null, { asset, bridge, rnpv, asOf: '2026-09-26' })).toBeNull();
  });
});

describe('indicative term sheet', () => {
  const decision = {
    ask: { totalM: 900, upfrontM: 75, royaltyPct: { low: 8, median: 11, high: 14 } }, floor: { totalM: 600, upfrontM: 45 }, walkAwayUpfrontM: 36,
    levers: ['Front-load milestones to IND'], counterparties: [{ name: 'Eli Lilly', role: 'lead', why: '' }, { name: 'Roche', role: 'tension', why: '' }, { name: 'Biogen', role: 'hold', why: '' }],
  } as unknown as DecisionSummary;

  it('builds positions from the decision and weights milestones to the stage', () => {
    const ts = buildIndicativeTermSheet({ asset, decision, asOf: '2026-09-26' });
    expect(ts.lines.find(l => l.term === 'Upfront')?.position).toBe('$75M');
    expect(ts.lines.find(l => l.term === 'Royalty')?.position).toBe('Tiered 8% to 14% of net sales');
    expect(ts.lines.find(l => l.term === 'Territory')?.position).toMatch(/excluding Greater China/);
    const total = ts.milestones.reduce((s, m) => s + m.amountM, 0);
    expect(Math.abs(total - 825)).toBeLessThanOrEqual(5);
    expect(ts.milestones[0].event).toBe('IND clearance');
    expect(ts.counterparties).toEqual(['Eli Lilly', 'Roche']);
  });

  it('honours the structure answers from the adaptive intake', () => {
    const client = { ...intakeBodySchema.parse(body).client, structurePrefs: { optionFeeM: 12, optionMonths: 6, chinaLicensed: true, chinaPartner: 'Hansoh', readoutDate: '2027-06' } };
    const ts = buildIndicativeTermSheet({ asset: { ...asset, targetDealType: 'Option' }, decision, client, asOf: '2026-09-26' });
    expect(ts.lines.find(l => l.term === 'Option fee')?.position).toMatch(/^\$12M/);
    expect(ts.lines.find(l => l.term === 'Exclusivity period')?.position).toMatch(/6 months/);
    expect(ts.lines.find(l => l.term === 'Territory')?.position).toBe('Worldwide excluding Greater China (already licensed to Hansoh)');
    expect(ts.notes.some(n => n.includes('Next readout 2027-06'))).toBe(true);
    const ma = buildIndicativeTermSheet({ asset: { ...asset, targetDealType: 'M&A / Acquisition' }, decision, client: { ...client, structurePrefs: { minPriceM: 120 } }, asOf: '2026-09-26' });
    expect(ma.lines.find(l => l.term === 'Consideration at close')?.floor).toMatch(/\$120M \(floor; you set \$120M/);
    expect(parseClientIntake({ structure_prefs: { costSharePct: 30, coPromote: true, junk: { nested: 1 } } })?.structurePrefs).toEqual({ costSharePct: 30, coPromote: true });
  });

  it('renders both pages and their empty states', () => {
    const meta = { currentPage: 5, pageCount: 33, reportId: 'AMB-TEST' } as ReportMeta;
    const ts = buildIndicativeTermSheet({ asset, decision, asOf: '2026-09-26' });
    const client = intakeBodySchema.parse(body).client;
    const cmp = buildClientComparison(client, { asset, bridge, rnpv, asOf: '2026-09-26' });
    const data = { brief: { asset, indicativeTermSheet: ts, clientComparison: cmp } } as unknown as PDFReportData;
    expect(renderIndicativeTermSheetPage(data, meta)).toContain('Milestone schedule');
    expect(renderYourModelVsSolidusPage(data, meta)).toContain('Offer on the table: Eisai');
    const empty = { brief: { asset } } as unknown as PDFReportData;
    expect(renderIndicativeTermSheetPage(empty, meta)).toContain('No term sheet built');
    expect(renderYourModelVsSolidusPage(empty, meta)).toContain('No client model supplied');
  });
});
