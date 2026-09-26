/**
 * The client's own data on a Deal Intelligence Brief: their model, runway,
 * offers on the table, buyers to target or avoid, and the data package.
 *
 * One schema serves the /intake form, the intake API, the benchmark_requests
 * columns (migration 135) and the brief builder. Money is in $M, probabilities
 * in percent, as a CEO writes them. Nothing here changes the engine's own
 * numbers: the client's model is compared to Solidus on its own page, never
 * blended into the ask.
 */
import { z } from 'zod';

export const DATA_PACKAGE_ITEMS = [
  { key: 'in_vivo_efficacy', label: 'In vivo efficacy in a relevant model', area: 'Nonclinical' },
  { key: 'glp_tox', label: 'GLP toxicology complete', area: 'Nonclinical' },
  { key: 'cmc_gmp_batch', label: 'GMP batch and CMC package', area: 'Chemistry & CMC' },
  { key: 'ind_cleared', label: 'IND or CTA cleared', area: 'Regulatory' },
  { key: 'phase1_data', label: 'Phase 1 safety and PK data', area: 'Clinical' },
  { key: 'phase2_data', label: 'Phase 2 efficacy data', area: 'Clinical' },
  { key: 'biomarker_strategy', label: 'Biomarker or patient-selection strategy', area: 'Clinical' },
  { key: 'com_patent', label: 'Composition-of-matter patent granted or allowed', area: 'IP & FTO' },
  { key: 'fto_opinion', label: 'Freedom-to-operate opinion', area: 'IP & FTO' },
  { key: 'data_room_ready', label: 'Virtual data room assembled', area: 'Corporate & contracts' },
] as const;
export type DataPackageKey = (typeof DATA_PACKAGE_ITEMS)[number]['key'];

export const PRIOR_OFFER_STATUSES = ['received', 'negotiating', 'declined', 'expired'] as const;

const money = z.number().finite().nonnegative().max(1_000_000).nullable().optional();
const pct = z.number().finite().min(0).max(100).nullable().optional();
const shortText = z.string().trim().max(400).nullable().optional();
const longText = z.string().trim().max(4000).nullable().optional();

export const priorOfferSchema = z.object({
  party: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).nullable().optional(),
  upfrontM: money,
  totalM: money,
  structure: z.string().trim().max(60).nullable().optional(),
  status: z.enum(PRIOR_OFFER_STATUSES).default('received'),
  notes: shortText,
});
export type PriorOffer = z.infer<typeof priorOfferSchema>;

export const clientModelSchema = z.object({
  peakSalesM: money,
  posToApprovalPct: pct,
  launchYear: z.number().int().min(2024).max(2050).nullable().optional(),
  devCostToApprovalM: money,
  expectedUpfrontM: money,
  expectedTotalM: money,
  notes: longText,
});
export type ClientModel = z.infer<typeof clientModelSchema>;

export const clientFinancingSchema = z.object({
  cashOnHandM: money,
  runwayMonths: z.number().int().min(0).max(240).nullable().optional(),
  nextRaiseM: money,
  nextRaiseDate: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).nullable().optional(),
});
export type ClientFinancing = z.infer<typeof clientFinancingSchema>;

export const clientIntakeSchema = z.object({
  model: clientModelSchema.nullable().optional(),
  financing: clientFinancingSchema.nullable().optional(),
  priorOffers: z.array(priorOfferSchema).max(12).default([]),
  termSheetsReceived: z.number().int().min(0).max(50).nullable().optional(),
  targetBuyers: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  excludedBuyers: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  upstreamLicenses: longText,
  ipNotes: longText,
  dataPackage: z.record(z.string(), z.boolean()).default({}),
  /** Structure- and territory-specific answers (migration 137); see STRUCTURE_PREF_KEYS. */
  structurePrefs: z.record(z.string(), z.union([z.string().max(300), z.number().finite(), z.boolean()])).default({}),
});
export type ClientIntake = z.infer<typeof clientIntakeSchema>;

/** Body accepted by POST /api/benchmark/intake. */
export const intakeBodySchema = z.object({
  // contact
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(160).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  // asset
  therapeuticArea: z.string().trim().min(1).max(60),
  indication: z.string().trim().min(1).max(160),
  phase: z.string().trim().min(1).max(40),
  modality: z.string().trim().min(1).max(60),
  assetName: shortText,
  mechanism: shortText,
  target: shortText,
  targetDealType: z.string().trim().max(60).nullable().optional(),
  territory: z.string().trim().max(40).nullable().optional(),
  dataPackageStage: z.string().trim().max(80).nullable().optional(),
  differentiationNotes: longText,
  // the client's data
  client: clientIntakeSchema.default({ priorOffers: [], targetBuyers: [], excludedBuyers: [], dataPackage: {}, structurePrefs: {} }),
  /**
   * Structure- and territory-specific follow-ups the form asks once the deal
   * type or territory is known. Free-form keys; see STRUCTURE_PREF_KEYS.
   */
  structurePrefs: z.record(z.string(), z.union([z.string().max(300), z.number().finite(), z.boolean()])).default({}),
  // invoice
  billingEntity: shortText,
  billingAddress: longText,
  billingEmail: z.string().trim().email().max(200).nullable().optional(),
  poNumber: z.string().trim().max(60).nullable().optional(),
  // provenance
  intakePath: z.enum(['/intake', '/brief', '/benchmark']).default('/intake'),
  ref: z.string().trim().max(120).nullable().optional(),
});
export type IntakeBody = z.infer<typeof intakeBodySchema>;

