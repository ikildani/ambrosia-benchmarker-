/**
 * Deal Intelligence Brief v3 — orchestrator.
 *
 * Runs every v3 builder in dependency order and returns the
 * `BriefIntelligence` container that `PDFReportData.brief` carries. Each step
 * is isolated: a failing step logs and yields null so the document still
 * renders with an honest empty state instead of failing the whole brief.
 *
 * Two steps are load-bearing and are reported as `fatal` when they fail:
 * the comparable-deal fetch and the buyer map. Without them the decision
 * page would print "Hold: no buyer transacts at this phase" because of an
 * infrastructure timeout, not because of the evidence. Callers must not
 * deliver a brief whose `fatal` list is non-empty. Database reads are retried
 * before they count as failed (Supabase returns Cloudflare 522 pages under
 * load).
 *
 * Order (dependencies in brackets):
 *   1. comps           — quality-filtered deal rows → comp set, regional, term sheet
 *   2. buyer valuations[waterfall, rNPV, partners]
 *   3. buyer map       [partners, valuations]
 *   4. landscape       [market estimate, rNPV peak sales, buyer names]
 *   5. bridge          [result, rNPV, MC, scenarios, valuations, comps]
 *   6. inflection      [inputs, result, rNPV]
 *   7. decision        [bridge, inflection, buyer map, comps, catalyst window]
 *   8. diligence       [asset, intake ready/gaps]
 *   9. positioning     [decision, comps, buyer map]  (Anthropic call, optional)
 *  10. coverage        [raw rows, comps]
 *  11. coverage.accuracy [accuracy_rollups for the TA; null below n = 10]
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalculationInput, CalculationResult } from '@/lib/calculations';
import type { FinancialModelResult } from '@/lib/financial/run-financial-model';
import type { BuyerSpecificValuation } from '@/lib/financial/buyer-specific-valuation';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import type { PartnerForPDF } from '@/lib/report/types';
import type { AssetProfile, BriefIntelligence, DataCoverage, MPOpinion } from './types';
import {
  fetchQualityDealRows,
  buildCompSetFromRows,
  selectClauseRows,
  isSameTA,
  isSameIndication,
  type RawDealRow,
} from './comp-set';
import { buildRegionalStrategy } from './regional';
import { buildTermSheetPrecedent } from './term-sheet';
import { computeBuyerValuations, type PremiumEntry } from './buyer-valuations';
import { buildBuyerMap } from './buyer-map';
import { buildLandscape } from './landscape';
import { buildValuationBridge } from './valuation-bridge';
import { buildInflectionPath } from './inflection';
import { buildDecisionSummary } from './decision';
import { buildDiligenceChecklist } from './diligence-checklist';
import { generatePositioningObjections } from '@/lib/ai/objection-generator';
import { fmtM } from '@/lib/report/helpers';
import { loadBriefAccuracyStatement } from '@/lib/outcomes/statements';

export const DB_RETRY_ATTEMPTS = 3;
export const DB_RETRY_BASE_MS = 1500;

export interface BuildBriefInput {
  supabase: SupabaseClient;
  asset: AssetProfile;
  inputs: CalculationInput;
  result: CalculationResult;
  fm: FinancialModelResult;
  partners: PartnerForPDF[];
  memo?: DealMemo;
  mpOpinion?: MPOpinion | null;
  /** Diligence items the client says are ready / missing (free text from intake). */
  diligenceReady?: string[];
  diligenceGaps?: string[];
  /** Skip the Anthropic call (tests, offline renders). */
  skipPositioning?: boolean;
  asOf?: string;
  log?: (msg: string) => void;
  /** Override the retry pause (tests). */
  retryBaseMs?: number;
}

export interface BuildBriefOutput {
  brief: BriefIntelligence;
  /** Buyer-specific valuations for the existing buyer pages. */
  buyerValuations: BuyerSpecificValuation[];
  /** Step-level notes for the admin log. */
  notes: string[];
  /**
   * Load-bearing steps that failed after retries. A brief with entries here
   * must not be delivered: its decision page would rest on missing evidence.
   */
  fatal: string[];
}

async function step<T>(label: string, notes: string[], log: (m: string) => void, fn: () => Promise<T> | T): Promise<T | null> {
  try {
    const t0 = Date.now();
    const out = await fn();
    log(`[Brief] ${label} ok (${Date.now() - t0} ms)`);
    return out;
  } catch (err) {
    const msg = shortError(err);
    notes.push(`${label} failed: ${msg}`);
    log(`[Brief] ${label} FAILED: ${msg}`);
    return null;
  }
}

