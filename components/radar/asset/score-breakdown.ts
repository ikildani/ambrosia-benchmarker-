/**
 * Score breakdown builder — pure, no I/O.
 *
 * Turns the latest asset_signal_snapshots row into the waterfall the brief
 * renders. Two snapshot shapes are tolerated:
 *
 *   v2 (Workstream D):  factor_scores = { model_version, contributions: ScoreFactorContribution[], raw_weighted, phase_multiplier, availability_factor }
 *                       or factor_scores = ScoreFactorContribution[] with a sibling model_version column
 *   legacy (103):       factor_scores = { cash_runway: 42, ..., availability_factor, phase_multiplier, raw_weighted, score_confidence }
 *
 * For the legacy shape the per-factor evidence is joined from the active
 * licensing_signals rows (one per factor) so every factor still shows text,
 * URL, date and the sources the detector checked.
 */

import { FACTOR_WEIGHTS, SIGNAL_TYPES } from '@/lib/radar/signal-detection';
import type { ScoreFactorContribution } from '@/lib/radar/types';
import type { ScoreBreakdown, ScoreWaterfallStep } from './types';
import { factorLabel } from './format';

export const LEGACY_MODEL_VERSION = 'v2.0-legacy';

/** Sources each legacy detector consults (mirrors sourcesChecked in signal-detection.ts). */
const LEGACY_SOURCES: Record<string, string[]> = {
  cash_runway: ['companies', 'press_releases'],
  bd_executive_hire: ['press_releases'],
  conference_activity: ['research_signals', 'press_releases'],
  regulatory_milestone: ['clinical_assets', 'company_trials', 'press_releases'],
  competitor_failure: ['company_trials', 'deals'],
  management_commentary: ['press_releases', 'companies'],
  patent_filing: ['research_signals'],
  publication_velocity: ['research_signals'],
  strategic_review: ['press_releases', 'companies'],
};

export interface SignalEvidenceRow {
  signal_type: string;
  signal_value: number | string | null;
  confidence: number | string | null;
  evidence_text: string | null;
  evidence_url: string | null;
  evidence_date: string | null;
  evidence_source?: string | null;
  detected_at?: string | null;
}

