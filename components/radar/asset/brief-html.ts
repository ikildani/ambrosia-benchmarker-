/**
 * Printable committee brief (A4, one to two pages) for the PDF export.
 * Rendered through lib/report/server-renderer.ts renderPDFBuffer (headless
 * Chromium). Every block carries page-break controls: sections never split,
 * table rows never split, table headers repeat, and the trials block is the
 * only one allowed to start a second page. Notes are deliberately excluded
 * (team-private).
 */

import type { AssetBrief } from './types';
import { escapeHtml } from '@/lib/radar/notifications';
import { fmtM, fmtRoyalty, fmtDate, fmtNum, label, fmtPhaseDb, territoryLabel, sourceLabel, factorLabel, GAP_LABELS } from './format';

const MAX_TRIALS = 12;
const MAX_COMPS = 10;
const MAX_ACQUIRERS = 5;

function esc(v: unknown): string { return escapeHtml(v == null ? '' : String(v)); }

function relaxationLabel(r: string | null | undefined): string {
  if (!r || r === 'none') return 'exact TA + modality + phase';
  if (r === 'modality_only') return 'widened to modality';
  if (r === 'ta_only') return 'widened to therapeutic area';
  return r.replace(/_/g, ' ');
}

export function briefStyles(): string {
  return `
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #ffffff; color: #171717; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10.5px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 14mm 14mm 16mm; }
    .section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 9px; }
    .page-break { break-before: page; page-break-before: always; }
    .avoid-break-after { break-after: avoid; page-break-after: avoid; }
    h1 { font-size: 19px; margin: 0; font-weight: 700; letter-spacing: -0.01em; }
    h2 { font-size: 11px; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 0.08em; color: #525252; font-weight: 600; break-after: avoid; page-break-after: avoid; }
    .kicker { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #737373; margin-bottom: 3px; }
    .muted { color: #737373; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; }
    .kv .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #737373; }
    .kv .v { font-size: 10.5px; color: #171717; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1.5px solid #171717; padding-bottom: 8px; margin-bottom: 10px; }
    .score { text-align: right; min-width: 120px; }
    .score .n { font-size: 30px; font-weight: 700; line-height: 1; }
    .score .c { font-size: 9px; color: #737373; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #525252; border-bottom: 1px solid #a3a3a3; padding: 3px 4px; font-weight: 600; }
    td { padding: 3px 4px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    td.r, th.r { text-align: right; }
    .wf { display: grid; grid-template-columns: 150px 1fr 48px; gap: 2px 8px; align-items: center; }
    .wf .bar { height: 8px; background: #e5e5e5; position: relative; }
    .wf .bar span { position: absolute; left: 0; top: 0; bottom: 0; background: #171717; }
    .wf .bar span.mult { background: #737373; }
    .wf .lbl { font-size: 9.5px; }
    .wf .pts { text-align: right; font-size: 9.5px; }
    .ev { font-size: 8.5px; color: #525252; margin: 0 0 3px; padding-left: 150px; }
    .pill { display: inline-block; padding: 1px 6px; border: 1px solid #a3a3a3; border-radius: 999px; font-size: 8.5px; margin-right: 3px; }
    .warn { border: 1px solid #a3a3a3; padding: 6px 8px; font-size: 9.5px; background: #fafafa; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .footer { position: fixed; bottom: 6mm; left: 14mm; right: 14mm; font-size: 8px; color: #737373; display: flex; justify-content: space-between; border-top: 1px solid #e5e5e5; padding-top: 3px; }
  `;
}