/** Retry a database read with linear back-off; rethrows the last error. */
async function withRetry<T>(label: string, log: (m: string) => void, baseMs: number, fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      log(`[Brief] ${label} attempt ${attempt}/${DB_RETRY_ATTEMPTS} failed: ${shortError(err)}`);
      if (attempt < DB_RETRY_ATTEMPTS && baseMs > 0) await new Promise(r => setTimeout(r, baseMs * attempt));
    }
  }
  throw lastErr;
}

/** Supabase errors under load carry a whole Cloudflare HTML page; keep the first line. */
export function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /<title>([^<]+)<\/title>/i.exec(msg);
  if (m) return `upstream error: ${m[1].trim()}`;
  const firstLine = msg.split('\n')[0].trim();
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}…` : firstLine;
}

function summariseComps(brief: BriefIntelligence): string {
  const cs = brief.compSet;
  if (!cs || cs.rows.length === 0) return 'No comparable set could be built for this asset.';
  const st = cs.stats.exOutliers.n >= 3 ? cs.stats.exOutliers : cs.stats.all;
  const same = cs.rows.filter(r => r.sameIndication).length;
  const parts = [`${cs.rows.length} comparable deals (${same} same indication, ${cs.source.note ?? ''})`.trim()];
  if (st.upfront) parts.push(`upfront p25/p50/p75 ${fmtM(st.upfront.p25)}/${fmtM(st.upfront.p50)}/${fmtM(st.upfront.p75)}`);
  if (st.total) parts.push(`total p25/p50/p75 ${fmtM(st.total.p25)}/${fmtM(st.total.p50)}/${fmtM(st.total.p75)}`);
  if (cs.caveat) parts.push(cs.caveat);
  return parts.join('; ');
}

function summariseBuyers(brief: BriefIntelligence): string {
  const bm = brief.buyerMap;
  if (!bm || bm.candidates.length === 0) return 'No buyer map available.';
  const top = bm.candidates.slice(0, 5).map(c =>
    `${c.name} (fit ${Math.round(c.fit)}, urgency ${Math.round(c.urgency)}, transacts at phase: ${c.transactsAtPhase}${c.priorDeals[0] ? `, last: ${c.priorDeals[0].parties} ${c.priorDeals[0].year ?? ''}` : ''})`,
  );
  return `Lead: ${bm.process.lead.join(', ') || 'none'}; tension: ${bm.process.tension.join(', ') || 'none'}. ${top.join('. ')}. ${bm.process.rationale}`;
}

export async function buildBrief(input: BuildBriefInput): Promise<BuildBriefOutput> {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const log = input.log ?? ((m: string) => console.log(m));
  const notes: string[] = [];
  const fatal: string[] = [];
  const retryMs = input.retryBaseMs ?? DB_RETRY_BASE_MS;
  const { supabase, asset, inputs, result, fm, partners } = input;

  const brief: BriefIntelligence = { asOf, asset, mpOpinion: input.mpOpinion ?? null };

  // 1. Comps (one round-trip; regional + term sheet derive from the same rows)
  const raw = await step('comps.fetch', notes, log, () => withRetry('comps.fetch', log, retryMs, () => fetchQualityDealRows(supabase)));
  if (raw == null) fatal.push('comps.fetch');
  const rows = raw ?? [];
  if (rows.length) {
    brief.compSet = await step('comps.set', notes, log, () => buildCompSetFromRows(rows, asset, { asOf }));
    if (brief.compSet) {
      brief.regional = await step('comps.regional', notes, log, () => buildRegionalStrategy(brief.compSet!.rows, asset, asOf));
    }
    brief.termSheet = await step('comps.termSheet', notes, log, () => buildTermSheetPrecedent(selectClauseRows(rows, asset), asset, asOf));
  }

  // 2. Buyer valuations (existing engine) — needs waterfall + rNPV
  let buyerValuations: BuyerSpecificValuation[] = [];
  if (fm.dealWaterfall && fm.rnpv && partners.length) {
    const premiums = await step('buyers.premiums', notes, log, async () => {
      const names = partners.slice(0, 10).map(p => p.company_name);
      const { data } = await supabase
        .from('counterparty_premiums')
        .select('company_name, premium_multiplier, sample_size, confidence')
        .in('company_name', names);
      const map = new Map<string, PremiumEntry>();
      for (const r of (data ?? []) as Array<{ company_name: string; premium_multiplier: number; sample_size: number; confidence: string }>) {
        map.set(r.company_name.toLowerCase(), { multiplier: Number(r.premium_multiplier), n: Number(r.sample_size), confidence: r.confidence });
      }
      return map;
    });
    buyerValuations = (await step('buyers.valuations', notes, log, () =>
      computeBuyerValuations(partners, fm.dealWaterfall!, fm.rnpv!, premiums ?? undefined, 4),
    )) ?? [];
  }

  // 3. Buyer map — always attempted; the deal-history supplement inside can
  //    build a list even when partner matching returned nothing.
  brief.buyerMap = await step('buyers.map', notes, log, () =>
    withRetry('buyers.map', log, retryMs, () => buildBuyerMap(supabase, asset, partners, { asOf, valuations: buyerValuations })),
  );
  if (brief.buyerMap == null) fatal.push('buyers.map');

  // 4. Landscape
  const buyerNames = brief.buyerMap?.candidates.map(c => c.name) ?? partners.map(p => p.company_name);
  brief.landscape = await step('landscape', notes, log, () =>
    buildLandscape(supabase, asset, fm.marketSize ?? null, { asOf, buyerNames, rnpv: fm.rnpv }),
  );

  // 5. Valuation bridge — single source of truth for ask / floor / walk-away
  brief.bridge = await step('bridge', notes, log, () =>
    buildValuationBridge({
      result,
      rnpv: fm.rnpv,
      monteCarlo: fm.monteCarlo,
      scenarios: fm.scenarios,
      buyerValuations,
      compSet: brief.compSet ?? null,
      asOf,
    }),
  );

  // 6. Inflection path
  brief.inflection = await step('inflection', notes, log, () =>
    buildInflectionPath({ inputs, result, rnpv: fm.rnpv, asOf }),
  );

  // 7. Decision summary
  if (brief.bridge) {
    brief.decision = await step('decision', notes, log, () =>
      buildDecisionSummary({
        asset,
        bridge: brief.bridge!,
        inflection: brief.inflection,
        buyerMap: brief.buyerMap,
        compSet: brief.compSet,
        catalystWindow: brief.landscape?.catalysts?.recommendedWindow ?? null,
        memo: input.memo,
        result,
        asOf,
      }),
    );
  }

  // 8. Diligence readiness
  brief.diligence = await step('diligence', notes, log, () =>
    buildDiligenceChecklist(asset, { ready: input.diligenceReady, gaps: input.diligenceGaps }),
  );

  // 9. Positioning & objections (model call; falls back deterministically inside)
  if (brief.decision && !input.skipPositioning) {
    brief.positioning = await step('positioning', notes, log, () =>
      generatePositioningObjections({
        asset,
        decision: brief.decision!,
        compSummary: summariseComps(brief),
        buyerSummary: summariseBuyers(brief),
      }),
    );
  }

  // 10. Coverage (honesty block)
  brief.coverage = coverageFromRows(rows, asset, brief, asOf);

  // 11. Resolved-brief accuracy for this TA (outcome ledger). The loader never
  // throws and returns null below the n ≥ 10 threshold, so the methodology
  // page keeps its "omitted rather than estimated" line.
  const accuracy = await step('coverage.accuracy', notes, log, () => loadBriefAccuracyStatement(supabase, asset.therapeuticArea));
  if (accuracy) brief.coverage.accuracy = accuracy;

  if (fatal.length) log(`[Brief] FATAL: ${fatal.join(', ')} — do not deliver`);
  return { brief, buyerValuations, notes, fatal };
}

export function coverageFromRows(raw: RawDealRow[], asset: AssetProfile, brief: BriefIntelligence, asOf: string): DataCoverage {
  return {
    asOf,
    trackedDeals: raw.length,
    verifiedDeals: raw.filter(r => r.verified).length,
    taDeals: raw.filter(r => isSameTA(r, asset.therapeuticArea)).length,
    indicationDeals: raw.filter(r => isSameIndication(r, asset.indication)).length,
    compsUsed: brief.compSet?.rows.length ?? 0,
    accuracy: null,
  };
}