export interface SnapshotLike {
  factor_scores: unknown;
  model_version?: string | null;
  licensing_intent_score: number | string | null;
  snapshot_date: string | null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

function isContribution(v: unknown): v is ScoreFactorContribution {
  return !!v && typeof v === 'object' && typeof (v as ScoreFactorContribution).factor === 'string'
    && 'score' in (v as object) && 'weight' in (v as object);
}

/** Normalise any snapshot shape into a contribution list plus the multipliers. */
export function parseSnapshotFactors(snapshot: SnapshotLike | null, signals: SignalEvidenceRow[] = []): {
  contributions: ScoreFactorContribution[];
  raw_weighted: number | null;
  phase_multiplier: number;
  availability_factor: number;
  model_version: string;
  legacy: boolean;
} {
  const fs = snapshot?.factor_scores;
  let contributions: ScoreFactorContribution[] = [];
  let raw: number | null = null;
  let phase = 1;
  let availability = 1;
  let model = snapshot?.model_version || '';
  let legacy = false;

  if (Array.isArray(fs) && fs.every(isContribution)) {
    contributions = fs.map(normaliseContribution);
  } else if (fs && typeof fs === 'object') {
    const obj = fs as Record<string, unknown>;
    if (Array.isArray(obj.contributions) && (obj.contributions as unknown[]).every(isContribution)) {
      contributions = (obj.contributions as ScoreFactorContribution[]).map(normaliseContribution);
      model = model || String(obj.model_version || '');
      raw = obj.raw_weighted != null ? num(obj.raw_weighted) : null;
      phase = obj.phase_multiplier != null ? num(obj.phase_multiplier, 1) : 1;
      availability = obj.availability_factor != null ? num(obj.availability_factor, 1) : 1;
    } else {
      legacy = true;
      const bySignal = new Map<string, SignalEvidenceRow>();
      for (const s of signals) {
        // Highest-value active row per factor wins.
        const cur = bySignal.get(s.signal_type);
        if (!cur || num(s.signal_value) > num(cur.signal_value)) bySignal.set(s.signal_type, s);
      }
      contributions = SIGNAL_TYPES.map(type => {
        const weight = FACTOR_WEIGHTS[type] ?? 0;
        const score = Math.max(0, Math.min(100, num(obj[type])));
        const sig = bySignal.get(type);
        return {
          factor: type,
          weight,
          score,
          points: Math.round(score * weight * 100) / 100,
          confidence: sig ? num(sig.confidence, 0) : 0,
          evidence_text: sig?.evidence_text ?? null,
          evidence_url: sig?.evidence_url ?? null,
          evidence_date: sig?.evidence_date ?? (sig?.detected_at ? String(sig.detected_at).slice(0, 10) : null),
          sources_checked: LEGACY_SOURCES[type] ?? [],
        };
      });
      raw = obj.raw_weighted != null ? num(obj.raw_weighted) : null;
      phase = obj.phase_multiplier != null ? num(obj.phase_multiplier, 1) : 1;
      availability = obj.availability_factor != null ? num(obj.availability_factor, 1) : 1;
      model = model || LEGACY_MODEL_VERSION;
    }
  }

  // Guarantee all nine factors are present (zero rows included).
  const seen = new Set(contributions.map(c => c.factor));
  for (const type of SIGNAL_TYPES) {
    if (!seen.has(type)) {
      contributions.push({
        factor: type, weight: FACTOR_WEIGHTS[type] ?? 0, score: 0, points: 0, confidence: 0,
        evidence_text: null, evidence_url: null, evidence_date: null, sources_checked: LEGACY_SOURCES[type] ?? [],
      });
    }
  }
  contributions.sort((a, b) => b.points - a.points || b.weight - a.weight);

  if (raw == null) raw = contributions.reduce((s, c) => s + c.points, 0);

  return { contributions, raw_weighted: raw, phase_multiplier: phase, availability_factor: availability, model_version: model || LEGACY_MODEL_VERSION, legacy };
}

function normaliseContribution(c: ScoreFactorContribution): ScoreFactorContribution {
  return {
    factor: c.factor,
    weight: num(c.weight),
    score: num(c.score),
    points: c.points != null ? num(c.points) : Math.round(num(c.score) * num(c.weight) * 100) / 100,
    confidence: num(c.confidence),
    evidence_text: c.evidence_text ?? null,
    evidence_url: c.evidence_url ?? null,
    evidence_date: c.evidence_date ?? null,
    sources_checked: Array.isArray(c.sources_checked) ? c.sources_checked : [],
  };
}

/**
 * Build the full breakdown for the brief. `currentScore` / `currentConfidence`
 * come from clinical_assets (authoritative composite); the snapshot supplies
 * the decomposition. When the two disagree (snapshot older than the score)
 * the composite shown is the asset's and the waterfall notes the gap.
 */
export function buildScoreBreakdown(args: {
  currentScore: number | string | null;
  currentConfidence: number | string | null;
  snapshot: SnapshotLike | null;
  signals?: SignalEvidenceRow[];
}): ScoreBreakdown {
  const parsed = parseSnapshotFactors(args.snapshot, args.signals ?? []);
  const score = Math.round(num(args.currentScore));
  const confidence = Math.round(num(args.currentConfidence));

  const waterfall: ScoreWaterfallStep[] = [];
  let running = 0;
  for (const c of parsed.contributions) {
    running += c.points;
    waterfall.push({ key: c.factor, label: factorLabel(c.factor), kind: 'factor', value: c.points, running, contribution: c });
  }
  const raw = parsed.raw_weighted ?? running;
  waterfall.push({ key: 'raw_weighted', label: 'Weighted evidence', kind: 'total', value: raw, running: raw });
  running = raw * parsed.phase_multiplier;
  waterfall.push({ key: 'phase_multiplier', label: 'Phase prior', kind: 'multiplier', value: parsed.phase_multiplier, running });
  running = running * parsed.availability_factor;
  waterfall.push({ key: 'availability_factor', label: 'Rights availability', kind: 'multiplier', value: parsed.availability_factor, running });
  waterfall.push({ key: 'composite', label: 'Licensing intent score', kind: 'total', value: score, running: score });

  return {
    score,
    confidence,
    model_version: parsed.model_version,
    contributions: parsed.contributions,
    raw_weighted: Math.round(raw * 100) / 100,
    phase_multiplier: parsed.phase_multiplier,
    availability_factor: parsed.availability_factor,
    waterfall,
    legacy_shape: parsed.legacy,
    snapshot_date: args.snapshot?.snapshot_date ?? null,
  };
}

/** Score at or before `days` ago from a descending-by-date series; null when the series is too short. */
export function deltaOverDays(points: { date: string; score: number }[], days: number, now = new Date()): number | null {
  if (points.length < 2) return null;
  const latest = points[0];
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const older = points.find(p => new Date(p.date) <= cutoff);
  if (!older) return null;
  return Math.round(latest.score - older.score);
}
