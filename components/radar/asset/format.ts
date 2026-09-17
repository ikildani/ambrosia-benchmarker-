/**
 * Formatting helpers for the asset brief (page, PDF and XLSX share these so
 * the same number renders identically everywhere).
 */

import { radarLabel } from '@/lib/radar/vocab';

export function fmtM(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return 'Undisclosed';
  const n = Number(v);
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  if (n >= 1) return `$${Math.round(n)}M`;
  return `$${n.toFixed(1)}M`;
}

export function fmtRoyalty(low: number | null | undefined, high: number | null | undefined): string {
  if (low == null && high == null) return 'Undisclosed';
  const l = low != null ? Number(low).toFixed(1) : '?';
  const h = high != null ? Number(high).toFixed(1) : '?';
  return low === high || high == null ? `${l}%` : `${l}–${h}%`;
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${Number(v).toFixed(digits)}%`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

export function daysAgo(d: string | null | undefined, now = new Date()): number | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return Math.max(0, Math.round((now.getTime() - dt.getTime()) / 86_400_000));
}

export function fmtAge(d: string | null | undefined, now = new Date()): string {
  const n = daysAgo(d, now);
  if (n == null) return 'never';
  if (n === 0) return 'today';
  if (n === 1) return '1 day ago';
  if (n < 30) return `${n} days ago`;
  if (n < 365) return `${Math.round(n / 30)} mo ago`;
  return `${(n / 365).toFixed(1)} y ago`;
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US');
}

/** Human label for any radar slug (phase, TA, modality, region, country, status). */
export function label(value: string | null | undefined): string {
  if (!value) return '—';
  return radarLabel(value);
}

export function fmtPhaseDb(p: string | null | undefined): string {
  if (!p) return '—';
  return p.replace(/_/g, ' ').replace(/\bphase\b/i, 'Phase').replace(/\bnda\b/i, 'NDA').replace(/\bbla\b/i, 'BLA').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

export const FACTOR_LABELS: Record<string, string> = {
  cash_runway: 'Cash runway pressure',
  regulatory_milestone: 'Regulatory milestones',
  competitor_failure: 'Competitor failure',
  management_commentary: 'Management commentary',
  strategic_review: 'Strategic review',
  patent_filing: 'Patent filings',
  publication_velocity: 'Publication velocity',
  conference_activity: 'Conference activity',
  bd_executive_hire: 'BD executive hiring',
};

export function factorLabel(key: string): string {
  return FACTOR_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const INTEL_LABELS: Record<string, string> = {
  user_interest: 'Platform interest',
  competitor_deal: 'Competitor deal',
  patent_overlap: 'Patent overlap',
  conference_overlap: 'Conference overlap',
  trial_crowding: 'Trial crowding',
  publication_race: 'Publication race',
};

export const GAP_LABELS: Record<string, string> = {
  patent_cliff_replacement: 'Patent cliff replacement',
  therapeutic_gap: 'Therapeutic-area expansion',
  modality_gap: 'Modality gap',
  pipeline_stage_gap: 'Pipeline-stage gap',
  geographic_gap: 'Geographic gap',
  competitive_response: 'Competitive response',
};

export const TERRITORY_LABELS: Record<string, string> = {
  us: 'United States', eu: 'Europe', japan: 'Japan', china: 'China', row: 'Rest of world',
  global: 'Global', north_america: 'North America', europe: 'Europe', asia: 'Asia', ex_us: 'Ex-US',
};

export function territoryLabel(t: string): string {
  return TERRITORY_LABELS[t.toLowerCase()] ?? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function sourceLabel(sourceType: string | null | undefined): string {
  switch (sourceType) {
    case 'sec_8k': return 'SEC 8-K';
    case 'sec_10k': return '10-K';
    case 'sec_10q': return '10-Q';
    case 'press_release': return 'Press release';
    case 'clinicaltrials': return 'CT.gov';
    case 'manual': return 'Curated';
    default: return sourceType ? sourceType.replace(/_/g, ' ') : 'Internal';
  }
}

export function signedPts(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}
