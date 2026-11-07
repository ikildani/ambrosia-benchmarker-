/**
 * Score archive entry for a generated Deal Intelligence Brief.
 *
 * The ledger trigger already copies the brief's `predictions` row (ask /
 * floor, lead + tension buyers, window). This keeps the rest of the call:
 * the recommendation, walk-away, royalty ask and every ranked buyer's fit
 * and urgency. Only numbers, enums and public buyer names are kept — no
 * prose, and the client's asset and company appear only as a hash.
 */

import type { BriefIntelligence } from '@/lib/brief/types';
import type { ScoreArchiveEntry } from './index';

export function briefArchiveEntry(
  brief: BriefIntelligence,
  ctx: { requestId: string; predictionId: string | null; modelVersion: string; priorsAsOf: string | null; origin?: 'user' | 'platform' },
): ScoreArchiveEntry | null {
  const d = brief.decision;
  const b = brief.bridge;
  if (!d && !b) return null;
  const a = brief.asset;
  return {
    product: 'solidus',
    scoreType: 'brief.call',
    modelVersion: ctx.modelVersion,
    origin: ctx.origin ?? 'user',
    entityType: 'prediction',
    entityId: ctx.predictionId ?? ctx.requestId,
    therapeuticArea: a.therapeuticArea,
    phase: a.phase,
    modality: a.modality,
    indication: a.indication,
    sourceTable: 'benchmark_requests',
    sourceId: ctx.requestId,
    predictionId: ctx.predictionId,
    confidential: true,
    inputs: {
      asset: a,
      client: brief.client ?? null,
    },
    output: {
      as_of: brief.asOf,
      recommendation: d?.recommendation ?? null,
      confidence: d?.confidence ?? null,
      ask: d?.ask ?? (b ? { ...b.ask, royaltyPct: null } : null),
      floor: d?.floor ?? b?.floor ?? null,
      walk_away_upfront_m: d?.walkAwayUpfrontM ?? b?.walkAway.upfrontM ?? null,
      ask_basis: b?.askBasis ?? null,
      rnpv_informative: b?.rnpvInformative ?? null,
      process: brief.buyerMap
        ? { lead: brief.buyerMap.process.lead, tension: brief.buyerMap.process.tension, hold: brief.buyerMap.process.hold }
        : null,
      buyers: (brief.buyerMap?.candidates ?? []).map((c) => ({
        company_id: c.companyId,
        name: c.name,
        fit: c.fit,
        urgency: c.urgency,
        intent_score: c.intentScore,
      })),
      recommended_window: brief.landscape?.catalysts?.recommendedWindow
        ? { start: brief.landscape.catalysts.recommendedWindow.start, end: brief.landscape.catalysts.recommendedWindow.end }
        : null,
    },
    dataAsOf: ctx.priorsAsOf,
  };
}
