/**
 * Data readiness for one brief profile: is the evidence behind this
 * indication, stage and area good enough to quote a number a buyer will
 * respect? Computed at intake (stored on benchmark_requests.readiness and
 * printed in the operator email) and again after an indication top-up.
 *
 * Five lines, each green / amber / red with the threshold stated, so the
 * operator can read the card in ten seconds before the call:
 *   1. same-indication comparables in the stage window
 *   2. verified share of the area pool in the window
 *   3. distinct buyers with a deal at the stage window in this area
 *   4. a price benchmark for the indication (local table and/or Terrain)
 *   5. deal-status coverage of the pool (terminated deals must be marked)
 *
 * Pure apart from the reads; the row fetch is the same one the comp set uses.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchQualityDealRows, isSameTA, isSameIndication, normalizePhase, PHASE_RANK, type RawDealRow } from './comp-set';
import { resolveTherapeuticArea, resolvePhase, resolveIndication } from './intake-map';
import { INDICATION_REGISTRY } from '@/lib/benchmarkPagesIndication';
import { fetchDemandProfile, netPricePerYearUsd } from './terrain-demand';
import epiData from '@/data/epidemiology.json';

export type ReadinessStatus = 'green' | 'amber' | 'red';

export interface ReadinessLine {
  key: 'same_indication_comps' | 'verified_share' | 'buyers_at_stage' | 'price_benchmark' | 'deal_status_coverage';
  label: string;
  /** Printable value, e.g. "1 of 19" or "72%". */
  value: string;
  status: ReadinessStatus;
  /** The rule, in words, e.g. "green ≥ 8, amber ≥ 3". */
  threshold: string;
  /** One line the operator can act on. */
  detail: string;
}

export interface Readiness {
  asOf: string;
  profile: { therapeuticArea: string; indication: string; indicationKey: string; indicationMatched: boolean; phase: string; window: string[] };
  lines: ReadinessLine[];
  overall: ReadinessStatus;
  /** True when an indication-scoped ingestion run should be queued before the call. */
  topUpRecommended: boolean;
  /** Numbers the top-up runner compares before/after. */
  counts: { sameIndication: number; areaWindow: number; verified: number; buyers: number; statusKnown: number };
}

const worst = (a: ReadinessStatus, b: ReadinessStatus): ReadinessStatus => (a === 'red' || b === 'red' ? 'red' : a === 'amber' || b === 'amber' ? 'amber' : 'green');

/** Stage window: the asset's phase and one step either side (the comp set's default). */
export function stageWindow(phaseKey: string): string[] {
  const p = normalizePhase(phaseKey);
  const rank = PHASE_RANK[p];
  if (rank == null || p === 'unknown') return ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'];
  return (Object.keys(PHASE_RANK) as Array<keyof typeof PHASE_RANK>).filter(k => k !== 'unknown' && Math.abs(PHASE_RANK[k] - rank) <= 1);
}

export interface ReadinessInput {
  therapeuticArea: string;
  indication: string;
  phase: string;
  /** Pre-fetched rows (the comp set's quality filter) to avoid a second full read. */
  rows?: RawDealRow[];
  /** Skip the Terrain call (tests, or when the key is missing). */
  skipTerrain?: boolean;
}

