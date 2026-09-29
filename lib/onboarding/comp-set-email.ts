/**
 * "Your comp set" email: the automated version of the comparable-deal set
 * Issa sends prospects by hand.
 *
 * Once a signed-up user has benchmarked a program and stopped iterating, the
 * calculation-convert cron takes their latest calculation and sends:
 *   - their own benchmark (upfront / total / royalty ranges from the calculator);
 *   - what comparable deals actually paid (quartiles over the comp set);
 *   - the closest comparable deals, each with a link to its source document;
 *   - a public /share link to their full benchmark, forwardable to a colleague;
 *   - one next step: the 7-day Pro trial, or "open in Solidus" for Pro users.
 *
 * Every comparable comes from `deals_verified` (CLAUDE.md: product surfaces
 * read the verified view), so nothing synthetic, duplicate, rejected or
 * flagged reaches the email.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { buildCompSetFromRows, DEAL_SELECT_COLUMNS, type RawDealRow } from '@/lib/brief/comp-set';
import type { AssetProfile, CompRow, CompSet } from '@/lib/brief/types';
import { INDICATION_REGISTRY } from '@/lib/benchmarkPagesIndication';
import { envelope, p, button, callout, signature, esc } from '@/lib/email/brief-template';

const SITE = 'https://solidus.ambrosiaventures.co';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Fewer comparables than this and the email is not worth sending. */
export const MIN_COMPS = 5;
/** Comparable rows printed in the email; the rest sit behind the share link. */
export const COMPS_SHOWN = 8;
const SHARE_EXPIRES_DAYS = 90;

// ─── Data ──────────────────────────────────────────────────────────────────

/** Every verified deal, paged in 1,000s. Fetched once per cron run and reused for every user. */
export async function fetchVerifiedDealRows(supabase: SupabaseClient): Promise<RawDealRow[]> {
  const out: RawDealRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('deals_verified')
      .select(DEAL_SELECT_COLUMNS)
      // A terminated, expired or cancelled deal is not a precedent for what a buyer will pay now.
      .or('deal_status.is.null,deal_status.not.in.("terminated","expired","cancelled")')
      .order('announced_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`comp-set email: deals_verified query failed: ${error.message}`);
    const batch = (data ?? []) as unknown as RawDealRow[];
    out.push(...batch);
    if (batch.length < page) break;
  }
  return out;
}

/** The calculations-table columns this module reads. */
export interface CalculationRow {
  id: string;
  user_id: string;
  created_at: string;
  therapeutic_area: string | null;
  modality: string | null;
  development_phase: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  territory_scope: string | null;
  deal_type: string | null;
  output_upfront_low: number | string | null;
  output_upfront_mid: number | string | null;
  output_upfront_high: number | string | null;
  output_total_deal_value_low: number | string | null;
  output_total_deal_value_high: number | string | null;
  output_royalty_low: number | string | null;
  output_royalty_high: number | string | null;
  inputs: Record<string, unknown> | null;
}

export const CALCULATION_COLUMNS =
  'id, user_id, created_at, therapeutic_area, modality, development_phase, indication_category, indication_specific, territory_scope, deal_type, output_upfront_low, output_upfront_mid, output_upfront_high, output_total_deal_value_low, output_total_deal_value_high, output_royalty_low, output_royalty_high, inputs';

const REGISTRY_LABEL = new Map(INDICATION_REGISTRY.map((d) => [d.value.toLowerCase(), d.label]));

export function indicationLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return REGISTRY_LABEL.get(key.toLowerCase()) ?? humanize(key);
}

export function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PHASE_LABEL: Record<string, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase1: 'Phase 1', phase1_2: 'Phase 1/2', phase2: 'Phase 2',
  phase2b: 'Phase 2b', phase3: 'Phase 3', nda: 'NDA/BLA', approved: 'Approved',
};
export const phaseLabel = (k: string | null | undefined): string => (k ? PHASE_LABEL[k] ?? humanize(k) : 'Unspecified phase');

const MODALITY_LABEL: Record<string, string> = {
  smallMolecule: 'small molecule', mab: 'antibody', adc: 'ADC', bispecific: 'bispecific', cellTherapy: 'cell therapy',
  geneTherapy: 'gene therapy', rnai: 'RNAi', aso: 'ASO', mrna: 'mRNA', peptide: 'peptide', vaccine: 'vaccine',
  radiopharm: 'radiopharmaceutical', glp1Agonist: 'GLP-1 agonist', degrader: 'degrader',
};
export const modalityLabel = (k: string | null | undefined): string => (k ? MODALITY_LABEL[k] ?? humanize(k).toLowerCase() : '');

