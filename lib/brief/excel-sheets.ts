/**
 * Brief sheets for the Excel export: the data behind every figure on the
 * brief-only pages (decision, scored call, term sheet, valuation bridge, your
 * model vs Solidus, comparable set with sources, buyer map, catalyst calendar,
 * inflection path, diligence). The engine workbook (lib/generateExcel.ts)
 * carries the calculator side; these sheets are added in front of it so the
 * first tab a client opens is the decision they paid for.
 *
 * Pure: reads BriefIntelligence, writes worksheets. No I/O.
 */
import type ExcelJS from 'exceljs';
import type { BriefIntelligence } from './types';
import { buildScoredCall } from './scored-call';

const NAVY = 'FF0B1220';
const TEAL = 'FF0F766E';
const MUTED = 'FF64748B';
const RULE = 'FFE2E8F0';

type Cell = string | number | null | undefined | Date;

function title(ws: ExcelJS.Worksheet, text: string, sub?: string): number {
  ws.mergeCells(1, 1, 1, Math.max(2, ws.columnCount || 6));
  const c = ws.getCell(1, 1);
  c.value = text;
  c.font = { name: 'Calibri', size: 16, bold: true, color: { argb: NAVY } };
  ws.getRow(1).height = 26;
  if (sub) {
    ws.mergeCells(2, 1, 2, Math.max(2, ws.columnCount || 6));
    const s = ws.getCell(2, 1);
    s.value = sub;
    s.font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED } };
  }
  return sub ? 4 : 3;
}

function header(ws: ExcelJS.Worksheet, row: number, cells: string[]): number {
  const r = ws.getRow(row);
  cells.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: TEAL } } };
  });
  r.height = 20;
  return row + 1;
}

function line(ws: ExcelJS.Worksheet, row: number, cells: Cell[], opts: { bold?: boolean; muted?: boolean; wrap?: boolean; money?: number[]; pct?: number[] } = {}): number {
  const r = ws.getRow(row);
  cells.forEach((v, i) => {
    const c = r.getCell(i + 1);
    c.value = v == null ? '' : v;
    c.font = { name: 'Calibri', size: 10, bold: !!opts.bold, color: { argb: opts.muted ? MUTED : 'FF1E293B' } };
    c.alignment = { vertical: 'top', wrapText: opts.wrap !== false };
    c.border = { bottom: { style: 'hair', color: { argb: RULE } } };
    if (opts.money?.includes(i) && typeof v === 'number') c.numFmt = '"$"#,##0.0"M"';
    if (opts.pct?.includes(i) && typeof v === 'number') c.numFmt = '0.0%';
  });
  return row + 1;
}

function section(ws: ExcelJS.Worksheet, row: number, text: string): number {
  const c = ws.getCell(row + 1, 1);
  c.value = text.toUpperCase();
  c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: TEAL } };
  return row + 2;
}

function source(ws: ExcelJS.Worksheet, row: number, text: string): number {
  const c = ws.getCell(row + 1, 1);
  c.value = text;
  c.font = { name: 'Calibri', size: 9, italic: true, color: { argb: MUTED } };
  return row + 2;
}

const money = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const label = (s: string) => s.replace(/_/g, ' ');

/**
 * Add the brief sheets to a workbook. Returns the number of sheets added.
 * Sheets are inserted at the front so the workbook opens on the decision.
 */