export async function computeReadiness(supabase: SupabaseClient, input: ReadinessInput): Promise<Readiness> {
  const asOf = new Date().toISOString().slice(0, 10);
  let ta = resolveTherapeuticArea(input.therapeuticArea);
  let ind = resolveIndication(input.indication, ta);
  // The indication decides the area (same rule as resolveIntake).
  const def = ind.how !== 'default' ? INDICATION_REGISTRY.find(d => d.value === ind.key) : undefined;
  if (def && def.ta !== ta) { ta = def.ta; ind = resolveIndication(input.indication, ta); }
  const phase = resolvePhase(input.phase);
  const window = stageWindow(phase);

  const rows = input.rows ?? await fetchQualityDealRows(supabase);
  const inWindow = (r: RawDealRow) => window.includes(normalizePhase(r.phase_at_signing));
  const area = rows.filter(r => isSameTA(r, ta) && inWindow(r));
  const same = rows.filter(r => isSameIndication(r, ind.key) && inWindow(r));
  const disclosed = (r: RawDealRow) => (r.upfront_usd ?? 0) > 0 || (r.total_deal_value_usd ?? 0) > 0;
  const sameDisclosed = same.filter(disclosed);
  const verified = area.filter(r => r.verified === true).length;
  const buyers = new Set(area.map(r => (r.licensee_name ?? '').trim().toLowerCase()).filter(Boolean));
  // deal_status defaults to 'active' on insert, so only a status-pass stamp counts as known.
  const statusKnown = area.filter(r => !!r.deal_status_checked_at).length;

  const lines: ReadinessLine[] = [];

  // 1. Same-indication comparables
  const n1 = sameDisclosed.length;
  lines.push({
    key: 'same_indication_comps', label: 'Same-indication comparables',
    value: `${n1} disclosed of ${same.length} in the ${ind.how === 'default' ? 'area' : 'indication'}`,
    status: n1 >= 8 ? 'green' : n1 >= 3 ? 'amber' : 'red',
    threshold: 'green ≥ 8, amber ≥ 3, in the stage window',
    detail: n1 >= 8 ? 'The comp set prices from this indication.' : n1 >= 3 ? 'Thin: the set fills from the area; medians lean on class-level pricing.' : 'The ask will rest on area-level comps; an indication top-up is queued before the call.',
  });

  // 2. Verified share
  const share = area.length ? verified / area.length : 0;
  lines.push({
    key: 'verified_share', label: 'Verified with citation (area pool)',
    value: `${Math.round(share * 100)}% of ${area.length}`,
    status: share >= 0.7 ? 'green' : share >= 0.4 ? 'amber' : 'red',
    threshold: 'green ≥ 70%, amber ≥ 40%',
    detail: share >= 0.7 ? 'Every headline driver can be cited.' : 'Unverified rows are excluded from the set until the verifier reaches them; expect a smaller pool.',
  });

  // 3. Buyers with stage history
  lines.push({
    key: 'buyers_at_stage', label: 'Buyers with a deal at this stage in the area',
    value: `${buyers.size}`,
    status: buyers.size >= 8 ? 'green' : buyers.size >= 4 ? 'amber' : 'red',
    threshold: 'green ≥ 8, amber ≥ 4',
    detail: buyers.size >= 8 ? 'The buyer map can show what each paid at this stage.' : 'Few buyers have a disclosed deal at this stage here; the map will lean on fit and urgency.',
  });

  // 4. Price benchmark
  const epi = (epiData as { indications: Record<string, { annualCostOfTherapy?: number }> }).indications[ind.key];
  const localPrice = epi?.annualCostOfTherapy ?? null;
  let terrainPrice: number | null = null;
  if (!input.skipTerrain) {
    try { const res = await fetchDemandProfile(ind.key); terrainPrice = res ? netPricePerYearUsd(res.profile) : null; } catch { terrainPrice = null; }
  }
  const fmtUsd = (v: number) => `$${Math.round(v / 1000)}K`;
  const ratio = localPrice && terrainPrice ? Math.max(localPrice, terrainPrice) / Math.min(localPrice, terrainPrice) : null;
  lines.push({
    key: 'price_benchmark', label: 'Net price per patient-year',
    value: localPrice && terrainPrice ? `local ${fmtUsd(localPrice)} · Terrain ${fmtUsd(terrainPrice)}` : localPrice ? `local ${fmtUsd(localPrice)}` : terrainPrice ? `Terrain ${fmtUsd(terrainPrice)}` : 'none',
    status: !localPrice && !terrainPrice ? 'red' : ratio != null && ratio > 2 ? 'amber' : ind.how !== 'default' ? 'green' : 'amber',
    threshold: 'green when a benchmark exists and the two sources agree within 2×',
    detail: !localPrice && !terrainPrice ? 'No price for this indication: peak sales will come from the comparable-derived range. Confirm a price on the call.'
      : ratio != null && ratio > 2 ? `The two price sources disagree ${ratio.toFixed(1)}×; the funnel uses Terrain when it has a profile. Confirm which is right on the call.`
      : ind.how !== 'default' ? 'Peak sales builds bottom-up from population, share and this price.' : 'The indication did not match the registry exactly; the price shown is for the nearest entry.',
  });

  // 5. Deal-status coverage
  const cov = area.length ? statusKnown / area.length : 0;
  lines.push({
    key: 'deal_status_coverage', label: 'Deal status checked (still in force?)',
    value: `${Math.round(cov * 100)}% of ${area.length}`,
    status: cov >= 0.5 ? 'green' : cov >= 0.2 ? 'amber' : 'red',
    threshold: 'green ≥ 50%, amber ≥ 20%',
    detail: cov >= 0.5 ? 'Terminated deals are excluded from precedent.' : 'Most rows have never been status-checked; a terminated deal could sit in the set. The weekly status pass covers comps used in briefs first.',
  });

  const overall = lines.map(l => l.status).reduce(worst, 'green');
  const topUpRecommended = lines[0].status !== 'green' || lines[2].status === 'red';
  return {
    asOf,
    profile: { therapeuticArea: ta, indication: input.indication, indicationKey: ind.key, indicationMatched: ind.how !== 'default', phase, window },
    lines, overall, topUpRecommended,
    counts: { sameIndication: n1, areaWindow: area.length, verified, buyers: buyers.size, statusKnown },
  };
}

/** Plain-text summary for logs and Slack. */
export function readinessSummary(r: Readiness): string {
  return `${r.overall.toUpperCase()} · ${r.lines.map(l => `${l.label.split(' (')[0]}: ${l.value} (${l.status})`).join(' · ')}`;
}