/** Keys the form writes into structurePrefs, with the label the admin email and term sheet print. */
export const STRUCTURE_PREF_KEYS: Record<string, string> = {
  optionFeeM: 'Option fee you would accept ($M)',
  optionMonths: 'Evaluation period you would accept (months)',
  costSharePct: 'Share of development cost you would fund (%)',
  coPromote: 'Interest in US co-promotion',
  minPriceM: 'Price below which you would not sell ($M)',
  chinaLicensed: 'Greater China rights already licensed',
  chinaPartner: 'Greater China partner',
  readoutDate: 'Next readout (YYYY-MM)',
};

/** Columns on benchmark_requests written from the client block (migration 135). */
export function clientIntakeToColumns(c: ClientIntake): Record<string, unknown> {
  return {
    client_peak_sales_m: c.model?.peakSalesM ?? null,
    client_pos_pct: c.model?.posToApprovalPct ?? null,
    client_launch_year: c.model?.launchYear ?? null,
    client_dev_cost_m: c.model?.devCostToApprovalM ?? null,
    client_expected_upfront_m: c.model?.expectedUpfrontM ?? null,
    client_expected_total_m: c.model?.expectedTotalM ?? null,
    client_model_notes: c.model?.notes ?? null,
    cash_on_hand_m: c.financing?.cashOnHandM ?? null,
    runway_months: c.financing?.runwayMonths ?? null,
    next_raise_m: c.financing?.nextRaiseM ?? null,
    next_raise_date: c.financing?.nextRaiseDate ? normaliseDate(c.financing.nextRaiseDate) : null,
    prior_offers: c.priorOffers ?? [],
    term_sheets_received: c.termSheetsReceived ?? null,
    target_buyers: c.targetBuyers ?? [],
    excluded_buyers: c.excludedBuyers ?? [],
    upstream_licenses: c.upstreamLicenses ?? null,
    ip_notes: c.ipNotes ?? null,
    data_package: c.dataPackage ?? {},
  };
}

function normaliseDate(v: string): string {
  if (/^\d{4}$/.test(v)) return `${v}-06-30`;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-15`;
  return v;
}

/** The same block read back from a benchmark_requests row. */
/** structure_prefs column → typed map (unknown keys kept, values coerced). */
export function parseStructurePrefs(row: Record<string, unknown>): Record<string, string | number | boolean> {
  const raw = row.structure_prefs && typeof row.structure_prefs === 'object' ? (row.structure_prefs as Record<string, unknown>) : {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function parseClientIntake(row: Record<string, unknown>): ClientIntake | null {
  const n = (k: string): number | null => {
    const v = row[k];
    if (v == null || v === '') return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const s = (k: string): string | null => (typeof row[k] === 'string' && (row[k] as string).trim() ? (row[k] as string) : null);
  const arr = (k: string): string[] => (Array.isArray(row[k]) ? (row[k] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);
  const offersRaw = Array.isArray(row.prior_offers) ? (row.prior_offers as unknown[]) : [];
  const priorOffers = offersRaw.map(o => priorOfferSchema.safeParse(o)).filter(r => r.success).map(r => (r as { data: PriorOffer }).data);
  const dp = row.data_package && typeof row.data_package === 'object' ? (row.data_package as Record<string, unknown>) : {};
  const dataPackage: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(dp)) dataPackage[k] = v === true;

  const model: ClientModel = {
    peakSalesM: n('client_peak_sales_m'),
    posToApprovalPct: n('client_pos_pct'),
    launchYear: n('client_launch_year'),
    devCostToApprovalM: n('client_dev_cost_m'),
    expectedUpfrontM: n('client_expected_upfront_m'),
    expectedTotalM: n('client_expected_total_m'),
    notes: s('client_model_notes'),
  };
  const hasModel = Object.values(model).some(v => v != null);
  const financing: ClientFinancing = {
    cashOnHandM: n('cash_on_hand_m'),
    runwayMonths: n('runway_months'),
    nextRaiseM: n('next_raise_m'),
    nextRaiseDate: s('next_raise_date'),
  };
  const hasFinancing = Object.values(financing).some(v => v != null);
  const intake: ClientIntake = {
    model: hasModel ? model : null,
    financing: hasFinancing ? financing : null,
    priorOffers,
    termSheetsReceived: n('term_sheets_received'),
    targetBuyers: arr('target_buyers'),
    excludedBuyers: arr('excluded_buyers'),
    upstreamLicenses: s('upstream_licenses'),
    ipNotes: s('ip_notes'),
    dataPackage,
    structurePrefs: parseStructurePrefs(row),
  };
  const empty = !hasModel && !hasFinancing && priorOffers.length === 0 && intake.targetBuyers.length === 0
    && intake.excludedBuyers.length === 0 && !intake.upstreamLicenses && !intake.ipNotes && Object.keys(dataPackage).length === 0
    && Object.keys(intake.structurePrefs).length === 0;
  return empty ? null : intake;
}

/** Diligence checklist inputs from the data-package ticks. */
export function dataPackageToDiligence(dp: Record<string, boolean> | null | undefined): { ready: string[]; gaps: string[] } {
  const ready: string[] = [];
  const gaps: string[] = [];
  for (const item of DATA_PACKAGE_ITEMS) {
    const v = dp?.[item.key];
    if (v === true) ready.push(item.label);
    else if (v === false) gaps.push(item.label);
  }
  return { ready, gaps };
}

/** Best prior offer on the table ($M total, falling back to upfront), for levers and the comparison page. */
export function bestPriorOffer(offers: PriorOffer[] | null | undefined): PriorOffer | null {
  const live = (offers ?? []).filter(o => o.status !== 'declined' && o.status !== 'expired');
  const pool = live.length ? live : (offers ?? []);
  return pool.slice().sort((a, b) => ((b.totalM ?? b.upfrontM ?? 0) - (a.totalM ?? a.upfrontM ?? 0)))[0] ?? null;
}