export function addBriefSheets(wb: ExcelJS.Workbook, brief: BriefIntelligence, opts: { deliveredAt?: string | null } = {}): number {
  const before = wb.worksheets.length;
  const asset = brief.asset;
  const what = `${asset.assetName ? `${asset.assetName} · ` : ''}${asset.indicationLabel ?? asset.indication} · ${label(asset.phase)}`;

  // ── 1. Decision ────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Brief · Decision');
    ws.columns = [{ width: 30 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 60 }];
    let r = title(ws, 'The decision', `${what} · as of ${brief.decision?.asOf ?? brief.asOf}`);
    const d = brief.decision;
    if (!d) { line(ws, r, ['No decision was built for this brief.'], { muted: true }); }
    else {
      r = line(ws, r, ['Headline', d.headline], { bold: true });
      r = line(ws, r, ['Recommendation', d.recommendationLabel]);
      r = line(ws, r, ['Confidence', `${d.confidence} — ${d.confidenceBasis}`]);
      r = section(ws, r, 'The numbers ($M)');
      r = header(ws, r, ['', 'Upfront', 'Total', 'Royalty (mid)', 'Note']);
      r = line(ws, r, ['Ask', d.ask.upfrontM, d.ask.totalM, d.ask.royaltyPct ? d.ask.royaltyPct.median / 100 : null, 'What we open with'], { money: [1, 2], pct: [3] });
      r = line(ws, r, ['Floor', d.floor.upfrontM, d.floor.totalM, d.ask.royaltyPct ? d.ask.royaltyPct.low / 100 : null, 'Where we would stop'], { money: [1, 2], pct: [3] });
      r = line(ws, r, ['Walk away', d.walkAwayUpfrontM, null, null, 'Below this, no deal'], { money: [1] });
      r = section(ws, r, 'Rationale');
      for (const b of d.rationale) r = line(ws, r, ['', b]);
      r = section(ws, r, 'Counterparties');
      r = header(ws, r, ['Name', 'Role', '', '', 'Why']);
      for (const c of d.counterparties) r = line(ws, r, [c.name, c.role, null, null, c.why]);
      r = section(ws, r, 'Levers');
      for (const l of d.levers) r = line(ws, r, ['', l]);
      r = section(ws, r, 'What would change the view');
      for (const w of d.wouldChangeView) r = line(ws, r, ['', w]);
      r = section(ws, r, 'Timeline');
      for (const t of d.timeline) r = line(ws, r, [t.week, t.step]);
      if (brief.mpOpinion) {
        r = section(ws, r, 'Managing Partner opinion');
        r = line(ws, r, [brief.mpOpinion.reviewer, brief.mpOpinion.text]);
      }
    }
  }

  // ── 2. Scored call ─────────────────────────────────────────────────────────
  {
    const call = buildScoredCall(brief, { deliveredAt: opts.deliveredAt ?? null });
    const ws = wb.addWorksheet('Brief · Scored call');
    ws.columns = [{ width: 30 }, { width: 70 }];
    let r = title(ws, 'This call is scored', 'Registered in the Solidus outcome ledger on delivery; scored on price, buyer and timing.');
    if (!call) line(ws, r, ['No scored call: the valuation bridge was not built.'], { muted: true });
    else {
      r = line(ws, r, ['Ask (upfront / total, $M)', `${call.ask.upfrontM} / ${call.ask.totalM}`]);
      r = line(ws, r, ['Floor (upfront / total, $M)', `${call.floor.upfrontM} / ${call.floor.totalM}`]);
      r = line(ws, r, ['Walk away (upfront, $M)', call.walkAwayUpfrontM ?? '']);
      r = line(ws, r, ['Recommendation', call.recommendationLabel ?? '']);
      r = line(ws, r, ['Lead buyers', call.buyers.lead.join(', ')]);
      r = line(ws, r, ['Tension buyers', call.buyers.tension.join(', ')]);
      r = line(ws, r, ['Window', `${call.window.start ?? '—'} to ${call.window.end ?? '—'}`]);
      r = line(ws, r, ['Expires', call.expiresOn ?? '']);
      r = section(ws, r, 'Scored by');
      for (const s of call.scoredBy) r = line(ws, r, ['', s]);
      r = section(ws, r, 'Measured once terms are signed');
      for (const s of call.measures) r = line(ws, r, ['', s]);
      r = section(ws, r, 'Follow-ups');
      for (const f of call.followups) r = line(ws, r, [`Day ${f.day}`, f.date ?? 'set on delivery']);
      if (call.accuracy) r = line(ws, r, [call.accuracy.metric, `${call.accuracy.value} (n=${call.accuracy.n}) — ${call.accuracy.note}`]);
    }
  }

  // ── 3. Indicative term sheet ───────────────────────────────────────────────
  {
    const ts = brief.indicativeTermSheet;
    const ws = wb.addWorksheet('Brief · Term sheet');
    ws.columns = [{ width: 28 }, { width: 48 }, { width: 48 }, { width: 30 }];
    let r = title(ws, ts?.headline ?? 'Indicative term sheet', ts ? `${ts.structure} · counterparties: ${ts.counterparties.join(', ') || '—'}` : undefined);
    if (!ts) line(ws, r, ['No term sheet built.'], { muted: true });
    else {
      r = header(ws, r, ['Term', 'Position', 'Basis', 'Floor']);
      for (const l of ts.lines) r = line(ws, r, [l.term, l.position, l.basis, l.floor ?? '']);
      r = section(ws, r, 'Milestone schedule');
      r = header(ws, r, ['Event', 'Share of milestones', 'Amount ($M)', '']);
      for (const m of ts.milestones) r = line(ws, r, [m.event, m.shareOfMilestones, m.amountM, ''], { pct: [1], money: [2] });
      r = section(ws, r, 'Notes');
      for (const n of ts.notes) r = line(ws, r, ['', n]);
    }
  }

  // ── 4. Valuation bridge ────────────────────────────────────────────────────
  {
    const b = brief.bridge;
    const ws = wb.addWorksheet('Brief · Valuation bridge');
    ws.columns = [{ width: 30 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 8 }, { width: 60 }];
    let r = title(ws, 'Valuation bridge', b ? `Anchoring policy: ${b.policy}` : undefined);
    if (!b) line(ws, r, ['No bridge built.'], { muted: true });
    else {
      r = header(ws, r, ['Method', 'Basis', 'Low ($M)', 'Mid ($M)', 'High ($M)', 'n', 'Note']);
      for (const bar of b.bars) r = line(ws, r, [bar.label, bar.basis, bar.low, bar.mid, bar.high, bar.n ?? '', `${bar.informative === false ? 'Not informative. ' : ''}${bar.note ?? ''}`], { money: [2, 3, 4], muted: bar.informative === false });
      r = section(ws, r, 'Result');
      r = line(ws, r, ['Ask', '', b.ask.upfrontM, null, b.ask.totalM, '', `Upfront set by ${b.askBasis.upfront}; total set by ${b.askBasis.total}`], { money: [2, 4], bold: true });
      r = line(ws, r, ['Floor', '', b.floor.upfrontM, null, b.floor.totalM, '', ''], { money: [2, 4] });
      r = line(ws, r, ['Walk away', '', b.walkAway.upfrontM, null, null, '', ''], { money: [2] });
      if (b.rnpvNote) r = line(ws, r, ['rNPV note', '', null, null, null, '', b.rnpvNote], { muted: true });
      r = section(ws, r, 'Reconciliation');
      r = line(ws, r, ['', '', null, null, null, '', b.reconciliation]);
    }
  }

  // ── 5. Your model vs Solidus ───────────────────────────────────────────────
  {
    const c = brief.clientComparison;
    const ws = wb.addWorksheet('Brief · Your model vs Solidus');
    ws.columns = [{ width: 28 }, { width: 8 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 60 }];
    let r = title(ws, 'Your model vs Solidus', c?.summary);
    if (!c) line(ws, r, ['No client model was supplied at intake.'], { muted: true });
    else {
      r = header(ws, r, ['Line', 'Unit', 'Your model', 'Solidus', 'Delta', 'Delta %', 'Where the Solidus number comes from']);
      for (const row of c.rows) r = line(ws, r, [row.label, row.unit, row.client, row.solidus, row.delta, row.deltaPct, `${row.basis}${row.read ? ` — ${row.read}` : ''}`], { pct: [5] });
      if (c.priorOffer) {
        r = section(ws, r, 'Offer on the table');
        const o = c.priorOffer;
        r = line(ws, r, [o.offer.party, o.offer.status, money(o.offer.upfrontM), money(o.offer.totalM), null, null, `vs floor upfront ${o.vsFloorUpfrontPct == null ? '—' : `${Math.round(o.vsFloorUpfrontPct * 100)}%`}; vs ask upfront ${o.vsAskUpfrontPct == null ? '—' : `${Math.round(o.vsAskUpfrontPct * 100)}%`}`], { money: [2, 3] });
      }
      if (c.notes) { r = section(ws, r, 'Your notes'); r = line(ws, r, ['', '', null, null, null, null, c.notes]); }
    }
  }

  // ── 6. Comparable set ──────────────────────────────────────────────────────
  {
    const cs = brief.compSet;
    const ws = wb.addWorksheet('Brief · Comparable set');
    ws.columns = [{ width: 24 }, { width: 24 }, { width: 26 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 22 }, { width: 24 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 40 }, { width: 50 }];
    let r = title(ws, 'Comparable set', cs ? `${cs.source.source} · n=${cs.source.n} · as of ${cs.source.asOf}${cs.source.note ? ` · ${cs.source.note}` : ''}${cs.caveat ? ` · ${cs.caveat}` : ''}` : undefined);
    if (!cs) line(ws, r, ['No comparable set built.'], { muted: true });
    else {
      r = header(ws, r, ['Licensor', 'Licensee', 'Asset', 'Announced', 'Phase', 'Structure', 'Modality', 'Indication', 'Upfront ($M)', 'Total ($M)', 'Milestones ($M)', 'Royalty low', 'Royalty high', 'Relevance', 'Flags', 'Why in the set', 'Source']);
      for (const row of cs.rows) {
        const flags = [row.verified ? 'verified' : '', row.outlier ? 'outlier' : '', row.sameIndication ? 'same indication' : '', row.sameMechanism ? 'same mechanism' : '', cs.headlineDriverIds.includes(row.id) ? 'headline driver' : ''].filter(Boolean).join(', ');
        r = line(ws, r, [row.licensor, row.licensee, row.asset ?? '', row.announcedDate ?? (row.year ? String(row.year) : ''), label(row.phase), label(row.structure), row.modality ?? '', row.indication ?? '', row.upfrontM, row.totalM, row.milestonesM, row.royaltyLowPct != null ? row.royaltyLowPct / 100 : null, row.royaltyHighPct != null ? row.royaltyHighPct / 100 : null, row.relevance, flags, row.reasons.join('; '), row.sourceUrl ?? row.sourceType ?? ''], { money: [8, 9, 10], pct: [11, 12], muted: row.outlier });
      }
      r = section(ws, r, 'Distribution');
      r = header(ws, r, ['Cut', 'n', 'Upfront p25', 'Upfront p50', 'Upfront p75', 'Total p25', 'Total p50', 'Total p75']);
      const stat = (name: string, s: typeof cs.stats.all) => { r = line(ws, r, [name, s.n, s.upfront?.p25 ?? null, s.upfront?.p50 ?? null, s.upfront?.p75 ?? null, s.total?.p25 ?? null, s.total?.p50 ?? null, s.total?.p75 ?? null], { money: [2, 3, 4, 5, 6, 7] }); };
      stat('All rows', cs.stats.all);
      stat('Ex-outliers', cs.stats.exOutliers);
      for (const p of cs.byPhase) stat(`Phase: ${label(p.phase)}`, p.stats);
      for (const s of cs.byStructure) stat(`Structure: ${label(s.structure)}`, s.stats);
      ws.views = [{ state: 'frozen', ySplit: 4 }];
    }
  }

  // ── 7. Buyer map ───────────────────────────────────────────────────────────
  {
    const bm = brief.buyerMap;
    const ws = wb.addWorksheet('Brief · Buyer map');
    ws.columns = [{ width: 26 }, { width: 14 }, { width: 14 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 44 }, { width: 44 }, { width: 50 }];
    let r = title(ws, 'Buyer map', bm ? `${bm.source.source} · n=${bm.source.n} · as of ${bm.source.asOf} · mix large ${bm.mix.large} / mid ${bm.mix.mid} · regions ${bm.mix.regions.join(', ')}` : undefined);
    if (!bm) line(ws, r, ['No buyer map built.'], { muted: true });
    else {
      r = header(ws, r, ['Buyer', 'Type', 'HQ', 'Fit', 'Urgency', 'Deals 12m', 'Deals 24m', 'Transacts at phase', 'Implied upfront mid ($M)', 'Implied total mid ($M)', 'Premium ×', 'Why now', 'How to engage', 'Prior deals (same area first)']);
      for (const c of bm.candidates) r = line(ws, r, [c.name, c.companyType ? label(c.companyType) : '', c.hqCountry ?? c.hqRegion ?? '', c.fit, c.urgency, c.dealsLast12mo, c.dealsLast24mo, c.transactsAtPhase, c.impliedUpfront?.median ?? null, c.impliedTotal?.median ?? null, c.counterpartyPremium ? `${c.counterpartyPremium.multiplier.toFixed(2)} (n=${c.counterpartyPremium.n})` : '', c.whyNow, c.howToEngage, c.priorDeals.map(pd => `${pd.parties}${pd.year ? ` (${pd.year}` : ''}${pd.upfrontM != null ? `${pd.year ? ', ' : ' ('}$${Math.round(pd.upfrontM)}M up` : ''}${pd.year || pd.upfrontM != null ? ')' : ''}`).join('; ')], { money: [8, 9] });
      r = section(ws, r, 'Process');
      r = line(ws, r, ['Lead', bm.process.lead.join(', ')]);
      r = line(ws, r, ['Tension', bm.process.tension.join(', ')]);
      r = line(ws, r, ['Hold', bm.process.hold.join(', ')]);
      r = line(ws, r, ['Rationale', bm.process.rationale]);
      if (bm.excluded.length) {
        r = section(ws, r, 'Excluded');
        for (const e of bm.excluded) r = line(ws, r, [e.name, e.reason]);
      }
    }
  }

  // ── 8. Catalyst calendar ───────────────────────────────────────────────────
  {
    const cc = brief.landscape?.catalysts;
    const ws = wb.addWorksheet('Brief · Catalysts');
    ws.columns = [{ width: 12 }, { width: 14 }, { width: 44 }, { width: 24 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 60 }];
    let r = title(ws, 'Catalyst calendar', cc ? `${cc.windowMonths}-month window · ${cc.source.source} · n=${cc.source.n} · as of ${cc.source.asOf}` : undefined);
    if (!cc) line(ws, r, ['No catalyst calendar built.'], { muted: true });
    else {
      if (cc.recommendedWindow) r = line(ws, r, ['Go-to-market window', `${cc.recommendedWindow.start} to ${cc.recommendedWindow.end}`, cc.recommendedWindow.rationale], { bold: true });
      r = header(ws, r, ['Date', 'Kind', 'Event', 'Sponsor', 'Phase', 'NCT', 'Direction', 'Buyer?', 'Why it matters']);
      for (const e of cc.events) r = line(ws, r, [e.date, e.kind, e.title, e.sponsor ?? '', e.phase ? label(e.phase) : '', e.nctId ?? '', e.direction, e.isBuyerCandidate ? 'yes' : '', e.impact]);
    }
  }

  // ── 9. Inflection path ─────────────────────────────────────────────────────
  {
    const ip = brief.inflection;
    const ws = wb.addWorksheet('Brief · Inflection path');
    ws.columns = [{ width: 26 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 10 }, { width: 50 }];
    let r = title(ws, 'Path to the next inflection', ip ? `Discount rate ${(ip.discountRate * 100).toFixed(0)}% · ${ip.recommendation}` : undefined);
    if (!ip) line(ws, r, ['No inflection path built.'], { muted: true });
    else {
      r = header(ws, r, ['Option', 'Cost ($M)', 'Months', 'P(reach)', 'Upfront if reached, mid ($M)', 'Total if reached, mid ($M)', 'Expected upfront today ($M)', 'Expected value today ($M)', 'Dilution', 'Verdict']);
      for (const o of ip.options) r = line(ws, r, [o.label, o.costM, o.months, o.pReach, o.upfrontIfReached.median, o.totalIfReached.median, o.expectedUpfrontM, o.expectedValueM, o.dilution, o.verdict], { money: [1, 4, 5, 6, 7], pct: [3, 8] });
      if (ip.financing) {
        r = section(ws, r, 'Financing alternative');
        r = line(ws, r, ['Pre-money ($M)', ip.financing.preMoneyM, null, null, null, null, null, null, null, ip.financing.basis], { money: [1] });
        r = line(ws, r, ['Raise ($M)', ip.financing.raiseM, null, ip.financing.dilution, null, null, null, null, null, 'Dilution at that pre-money'], { money: [1], pct: [3] });
        r = line(ws, r, ['Retained value if financed ($M)', ip.financing.retainedValueIfFinanceM], { money: [1] });
        r = line(ws, r, ['Retained value if licensed ($M)', ip.financing.retainedValueIfLicenseM], { money: [1] });
      }
    }
  }

  // ── 10. Diligence readiness ────────────────────────────────────────────────
  {
    const dc = brief.diligence;
    const ws = wb.addWorksheet('Brief · Diligence');
    ws.columns = [{ width: 24 }, { width: 60 }, { width: 18 }, { width: 12 }];
    let r = title(ws, 'Diligence readiness', dc ? `${label(dc.phase)} · ${dc.modality}` : undefined);
    if (!dc) line(ws, r, ['No diligence checklist built.'], { muted: true });
    else {
      r = header(ws, r, ['Area', 'Item', 'Expected at this phase', 'Status']);
      for (const it of dc.items) r = line(ws, r, [it.area, it.item, it.expectedAtPhase ? 'yes' : 'later', it.status], { muted: !it.expectedAtPhase });
      if (dc.gaps.length) { r = section(ws, r, 'Gaps to close before outreach'); for (const g of dc.gaps) r = line(ws, r, ['', g]); }
    }
    if (brief.coverage) {
      r = section(ws, r, 'Data coverage behind this brief');
      const c = brief.coverage;
      r = line(ws, r, ['Tracked deals (quality-filtered)', c.trackedDeals]);
      r = line(ws, r, ['Verified with citation', c.verifiedDeals]);
      r = line(ws, r, ['In this therapeutic area', c.taDeals]);
      r = line(ws, r, ['Same indication', c.indicationDeals]);
      r = line(ws, r, ['Comparables used', c.compsUsed]);
      if (c.accuracy) r = line(ws, r, [c.accuracy.metric, `${c.accuracy.value} (n=${c.accuracy.n}) — ${c.accuracy.note}`]);
      r = source(ws, r, `As of ${c.asOf}. Every figure on the brief pages traces to one of these sheets; the engine workbook that follows carries the calculator side.`);
    }
  }

  // Move the brief sheets to the front so the workbook opens on the decision.
  const added = wb.worksheets.length - before;
  const sheets = wb.worksheets;
  const briefSheets = sheets.slice(before);
  const engineSheets = sheets.slice(0, before);
  [...briefSheets, ...engineSheets].forEach((ws, i) => { (ws as unknown as { orderNo: number }).orderNo = i; });
  if (briefSheets[0]) wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  return added;
}