/** Map a saved calculation to the comp-set builder's asset profile. Null when it lacks the basics. */
export function assetFromCalculation(calc: CalculationRow): AssetProfile | null {
  const indication = calc.indication_specific || calc.indication_category;
  if (!calc.therapeutic_area || !calc.development_phase || !indication) return null;
  return {
    modality: calc.modality ?? '',
    phase: calc.development_phase,
    indication,
    indicationLabel: indicationLabel(indication),
    therapeuticArea: calc.therapeutic_area,
    territory: calc.territory_scope ?? 'global',
    targetDealType: calc.deal_type ?? 'licensing',
  };
}

export function buildUserCompSet(rows: RawDealRow[], asset: AssetProfile): CompSet {
  return buildCompSetFromRows(rows, asset, { maxRows: 30 });
}

/** True when the comp set is strong enough to put in front of a prospect. */
export function compSetIsSendable(cs: CompSet): boolean {
  const priced = cs.rows.filter((r) => r.upfrontM != null || r.totalM != null);
  return priced.length >= MIN_COMPS;
}

/**
 * Publish the user's benchmark as a public /share link they can forward.
 * Recomputes from the stored inputs with the live engine. Returns null if
 * anything fails: the email then links to the calculator instead.
 */
export async function createBenchmarkShareLink(
  supabase: SupabaseClient,
  owner: { id: string; email: string },
  inputs: Record<string, unknown> | null,
): Promise<string | null> {
  if (!inputs || typeof inputs !== 'object') return null;
  try {
    const [{ calculateDealTerms }, { ensureBenchmarksLoaded }, { buildShareProvenance }] = await Promise.all([
      import('@/lib/calculations'),
      import('@/lib/benchmarks'),
      import('@/lib/financial/calculation-version'),
    ]);
    await ensureBenchmarksLoaded();
    const result = calculateDealTerms(inputs as never);
    const results = result as unknown as Record<string, unknown>;
    // 12 URL-safe characters, the same shape as the share tokens nanoid(12) makes elsewhere.
    const token = randomBytes(9).toString('base64url');
    const row = {
      share_token: token,
      user_id: owner.id,
      email: owner.email,
      inputs,
      results,
      labels: result.labels,
      is_public: true,
      expires_at: new Date(Date.now() + SHARE_EXPIRES_DAYS * 86_400_000).toISOString(),
    };
    let { error } = await supabase
      .from('shared_calculations')
      .insert({ ...row, provenance: buildShareProvenance(inputs, results) });
    if (error && (error.code === 'PGRST204' || (error.message ?? '').includes("'provenance' column"))) {
      ({ error } = await supabase.from('shared_calculations').insert(row));
    }
    if (error) {
      console.error('[comp-set-email] share insert failed:', error.message);
      return null;
    }
    return `${SITE}/share/${token}`;
  } catch (err) {
    console.error('[comp-set-email] share link failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Formatting ────────────────────────────────────────────────────────────

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** $M in, "$80M" / "$1.9B" out. */
export function fmtM(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return 'n/d';
  if (m >= 1000) return `$${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)}B`;
  if (m >= 10) return `$${Math.round(m)}M`;
  return `$${m.toFixed(1)}M`;
}

const fmtRange = (lo: number | null, hi: number | null): string | null =>
  lo != null && hi != null ? `${fmtM(lo)} to ${fmtM(hi)}` : null;

const fmtPct = (v: number | null | undefined) => (v == null ? null : `${Math.round(v * 10) / 10}%`);

const STRUCTURE_LABEL: Record<string, string> = {
  license: 'License', option: 'Option', acquisition: 'Acquisition', collaboration: 'Collaboration',
  co_development: 'Co-development', co_promotion: 'Co-promotion', other: 'Deal',
};
const PHASE_SHORT: Record<string, string> = {
  discovery: 'Disc.', preclinical: 'Preclin.', phase_1: 'Ph 1', phase_2: 'Ph 2', phase_3: 'Ph 3', approved: 'Approved', unknown: '',
};

function compTable(rows: CompRow[]): string {
  const th = (t: string, align = 'left') =>
    `<th style="text-align:${align}; padding: 8px 6px; font-family:${FONT}; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:#64748b; border-bottom:2px solid #e2e8f0;">${t}</th>`;
  const td = (h: string, align = 'left', extra = '') =>
    `<td style="text-align:${align}; padding: 9px 6px; font-family:${FONT}; font-size:13px; line-height:1.4; color:#0b1220; border-bottom:1px solid #eef2f7; vertical-align:top; ${extra}">${h}</td>`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; margin: 8px 0 6px;">
    <tr>${th('Deal')}${th('Stage')}${th('Upfront', 'right')}${th('Total', 'right')}${th('Source', 'right')}</tr>
    ${rows.map((r) => {
      const parties = `${esc(r.licensor)} <span style="color:#94a3b8;">&rarr;</span> ${esc(r.licensee)}`;
      const indText = r.indication && r.indication.length > 60 ? `${r.indication.slice(0, 57).trimEnd()}...` : r.indication;
      const sub = [r.year, STRUCTURE_LABEL[r.structure], indText ? esc(indText) : null].filter(Boolean).join(' · ');
      const source = r.sourceUrl
        ? `<a href="${esc(r.sourceUrl)}" style="color:#0f766e; text-decoration:none;">Source&nbsp;&#8599;</a>`
        : '<span style="color:#94a3b8;">n/a</span>';
      return `<tr>
        ${td(`<div style="font-weight:600;">${parties}</div><div style="font-size:12px; color:#64748b; margin-top:2px;">${sub}</div>`)}
        ${td(esc(PHASE_SHORT[r.phase] || ''), 'left', 'white-space:nowrap; color:#475569;')}
        ${td(r.upfrontM != null ? fmtM(r.upfrontM) : '<span style="color:#94a3b8;">n/d</span>', 'right', 'white-space:nowrap;')}
        ${td(r.totalM != null ? fmtM(r.totalM) : '<span style="color:#94a3b8;">n/d</span>', 'right', 'white-space:nowrap;')}
        ${td(source, 'right', 'white-space:nowrap;')}
      </tr>`;
    }).join('')}
  </table>`;
}

/**
 * Same buyer with identical upfront and total is almost always one deal filed
 * twice under two names for the licensor (e.g. a company and its JV). Show it
 * once; the underlying rows are left for the dedupe pipeline.
 */
export function dedupeForDisplay(rows: CompRow[]): CompRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.licensee.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}|${r.upfrontM ?? '-'}|${r.totalM ?? '-'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statBlock(items: Array<{ label: string; value: string; note?: string }>): string {
  const cells = items.map((i) => `<td style="width:${Math.floor(100 / items.length)}%; padding: 14px 12px; background:#f8fafc; border:1px solid #e2e8f0; vertical-align:top;">
      <div style="font-family:${FONT}; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#64748b;">${esc(i.label)}</div>
      <div style="font-family: Georgia, 'Times New Roman', serif; font-size:22px; color:#0b1220; margin-top:6px;">${esc(i.value)}</div>
      ${i.note ? `<div style="font-family:${FONT}; font-size:12px; color:#64748b; margin-top:4px;">${esc(i.note)}</div>` : ''}
    </td>`).join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:separate; border-spacing:6px 0; margin: 10px -6px 16px;"><tr>${cells}</tr></table>`;
}

// ─── Email ─────────────────────────────────────────────────────────────────

export type CompSetCta =
  | { kind: 'trial' }   // free user who can still start the 7-day trial
  | { kind: 'upgrade' } // free user whose trial is used
  | { kind: 'pro' };    // already on Pro (trialing or paid)

export interface CompSetEmailInput {
  name: string | null;
  calc: CalculationRow;
  asset: AssetProfile;
  compSet: CompSet;
  shareUrl: string | null;
  cta: CompSetCta;
}

function firstName(name: string | null): string {
  const first = (name || '').trim().split(/\s+/)[0];
  return first && !first.includes('@') ? first : '';
}

export function buildCompSetEmail(input: CompSetEmailInput): { subject: string; html: string } {
  const { calc, asset, compSet, shareUrl, cta } = input;
  const ind = asset.indicationLabel || indicationLabel(asset.indication) || 'your indication';
  const phase = phaseLabel(calc.development_phase);
  const mod = modalityLabel(calc.modality);
  const program = `${phase} ${mod ? `${mod} ` : ''}program in ${ind}`;
  const n = compSet.rows.length;
  const sameInd = compSet.rows.filter((r) => r.sameIndication).length;

  // Rows to print: the builder already orders same indication, then same
  // mechanism, then same therapeutic area, each by relevance. Keep that order
  // (a prospect looks for their own indication first) and leave outliers for
  // the full set behind the link.
  const priced = compSet.rows.filter((r) => r.upfrontM != null || r.totalM != null);
  const shown = dedupeForDisplay([...priced.filter((r) => !r.outlier), ...priced.filter((r) => r.outlier)]).slice(0, COMPS_SHOWN);

  const st = compSet.stats.exOutliers.n >= MIN_COMPS ? compSet.stats.exOutliers : compSet.stats.all;
  const compStats = [
    st.upfront && { label: 'Median upfront', value: fmtM(st.upfront.p50), note: `middle half ${fmtM(st.upfront.p25)} to ${fmtM(st.upfront.p75)}` },
    st.total && { label: 'Median total value', value: fmtM(st.total.p50), note: `middle half ${fmtM(st.total.p25)} to ${fmtM(st.total.p75)}` },
    st.royaltyMid && { label: 'Median royalty', value: fmtPct(st.royaltyMid.p50) ?? 'n/d', note: `middle half ${fmtPct(st.royaltyMid.p25)} to ${fmtPct(st.royaltyMid.p75)}` },
  ].filter(Boolean) as Array<{ label: string; value: string; note?: string }>;

  const upRange = fmtRange(num(calc.output_upfront_low), num(calc.output_upfront_high));
  const totRange = fmtRange(num(calc.output_total_deal_value_low), num(calc.output_total_deal_value_high));
  const royLo = fmtPct(num(calc.output_royalty_low));
  const royHi = fmtPct(num(calc.output_royalty_high));
  const benchmarkBits = [
    upRange && `upfront ${upRange}`,
    totRange && `total deal value ${totRange}`,
    royLo && royHi && `royalties ${royLo} to ${royHi}`,
  ].filter(Boolean);

  const hi = firstName(input.name);
  const openUrl = shareUrl || `${SITE}/calculator`;

  const ctaHtml = cta.kind === 'pro'
    ? [
        p(`All ${n} comparables, with their sources, are in Solidus. Set a deal alert for ${esc(ind)} and you will hear about the next comparable deal the day it is announced.`),
        button('Open in Solidus', `${SITE}/calculator`),
      ].join('\n')
    : cta.kind === 'trial'
      ? [
          p(`<strong>Want the rest?</strong> Pro shows all ${n} comparables with their sources and full terms, runs every valuation engine on your program, and alerts you the day a new ${esc(ind)} deal is signed.`),
          button('Start your 7-day free trial', `${SITE}/trial?ref=comp_set`),
          p('$0 today. We email you 3 days before the trial ends, and you can cancel in two clicks.', { muted: true }),
        ].join('\n')
      : [
          p(`<strong>Want the rest?</strong> Pro shows all ${n} comparables with their sources and full terms, and alerts you the day a new ${esc(ind)} deal is signed.`),
          button('See Pro', `${SITE}/pro?ref=comp_set`),
        ].join('\n');

  const body = [
    p(`${hi ? `Hi ${esc(hi)},` : 'Hi,'}`),
    p(`You benchmarked a ${esc(program)} on Solidus. Here are the deals a buyer will price it against${sameInd ? `: ${sameInd} in ${esc(ind)} itself, and the rest from the closest programs in ${esc(humanize(asset.therapeuticArea))}` : ''}.`),
    benchmarkBits.length ? callout(`<strong>Your benchmark:</strong> ${esc(benchmarkBits.join('; '))}.`) : '',
    compStats.length ? `<div style="font-family:${FONT}; font-size:13px; font-weight:600; color:#0b1220; margin-top:18px;">What ${n} comparable deals paid</div>${statBlock(compStats)}` : '',
    `<div style="font-family:${FONT}; font-size:13px; font-weight:600; color:#0b1220; margin-top:8px;">The closest comparables</div>`,
    compTable(shown),
    p(`Every deal above is a verified row in the Solidus database; the source link opens the filing or release it was verified against. Values are headline terms as disclosed.${compSet.caveat ? ` ${esc(compSet.caveat)}` : ''}`, { muted: true }),
    button(shareUrl ? 'Open your full benchmark' : 'Open your benchmark', openUrl),
    shareUrl ? p('That link works without a login, so you can forward it to a colleague or a board member.', { muted: true }) : '',
    ctaHtml,
    p('If a comparable looks wrong, or you want a deal we have missed added, reply to this email. It comes straight to me.'),
    signature(),
  ].filter(Boolean).join('\n');

  const subject = `Your ${ind} comp set: ${n} comparable deals`;
  return {
    subject,
    html: envelope({
      eyebrow: 'Your comp set',
      headline: `${n} deals like your ${phase} ${ind} program`,
      sub: st.upfront ? `Median upfront ${fmtM(st.upfront.p50)} · every deal verified and sourced` : 'Every deal verified and sourced',
      preheader: st.upfront
        ? `Comparable ${ind} deals: median upfront ${fmtM(st.upfront.p50)}${st.total ? `, median total ${fmtM(st.total.p50)}` : ''}. Each linked to its source.`
        : `The comparable deals behind your ${ind} benchmark, each linked to its source.`,
      body,
    }),
  };
}
