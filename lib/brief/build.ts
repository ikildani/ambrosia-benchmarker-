/**
 * Deal Intelligence Brief v3 — orchestrator.
 *
 * Runs every v3 builder in dependency order and returns the
 * `BriefIntelligence` container that `PDFReportData.brief` carries. Each step
 * is isolated: a failing step logs and yields null so the document still
 * renders with an honest empty state instead of failing the whole brief.
 *
 * Order (dependencies in brackets):
 *   1. comps           — quality-filtered deal rows → comp set, regional, term sheet
 *   2. buyer valuations[waterfall, rNPV, partners]
 *   3. buyer map       [partners, valuations]
 *   4. landscape       [market estimate, buyer names]
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
import { buildLandscape, landscapeUsesTerrain } from './landscape';
import { fetchDemandProfile } from './terrain-demand';
import { buildValuationBridge } from './valuation-bridge';
import { buildInflectionPath } from './inflection';
import { buildDecisionSummary } from './decision';
import { buildDiligenceChecklist } from './diligence-checklist';
import { generatePositioningObjections } from '@/lib/ai/objection-generator';
import { fmtM } from '@/lib/report/helpers';
import { loadBriefAccuracyStatement } from '@/lib/outcomes/statements';

export interface BuildBriefInput {
  supabase: SupabaseClient;
  asset: AssetProfile;
  inputs: CalculationInput;
  result: CalculationResult;
  fm: FinancialModelResult;
  partners: PartnerForPDF[];
  memo?: DealMemo;
  defensive?: { walkAwayThreshold: number; defensiveFloor: number } | undefined;
  mpOpinion?: MPOpinion | null;
  /** Diligence items the client says are ready / missing (free text from intake). */
  diligenceReady?: string[];
  diligenceGaps?: string[];
  /** Skip the Anthropic call (tests, offline renders). */
  skipPositioning?: boolean;
  asOf?: string;
  log?: (msg: string) => void;
}

export interface BuildBriefOutput {
  brief: BriefIntelligence;
  /** Buyer-specific valuations for the existing buyer pages. */
  buyerValuations: BuyerSpecificValuation[];
  /** Step-level notes for the admin log. */
  notes: string[];
}

async function step<T>(label: string, notes: string[], log: (m: string) => void, fn: () => Promise<T> | T): Promise<T | null> {
  try {
    const t0 = Date.now();
    const out = await fn();
    log(`[Brief] ${label} ok (${Date.now() - t0} ms)`);
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    notes.push(`${label} failed: ${msg}`);
    log(`[Brief] ${label} FAILED: ${msg}`);
    return null;
  }
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
  const { supabase, asset, inputs, result, fm, partners } = input;

  const brief: BriefIntelligence = { asOf, asset, mpOpinion: input.mpOpinion ?? null };

  // 1. Comps (one round-trip; regional + term sheet derive from the same rows)
  const raw = (await step('comps.fetch', notes, log, () => fetchQualityDealRows(supabase))) ?? [];
  if (raw.length) {
    brief.compSet = await step('comps.set', notes, log, () => buildCompSetFromRows(raw, asset, { asOf }));
    if (brief.compSet) {
      brief.regional = await step('comps.regional', notes, log, () => buildRegionalStrategy(brief.compSet!.rows, asset, asOf));
    }
    brief.termSheet = await step('comps.termSheet', notes, log, () => buildTermSheetPrecedent(selectClauseRows(raw, asset), asset, asOf));
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

  // 3. Buyer map
  if (partners.length) {
    brief.buyerMap = await step('buyers.map', notes, log, () =>
      buildBuyerMap(supabase, asset, partners, { asOf, valuations: buyerValuations }),
    );
  }

  // 4. Landscape. Terrain's demand profile (patient funnel, key programs,
  // crowding) is read here and passed through; it never throws, and the local
  // epidemiology / registry paths remain the fallback. Only the slug and the
  // profile's asOf are recorded (build notes), never Terrain's numbers.
  const buyerNames = brief.buyerMap?.candidates.map(c => c.name) ?? partners.map(p => p.company_name);
  brief.landscape = await step('landscape', notes, log, async () => {
    const demand = await fetchDemandProfile(asset.indication, { territory: asset.territory });
    const landscape = await buildLandscape(supabase, asset, fm.marketSize ?? null, { asOf, buyerNames, terrain: demand?.profile ?? null });
    if (demand && landscapeUsesTerrain(landscape)) {
      notes.push(`terrainAsOf ${demand.asOf} (indication ${asset.indication}${demand.profile.identity.match === 'proxy' ? ', proxy match' : ''})`);
      log(`[Brief] landscape used Terrain demand layer (indication ${asset.indication}, asOf ${demand.asOf})`);
    }
    return landscape;
  });

  // 5. Valuation bridge — single source of truth for ask / floor / walk-away
  brief.bridge = await step('bridge', notes, log, () =>
    buildValuationBridge({
      result,
      rnpv: fm.rnpv,
      monteCarlo: fm.monteCarlo,
      scenarios: fm.scenarios,
      buyerValuations,
      compSet: brief.compSet ?? null,
      defensive: input.defensive as never,
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
  brief.coverage = coverageFromRows(raw, asset, brief, asOf);

  // 11. Resolved-brief accuracy for this TA (outcome ledger). The loader never
  // throws and returns null below the n ≥ 10 threshold, so the methodology
  // page keeps its "omitted rather than estimated" line.
  const accuracy = await step('coverage.accuracy', notes, log, () => loadBriefAccuracyStatement(supabase, asset.therapeuticArea));
  if (accuracy) brief.coverage.accuracy = accuracy;

  return { brief, buyerValuations, notes };
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