export function buildBriefHtml(brief: AssetBrief, opts: { generatedAt?: Date; baseUrl?: string } = {}): string {
  const { asset, owner, drug, partnership, score, trend, terms, trials, catalysts, acquirers, intel } = brief;
  const generated = opts.generatedAt ?? new Date();
  const baseUrl = (opts.baseUrl ?? 'https://solidus.ambrosiaventures.co').replace(/\/$/, '');
  const maxPts = Math.max(1, ...score.contributions.map(c => c.points), score.raw_weighted);

  const kv = (k: string, v: string) => `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${v || '—'}</div></div>`;

  const headerHtml = `
    <div class="header section">
      <div>
        <div class="kicker">Solidus Search & Evaluation · Committee brief</div>
        <h1>${esc(asset.asset_name)}</h1>
        <div class="muted" style="margin-top:2px;">${esc(owner.company_name)}${owner.owner_type && owner.owner_type !== 'unknown' ? ` · ${esc(owner.owner_type)}` : ''}${owner.country ? ` · ${esc(label(owner.country))}` : ''}${asset.asset_aliases?.length ? ` · aka ${esc(asset.asset_aliases.slice(0, 3).join(', '))}` : ''}</div>
        <div style="margin-top:5px;">
          <span class="pill">${esc(label(asset.phase))}</span>
          <span class="pill">${esc(label(asset.modality))}</span>
          <span class="pill">${esc(label(asset.therapeutic_area))}</span>
          <span class="pill">${esc(label(partnership.status))}</span>
          ${(asset.regulatory_designations || []).slice(0, 4).map(d => `<span class="pill">${esc(d)}</span>`).join('')}
        </div>
      </div>
      <div class="score">
        <div class="n">${score.score}</div>
        <div class="c">Licensing intent · confidence ${score.confidence}</div>
        <div class="c">30d ${trend.delta_30d == null ? '—' : (trend.delta_30d > 0 ? '+' : '') + trend.delta_30d} · 90d ${trend.delta_90d == null ? '—' : (trend.delta_90d > 0 ? '+' : '') + trend.delta_90d}</div>
      </div>
    </div>`;

  const identityHtml = `
    <div class="section">
      <div class="grid">
        ${kv('Indication', esc(asset.indication_specific || asset.indication_category?.replace(/_/g, ' ') || ''))}
        ${kv('Target / mechanism', esc([asset.target, asset.mechanism].filter(Boolean).join(' · ')))}
        ${kv('Partner', partnership.partner_name ? `${esc(partnership.partner_name)} <span class="muted">(${Math.round(partnership.confidence)}% conf.)</span>` : '<span class="muted">None on record</span>')}
        ${kv('Rights available', partnership.rights_available.length ? esc(partnership.rights_available.map(territoryLabel).join(', ')) : '<span class="muted">Not established</span>')}
        ${kv('Drug identity', drug ? esc([drug.inn || drug.preferred_name, drug.unii ? `UNII ${drug.unii}` : null, drug.chembl_id].filter(Boolean).join(' · ')) : '<span class="muted">Unresolved</span>')}
        ${kv('Trials / enrollment', `${fmtNum(asset.trial_count)} / ${fmtNum(asset.enrollment_total)}`)}
        ${kv('Registry update', esc(fmtDate(asset.last_update_date)))}
        ${kv('Scored', esc(fmtDate(asset.last_scored_at)))}
      </div>
    </div>`;

  const waterfallRows = score.waterfall.map(step => {
    if (step.kind === 'factor') {
      const c = step.contribution!;
      const width = Math.max(0, Math.min(100, (c.points / maxPts) * 100));
      const ev = c.evidence_text
        ? `${esc(c.evidence_text.slice(0, 150))}${c.evidence_date ? ` (${esc(fmtDate(c.evidence_date))})` : ''}`
        : `<span class="muted">No evidence found; checked ${c.sources_checked.length || 0} source${c.sources_checked.length === 1 ? '' : 's'}${c.sources_checked.length ? `: ${esc(c.sources_checked.join(', '))}` : ''}</span>`;
      return `<div class="wf"><div class="lbl">${esc(step.label)} <span class="muted">w ${(c.weight * 100).toFixed(0)}% · ${Math.round(c.score)}/100</span></div><div class="bar"><span style="width:${width.toFixed(1)}%"></span></div><div class="pts mono">+${c.points.toFixed(1)}</div></div><div class="ev">${ev}</div>`;
    }
    if (step.kind === 'multiplier') {
      return `<div class="wf"><div class="lbl">${esc(step.label)}</div><div class="bar"><span class="mult" style="width:${Math.max(0, Math.min(100, step.value * 100)).toFixed(1)}%"></span></div><div class="pts mono">× ${step.value.toFixed(2)}</div></div>`;
    }
    return `<div class="wf" style="border-top:1px solid #a3a3a3;margin-top:2px;padding-top:2px;"><div class="lbl" style="font-weight:600;">${esc(step.label)}</div><div></div><div class="pts mono" style="font-weight:600;">${step.value.toFixed(step.key === 'composite' ? 0 : 1)}</div></div>`;
  }).join('');

  const scoreHtml = `
    <div class="section">
      <h2>Licensing intent — evidence waterfall <span class="muted" style="text-transform:none;letter-spacing:0;">model ${esc(score.model_version)}${score.snapshot_date ? ` · snapshot ${esc(score.snapshot_date)}` : ''}</span></h2>
      ${waterfallRows}
    </div>`;

  const th = terms.thesis;
  const compRows = terms.comps.slice(0, MAX_COMPS).map(c => `
    <tr>
      <td class="mono">${c.year ?? (c.announced_date ? c.announced_date.slice(0, 4) : '—')}</td>
      <td>${esc(c.licensor_name || '?')} → ${esc(c.licensee_name || '?')}</td>
      <td>${esc(c.asset_name || '—')}</td>
      <td>${esc(fmtPhaseDb(c.phase_at_signing))}</td>
      <td class="r mono">${esc(fmtM(c.upfront_m))}</td>
      <td class="r mono">${esc(fmtM(c.total_deal_value_m))}</td>
      <td class="r mono">${esc(fmtRoyalty(c.royalty_low_pct, c.royalty_high_pct))}</td>
      <td>${c.verification_status === 'verified' ? 'Verified' : esc(c.verification_status || '—')}</td>
      <td>${c.source_url && c.url_status !== 'dead' ? `<a href="${esc(c.source_url)}">${esc(sourceLabel(c.source_type))}</a>` : esc(sourceLabel(c.source_type))}</td>
    </tr>`).join('');

  const termsHtml = `
    <div class="section">
      <h2>Predicted terms <span class="muted" style="text-transform:none;letter-spacing:0;">n = ${terms.n} comps (${terms.verified_n} verified) · ${esc(relaxationLabel(terms.relaxation))}${th?.terms_basis ? ` · basis: ${esc(th.terms_basis)}` : ''}</span></h2>
      ${terms.insufficient || !th || th.predicted_upfront_mid == null ? `
        <div class="warn">Insufficient comparables for a defensible range (${terms.n} found, ${terms.min_comps} required). No terms are predicted; the comps below are shown for context only.</div>` : `
        <div class="grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 6px;">
          ${kv('Upfront (P25 / P50 / P75)', `<span class="mono">${esc(fmtM(th.predicted_upfront_low))} / <b>${esc(fmtM(th.predicted_upfront_mid))}</b> / ${esc(fmtM(th.predicted_upfront_high))}</span>`)}
          ${kv('Total value', `<span class="mono">${esc(fmtM(th.predicted_total_low))} / <b>${esc(fmtM(th.predicted_total_mid))}</b> / ${esc(fmtM(th.predicted_total_high))}</span>`)}
          ${kv('Royalty', `<span class="mono">${esc(fmtRoyalty(th.predicted_royalty_low, th.predicted_royalty_high))}</span>`)}
          ${kv('Confidence / dispersion', `<span class="mono">${th.thesis_confidence}% · IQR/median ${th.comp_dispersion != null ? th.comp_dispersion.toFixed(2) : '—'}</span>${th.calculator_upfront_mid != null ? `<div class="muted">Calculator for this profile: ${esc(fmtM(th.calculator_upfront_mid))} upfront${th.calculator_total_mid != null ? ` / ${esc(fmtM(th.calculator_total_mid))} total` : ''}</div>` : ''}`)}
        </div>`}
      <table>
        <thead><tr><th>Year</th><th>Parties</th><th>Asset</th><th>Phase</th><th class="r">Upfront</th><th class="r">Total</th><th class="r">Royalty</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>${compRows || '<tr><td colspan="9" class="muted">No comparable transactions found.</td></tr>'}</tbody>
      </table>
    </div>`;

  const acqRows = acquirers.slice(0, MAX_ACQUIRERS).map(a => `
    <tr>
      <td><b>${esc(a.acquirer_name)}</b><div class="muted">${esc(a.gap_type ? (GAP_LABELS[a.gap_type] || a.gap_type.replace(/_/g, ' ')) : '')}</div></td>
      <td class="r mono">${Math.round(a.opportunity_score)}</td>
      <td class="r mono">${Math.round(a.strategic_fit_score)}</td>
      <td>${esc(a.rationale.slice(0, 170))}${a.rationale.length > 170 ? '…' : ''}</td>
    </tr>`).join('');

  const compRowsIntel = intel.filter(i => i.competitor_name).slice(0, 6).map(i => `<span class="pill">${esc(i.competitor_name)} · ${esc(i.intel_type.replace(/_/g, ' '))} ${Math.round(i.intensity)}</span>`).join('');

  const acquirersHtml = `
    <div class="section">
      <h2>Proposed acquirers and landscape</h2>
      <table>
        <thead><tr><th>Acquirer / gap</th><th class="r">Opp.</th><th class="r">Fit</th><th>Rationale</th></tr></thead>
        <tbody>${acqRows || '<tr><td colspan="4" class="muted">No proposed acquirers yet.</td></tr>'}</tbody>
      </table>
      ${compRowsIntel ? `<div style="margin-top:5px;">${compRowsIntel}</div>` : ''}
    </div>`;

  const trialRows = trials.slice(0, MAX_TRIALS).map(t => `
    <tr>
      <td class="mono"><a href="https://clinicaltrials.gov/study/${esc(t.nct_id)}">${esc(t.nct_id)}</a></td>
      <td>${esc(label(t.phase))}</td>
      <td>${esc((t.status || '—').replace(/_/g, ' '))}</td>
      <td>${esc(fmtDate(t.primary_completion_date))}</td>
      <td class="r mono">${esc(fmtNum(t.enrollment_count))}</td>
      <td>${esc(t.locations_countries.slice(0, 5).join(', '))}${t.locations_countries.length > 5 ? ` +${t.locations_countries.length - 5}` : ''}</td>
      <td>${esc((t.trial_title || '').slice(0, 90))}</td>
    </tr>`).join('');

  const catalystRows = catalysts.slice(0, 6).map(c => `<span class="pill">${esc(fmtDate(c.date))} · ${esc(c.title)}</span>`).join('');

  const trialsHtml = `
    <div class="section ${trials.length > 6 ? 'page-break' : ''}">
      <h2>Clinical program <span class="muted" style="text-transform:none;letter-spacing:0;">${trials.length} trial${trials.length === 1 ? '' : 's'}${trials.length > MAX_TRIALS ? `, ${MAX_TRIALS} shown` : ''}</span></h2>
      <table>
        <thead><tr><th>NCT</th><th>Phase</th><th>Status</th><th>Primary completion</th><th class="r">Enroll.</th><th>Countries</th><th>Title</th></tr></thead>
        <tbody>${trialRows || '<tr><td colspan="7" class="muted">No registry trials linked.</td></tr>'}</tbody>
      </table>
      ${catalystRows ? `<div style="margin-top:5px;"><span class="muted">Catalysts:</span> ${catalystRows}</div>` : ''}
    </div>`;

  const footer = `<div class="footer"><span>Solidus Search & Evaluation · generated ${esc(generated.toISOString().slice(0, 16).replace('T', ' '))} UTC · model ${esc(score.model_version)}</span><span>${esc(baseUrl)}/radar/${esc(asset.id)} · Internal committee use</span></div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(asset.asset_name)} — Solidus Search & Evaluation brief</title><style>${briefStyles()}</style></head><body><div class="page">${headerHtml}${identityHtml}${scoreHtml}${termsHtml}${acquirersHtml}${trialsHtml}</div>${footer}</body></html>`;
}
