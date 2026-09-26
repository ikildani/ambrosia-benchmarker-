/**
 * Indication top-up: an ingestion run scoped to one intake's indication,
 * stage and mechanism, queued by the readiness check at intake and drained
 * by the Perplexity discovery cron ahead of its area rotation. The point is
 * to go from one same-indication comparable to five or more in the days
 * between intake and the call, for the profile that actually needs it.
 *
 * Runs through the same discovery path as the area queries (Perplexity
 * search → Opus extraction → validator → insert as pending for the verifier),
 * so nothing here is trusted before verification. Each top-up gets at most
 * MAX_RUNS attempts; readiness is recomputed after each and stored beside the
 * before-card so the operator can see what the run bought.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { runPerplexityDealDiscovery } from './perplexity-deals';
import { computeReadiness, readinessSummary, type Readiness } from '@/lib/brief/readiness';
import { resolveTherapeuticArea } from '@/lib/brief/intake-map';

export const MAX_RUNS = 2;

export interface TopupRow {
  id: string;
  request_id: string | null;
  therapeutic_area: string;
  indication: string;
  indication_key: string | null;
  phase: string | null;
  mechanism: string | null;
  target: string | null;
  status: string;
  runs: number;
  readiness_before: Readiness | null;
}

/** Queries for one profile: licensing history, early-stage and mechanism deals, and structures. Pure; exported for tests. */
export function buildTopupQueries(t: Pick<TopupRow, 'indication' | 'phase' | 'mechanism' | 'target' | 'therapeutic_area'>): string[] {
  const ind = t.indication.trim();
  const mech = [t.mechanism, t.target].filter(Boolean).join(' / ');
  const stage = (t.phase ?? '').toLowerCase();
  const early = /discovery|preclinical|phase ?1\b|phase_1\b/.test(stage);
  const fields = 'For each give licensor, licensee, asset or program name, mechanism or target, phase at signing, upfront payment, total deal value, royalty range if disclosed, announced date (YYYY-MM-DD) and the press release, SEC filing or exchange announcement URL.';
  const q: string[] = [
    `List biopharma licensing, option and collaboration deals in ${ind} announced between 2019 and today with a disclosed upfront payment or total deal value. Include deals of all sizes and all development stages. ${fields}`,
    early
      ? `List preclinical, discovery-stage and IND-enabling licensing or research collaboration deals in ${ind} announced 2019 to today, including platform and target-discovery collaborations with an ${ind} program named, with any disclosed upfront or total value. ${fields}`
      : `List clinical-stage (Phase 1 to Phase 3) licensing and co-development deals in ${ind} announced 2019 to today with disclosed economics. ${fields}`,
    `List acquisitions of companies or assets in ${ind} announced 2019 to today, with the price, any contingent value rights or milestones, the lead asset and its phase at announcement, and the source URL.`,
  ];
  if (mech) q.push(`List licensing, option, collaboration or acquisition deals for ${mech} programs (any indication, ${t.therapeutic_area} first) announced 2019 to today with disclosed upfront or total value. ${fields}`);
  return q;
}

export interface TopupRunResult {
  topupId: string | null;
  requestId: string | null;
  indication: string | null;
  queriesRun: number;
  dealsDiscovered: number;
  dealsInserted: number;
  status: 'none' | 'done' | 'retry' | 'failed';
  readinessAfter: string | null;
  errors: string[];
}

/** Drain one pending top-up (oldest first) within the time budget. */
export async function runIndicationTopup(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  opts: { timeBudgetMs?: number } = {},
): Promise<TopupRunResult> {
  const timeBudgetMs = opts.timeBudgetMs ?? 120_000;
  const out: TopupRunResult = { topupId: null, requestId: null, indication: null, queriesRun: 0, dealsDiscovered: 0, dealsInserted: 0, status: 'none', readinessAfter: null, errors: [] };

  const { data, error } = await supabase
    .from('brief_topups')
    .select('id, request_id, therapeutic_area, indication, indication_key, phase, mechanism, target, status, runs, readiness_before')
    .eq('status', 'pending')
    .lt('runs', MAX_RUNS)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) { out.errors.push(`topups: ${error.message}`); return out; }
  if (!data) return out;
  const t = data as unknown as TopupRow;
  out.topupId = t.id; out.requestId = t.request_id; out.indication = t.indication;

  const now = new Date().toISOString();
  await supabase.from('brief_topups').update({ status: 'running', runs: t.runs + 1, last_run_at: now }).eq('id', t.id);

  const ta = resolveTherapeuticArea(t.therapeutic_area);
  const queries = buildTopupQueries(t);
  try {
    const r = await runPerplexityDealDiscovery(supabase, perplexityApiKey, anthropicApiKey, {
      therapeuticAreas: [ta],
      extraQueries: { [ta]: queries },
      timeBudgetMs,
    });
    out.queriesRun = r.queries_run; out.dealsDiscovered = r.deals_discovered; out.dealsInserted = r.deals_inserted;
    out.errors.push(...r.errors.slice(0, 5));

    // Readiness after: same card, fresh rows. Verification lags insertion, so the
    // verified share may not move until the verifier reaches the new rows.
    let after: Readiness | null = null;
    try {
      after = await computeReadiness(supabase, { therapeuticArea: t.therapeutic_area, indication: t.indication, phase: t.phase ?? 'phase2' });
      out.readinessAfter = readinessSummary(after);
    } catch (e) { out.errors.push(`readiness after: ${e instanceof Error ? e.message : String(e)}`); }

    const done = !after || !after.topUpRecommended || t.runs + 1 >= MAX_RUNS;
    out.status = done ? 'done' : 'retry';
    await supabase.from('brief_topups').update({
      status: done ? 'done' : 'pending',
      queries_run: out.queriesRun, deals_discovered: out.dealsDiscovered, deals_inserted: out.dealsInserted,
      readiness_after: after, completed_at: done ? new Date().toISOString() : null,
      notes: `run ${t.runs + 1}: ${out.queriesRun} queries, ${out.dealsDiscovered} discovered, ${out.dealsInserted} inserted (pending verification)${out.errors.length ? `; ${out.errors[0]}` : ''}`,
    }).eq('id', t.id);
    if (t.request_id && after) {
      await supabase.from('benchmark_requests').update({ readiness: after, readiness_checked_at: new Date().toISOString() }).eq('id', t.request_id);
    }
  } catch (e) {
    out.status = 'failed';
    out.errors.push(e instanceof Error ? e.message : String(e));
    await supabase.from('brief_topups').update({ status: t.runs + 1 >= MAX_RUNS ? 'failed' : 'pending', notes: `run ${t.runs + 1} failed: ${out.errors[out.errors.length - 1]}` }).eq('id', t.id);
  }
  return out;
}
