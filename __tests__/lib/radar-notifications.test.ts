/**
 * Unit tests for lib/radar/notifications.ts (pure builders: rule validation,
 * dedupe keys, threshold crossings, mandate digest with empty suppression,
 * renderers), the orchestrator against a chain-aware Supabase mock with
 * injected deliverers, and the XLSX list export structure
 * (components/radar/asset/export-xlsx.ts). No network.
 */

import {
  validateAlertRule,
  buildDedupeKey,
  digestBucket,
  digestDue,
  isoWeek,
  detectThresholdCrossing,
  lastCrossingInSeries,
  buildMandateDigest,
  renderDigestEmail,
  renderDigestSlack,
  renderAlertEmail,
  escapeHtml,
  runRadarNotifications,
  type DigestAsset,
  type DigestMatch,
} from '@/lib/radar/notifications';
import { buildAssetListWorkbook, ASSET_SHEET, PROVENANCE_SHEET, ASSET_COLUMNS, WATCHLIST_COLUMNS } from '@/components/radar/asset/export-xlsx';
import { buildScoreBreakdown, parseSnapshotFactors } from '@/components/radar/asset/score-breakdown';
import { calculatorHref } from '@/components/radar/asset/calculator-link';

const U1 = '11111111-1111-4111-8111-111111111111';
const M1 = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const A2 = '44444444-4444-4444-8444-444444444444';
const R1 = '55555555-5555-4555-8555-555555555555';
const W1 = '66666666-6666-4666-8666-666666666666';

const NOW = new Date('2026-09-15T12:30:00Z');

// ─── Rule validation ───────────────────────────────────────────────────────

describe('validateAlertRule', () => {
  it('accepts a score threshold rule and applies defaults', () => {
    const r = validateAlertRule({ kind: 'score_threshold', channel: 'in_app', config: { asset_id: A1, threshold: 70 } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rule.config).toEqual({ asset_id: A1, threshold: 70, direction: 'above' });
      expect(r.rule.is_active).toBe(true);
    }
  });

  it('rejects unknown kinds and channels', () => {
    expect(validateAlertRule({ kind: 'nope', channel: 'email', config: {} }).ok).toBe(false);
    expect(validateAlertRule({ kind: 'partnership_change', channel: 'sms', config: {} }).ok).toBe(false);
  });

  it('rejects out-of-range thresholds and non-UUID asset ids', () => {
    expect(validateAlertRule({ kind: 'score_threshold', channel: 'in_app', config: { threshold: 120 } }).ok).toBe(false);
    expect(validateAlertRule({ kind: 'score_threshold', channel: 'in_app', config: { threshold: 50, asset_id: 'abc' } }).ok).toBe(false);
  });

  it('requires a hooks.slack.com webhook for slack channel and strips it otherwise', () => {
    const bad = validateAlertRule({ kind: 'catalyst_upcoming', channel: 'slack', config: { webhook_url: 'https://evil.example/hook', days_ahead: 30 } });
    expect(bad.ok).toBe(false);
    const good = validateAlertRule({ kind: 'catalyst_upcoming', channel: 'slack', config: { webhook_url: 'https://hooks.slack.com/services/T000/B000/xyz', days_ahead: 14 } });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.rule.config).toEqual({ days_ahead: 14, webhook_url: 'https://hooks.slack.com/services/T000/B000/xyz' });
    const email = validateAlertRule({ kind: 'catalyst_upcoming', channel: 'email', config: { webhook_url: 'https://hooks.slack.com/services/T000/B000/xyz' } });
    expect(email.ok).toBe(true);
    if (email.ok) expect(email.rule.config).toEqual({ days_ahead: 30 });
  });
});

// ─── Dedupe keys / buckets ─────────────────────────────────────────────────

describe('dedupe keys and buckets', () => {
  it('builds stable keys and normalises empty parts', () => {
    expect(buildDedupeKey('mandate_digest', [M1, 'email', '2026-09-15'])).toBe(`mandate_digest:${M1}:email:2026-09-15`);
    expect(buildDedupeKey('score_threshold', [R1, A1, null, undefined, ''])).toBe(`score_threshold:${R1}:${A1}:-:-:-`);
  });

  it('buckets daily by date and weekly by ISO week', () => {
    expect(digestBucket(NOW, 'daily')).toBe('2026-09-15');
    expect(digestBucket(NOW, 'realtime')).toBe('2026-09-15');
    expect(digestBucket(NOW, 'weekly')).toBe(isoWeek(NOW));
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(isoWeek(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
  });

  it('knows when a digest is due', () => {
    expect(digestDue(NOW, 'daily', null)).toBe(true);
    expect(digestDue(NOW, 'daily', '2026-09-15T02:00:00Z')).toBe(false);
    expect(digestDue(NOW, 'daily', '2026-09-14T12:00:00Z')).toBe(true);
    expect(digestDue(NOW, 'weekly', '2026-09-12T12:00:00Z')).toBe(false);
    expect(digestDue(NOW, 'weekly', '2026-09-08T12:00:00Z')).toBe(true);
  });
});

// ─── Threshold crossings ───────────────────────────────────────────────────

describe('detectThresholdCrossing', () => {
  it('fires on the way up for above, not for below', () => {
    expect(detectThresholdCrossing({ previous: 65, current: 72, threshold: 70, direction: 'above' })).toBe('above');
    expect(detectThresholdCrossing({ previous: 65, current: 72, threshold: 70, direction: 'below' })).toBeNull();
    expect(detectThresholdCrossing({ previous: 65, current: 72, threshold: 70, direction: 'either' })).toBe('above');
  });

  it('fires on the way down for below, and exactly-at counts as crossed', () => {
    expect(detectThresholdCrossing({ previous: 70, current: 69, threshold: 70, direction: 'below' })).toBe('below');
    expect(detectThresholdCrossing({ previous: 69, current: 70, threshold: 70, direction: 'above' })).toBe('above');
  });

  it('does not fire when both sides are on the same side or values are missing', () => {
    expect(detectThresholdCrossing({ previous: 80, current: 90, threshold: 70, direction: 'either' })).toBeNull();
    expect(detectThresholdCrossing({ previous: null, current: 90, threshold: 70, direction: 'either' })).toBeNull();
  });

  it('returns the last crossing in a snapshot series', () => {
    const series = [
      { date: '2026-09-10', score: 60 },
      { date: '2026-09-11', score: 71 },
      { date: '2026-09-12', score: 68 },
      { date: '2026-09-13', score: 74 },
    ];
    expect(lastCrossingInSeries(series, 70, 'above')).toEqual({ direction: 'above', date: '2026-09-13', from: 68, to: 74 });
    expect(lastCrossingInSeries(series, 70, 'below')).toEqual({ direction: 'below', date: '2026-09-12', from: 71, to: 68 });
    expect(lastCrossingInSeries(series, 90, 'either')).toBeNull();
  });
});

// ─── Mandate digest ────────────────────────────────────────────────────────

const assets: DigestAsset[] = [
  { id: A1, asset_name: 'ABC-123', company_name: 'Acme Bio', phase: 'phase_2', modality: 'antibody', therapeutic_area: 'oncology', originator_country: 'KR', partnership_status: 'unpartnered', licensing_intent_score: 81, score_confidence: 60, top_signal: { type: 'cash_runway', value: 72, evidence: 'Cash runway under 12 months per 10-Q', date: '2026-08-30' } },
  { id: A2, asset_name: 'XYZ-9', company_name: 'Beta Tx', phase: 'phase_1', modality: 'small_molecule', therapeutic_area: 'neurology', originator_country: 'US', partnership_status: 'partially_partnered', licensing_intent_score: 44, score_confidence: 30, top_signal: null },
];

const mandate = { id: M1, name: 'Asia oncology P2', user_id: U1 };

describe('buildMandateDigest', () => {
  it('returns null (suppressed) when no match is newer than since', () => {
    const matches: DigestMatch[] = [{ asset_id: A1, match_score: 80, match_reasons: ['TA'], matched_at: '2026-09-13T00:00:00Z' }];
    expect(buildMandateDigest({ mandate, matches, assets, since: new Date('2026-09-14T00:00:00Z'), now: NOW })).toBeNull();
  });

  it('returns null when matches reference unknown or dismissed assets', () => {
    const matches: DigestMatch[] = [
      { asset_id: '77777777-7777-4777-8777-777777777777', match_score: 80, match_reasons: [], matched_at: '2026-09-15T01:00:00Z', is_stale: false },
      { asset_id: A1, match_score: 80, match_reasons: [], matched_at: '2026-09-15T01:00:00Z', is_dismissed: true, is_stale: false },
    ];
    expect(buildMandateDigest({ mandate, matches, assets, since: new Date('2026-09-14T00:00:00Z'), now: NOW })).toBeNull();
  });

  it('orders by score, builds why-now lines, and caps items while keeping total_new', () => {
    const matches: DigestMatch[] = [
      { asset_id: A2, match_score: 90, match_reasons: ['Neurology', 'Phase 1'], matched_at: '2026-09-15T01:00:00Z', is_stale: false },
      { asset_id: A1, match_score: 70, match_reasons: ['Oncology'], matched_at: '2026-09-15T02:00:00Z', is_stale: false },
    ];
    const d = buildMandateDigest({ mandate, matches, assets, since: new Date('2026-09-14T00:00:00Z'), now: NOW, maxItems: 1, baseUrl: 'https://example.test/' });
    expect(d).not.toBeNull();
    expect(d!.total_new).toBe(2);
    expect(d!.items).toHaveLength(1);
    expect(d!.items[0].asset_id).toBe(A1);
    expect(d!.items[0].why_now).toMatch(/^cash runway 72\/100: Cash runway under 12 months/);
    expect(d!.items[0].url).toBe(`https://example.test/radar/${A1}`);
    const full = buildMandateDigest({ mandate, matches, assets, since: new Date('2026-09-14T00:00:00Z'), now: NOW })!;
    expect(full.items[1].why_now).toBe('Neurology; Phase 1');
  });
});

describe('renderers', () => {
  const digest = buildMandateDigest({ mandate, matches: [{ asset_id: A1, match_score: 70, match_reasons: [], matched_at: '2026-09-15T02:00:00Z' }], assets, since: new Date('2026-09-14T00:00:00Z'), now: NOW })!;

  it('renders a subject with the count and escapes HTML in bodies', () => {
    const { subject, html } = renderDigestEmail({ ...digest, mandate_name: 'A <b>bold</b> mandate' });
    expect(subject).toContain('1 new match for');
    expect(html).toContain('A &lt;b&gt;bold&lt;/b&gt; mandate');
    expect(html).toContain(`/radar/${A1}`);
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('renders slack blocks with a header and links', () => {
    const s = renderDigestSlack(digest);
    expect(s.text).toContain('1 new match');
    expect(Array.isArray(s.blocks)).toBe(true);
    expect(JSON.stringify(s.blocks)).toContain(`<https://solidus.ambrosiaventures.co/radar/${A1}|ABC-123>`);
  });

  it('renders single alert emails', () => {
    const { subject, html } = renderAlertEmail({ kind: 'score_threshold', title: 'ABC-123 crossed above 70', detail: 'Moved 65 to 72', asset_name: 'ABC-123', company_name: 'Acme', url: 'https://x/radar/1' });
    expect(subject).toBe('Search & Evaluation: ABC-123 crossed above 70');
    expect(html).toContain('Open asset brief');
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

// ─── Orchestrator with a chain-aware Supabase mock ─────────────────────────

type Row = Record<string, unknown>;

function makeSupabase(tables: Record<string, Row[]>, opts: { duplicateKeys?: Set<string> } = {}) {
  const writes: Array<{ table: string; op: string; payload: unknown; filters: Array<[string, string, unknown]> }> = [];
  const claimed = new Set<string>(opts.duplicateKeys ?? []);

  function from(table: string) {
    const filters: Array<[string, string, unknown]> = [];
    let op = 'select';
    let payload: unknown = null;
    let selected = false;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    const filterMethod = (name: string) => (col: string, val: unknown) => { filters.push([name, col, val]); return chain; };
    Object.assign(chain, {
      select: (cols?: string) => { if (op === 'select') payload = cols; else selected = true; return chain; },
      eq: filterMethod('eq'), neq: filterMethod('neq'), gt: filterMethod('gt'), gte: filterMethod('gte'), lte: filterMethod('lte'), in: filterMethod('in'), is: filterMethod('is'),
      or: (expr: string) => { filters.push(['or', expr, null]); return chain; },
      order: self, limit: self,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: run()[0] ?? null, error: null }),
      insert: (p: unknown) => { op = 'insert'; payload = p; return chain; },
      update: (p: unknown) => { op = 'update'; payload = p; return chain; },
      upsert: (p: unknown) => { op = 'upsert'; payload = p; return chain; },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        try {
          if (op === 'select') return Promise.resolve({ data: run(), error: null }).then(resolve, reject);
          writes.push({ table, op, payload, filters });
          if (op === 'upsert' && table === 'radar_alert_events') {
            const key = (payload as Row).dedupe_key as string;
            if (claimed.has(key)) return Promise.resolve({ data: [], error: null }).then(resolve, reject);
            claimed.add(key);
            return Promise.resolve({ data: selected ? [{ id: `ev-${claimed.size}` }] : null, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        } catch (e) { return Promise.reject(e).then(resolve, reject); }
      },
    });
    function run(): Row[] {
      let rows = tables[table] ?? [];
      for (const [kind, col, val] of filters) {
        if (kind === 'eq') rows = rows.filter(r => r[col] === val);
        if (kind === 'neq') rows = rows.filter(r => r[col] !== val);
        if (kind === 'in') rows = rows.filter(r => (val as unknown[]).includes(r[col]));
        if (kind === 'gt') rows = rows.filter(r => String(r[col]) > String(val));
        if (kind === 'gte') rows = rows.filter(r => String(r[col]) >= String(val));
        if (kind === 'lte') rows = rows.filter(r => String(r[col]) <= String(val));
        if (kind === 'or') {
          const clauses = (col as string).split(',').map(c => c.split('.'));
          rows = rows.filter(r => clauses.some(([c, o, v]) => o === 'eq' && String(r[c]) === v));
        }
      }
      return rows;
    }
    return chain;
  }
  return { client: { from } as unknown as Parameters<typeof runRadarNotifications>[0], writes, claimed };
}

describe('runRadarNotifications', () => {
  const baseTables = (): Record<string, Row[]> => ({
    radar_alert_rules: [
      { id: R1, user_id: U1, team_id: null, kind: 'score_threshold', channel: 'email', config: { threshold: 70, direction: 'above' }, is_active: true },
    ],
    radar_user_mandates: [
      { id: M1, user_id: U1, name: 'Asia oncology', digest_frequency: 'daily', last_digest_at: null, notify_email: true, notify_in_app: true, is_active: true },
    ],
    user_profiles: [{ id: U1, email: 'analyst@example.com' }],
    radar_mandate_matches: [
      { mandate_id: M1, asset_id: A1, match_score: 80, match_reasons: ['Oncology'], matched_at: '2026-09-15T03:00:00Z', is_dismissed: false, is_stale: false },
    ],
    clinical_assets: [
      { id: A1, asset_name: 'ABC-123', company_name: 'Acme Bio', phase: 'phase_2', modality: 'antibody', therapeutic_area: 'oncology', originator_country: 'KR', partnership_status: 'unpartnered', partner_company_name: null, licensing_intent_score: 81, score_confidence: 60, nct_ids: [] },
    ],
    licensing_signals: [],
    radar_watchlist: [{ id: W1, user_id: U1, asset_id: A1, score_at_add: 50, last_score_seen: 65, last_partnership_status: 'unpartnered' }],
    asset_signal_snapshots: [{ asset_id: A1, licensing_intent_score: 81, score_delta: 16, snapshot_date: '2026-09-15' }],
    company_trials: [],
  });

  it('sends a digest per channel, fires the threshold crossing, and advances cursors', async () => {
    const { client, writes } = makeSupabase(baseTables());
    const sendEmail = jest.fn().mockResolvedValue({ success: true });
    const postSlack = jest.fn().mockResolvedValue({ success: true });

    const result = await runRadarNotifications(client, { now: NOW, deliver: { sendEmail, postSlack } });

    expect(result.errors).toEqual([]);
    expect(result.mandatesScanned).toBe(1);
    expect(result.digestsBuilt).toBe(1);
    // digest email + digest in_app + threshold email
    expect(result.eventsCreated).toBe(3);
    expect(result.deliveriesSent).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0].to).toBe('analyst@example.com');
    expect(sendEmail.mock.calls[0][0].subject).toContain('1 new match');
    expect(sendEmail.mock.calls[1][0].subject).toContain('crossed above 70');
    expect(postSlack).not.toHaveBeenCalled();

    const eventKeys = writes.filter(w => w.table === 'radar_alert_events' && w.op === 'upsert').map(w => (w.payload as Row).dedupe_key);
    expect(eventKeys).toEqual([
      `mandate_digest:${M1}:email:2026-09-15`,
      `mandate_digest:${M1}:in_app:2026-09-15`,
      `score_threshold:${R1}:${A1}:above:2026-09-15`,
    ]);
    expect(writes.some(w => w.table === 'radar_user_mandates' && w.op === 'update' && (w.payload as Row).last_digest_at)).toBe(true);
    const cursor = writes.find(w => w.table === 'radar_watchlist' && w.op === 'update');
    expect(cursor?.payload).toEqual({ last_score_seen: 81, last_partnership_status: 'unpartnered' });
  });

  it('is idempotent: a re-run with the same dedupe keys sends nothing', async () => {
    const dup = new Set([
      `mandate_digest:${M1}:email:2026-09-15`,
      `mandate_digest:${M1}:in_app:2026-09-15`,
      `score_threshold:${R1}:${A1}:above:2026-09-15`,
    ]);
    const { client } = makeSupabase(baseTables(), { duplicateKeys: dup });
    const sendEmail = jest.fn().mockResolvedValue({ success: true });
    const result = await runRadarNotifications(client, { now: NOW, deliver: { sendEmail, postSlack: jest.fn() } });
    expect(result.eventsCreated).toBe(0);
    expect(result.duplicatesSkipped).toBe(3);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('suppresses empty digests and does not fire thresholds without a crossing', async () => {
    const t = baseTables();
    t.radar_mandate_matches = [];
    t.radar_watchlist[0].last_score_seen = 79;
    const { client, writes } = makeSupabase(t);
    const sendEmail = jest.fn().mockResolvedValue({ success: true });
    const result = await runRadarNotifications(client, { now: NOW, deliver: { sendEmail, postSlack: jest.fn() } });
    expect(result.digestsBuilt).toBe(0);
    expect(result.eventsCreated).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    // cursor still advanced even with no digest
    expect(writes.some(w => w.table === 'radar_user_mandates' && w.op === 'update')).toBe(true);
  });

  it('records failed deliveries without throwing', async () => {
    const { client, writes } = makeSupabase(baseTables());
    const sendEmail = jest.fn().mockResolvedValue({ success: false, error: 'smtp down' });
    const result = await runRadarNotifications(client, { now: NOW, deliver: { sendEmail, postSlack: jest.fn() } });
    expect(result.deliveriesFailed).toBe(2);
    expect(result.errors.some(e => e.includes('smtp down'))).toBe(true);
    expect(writes.filter(w => w.table === 'radar_alert_events' && w.op === 'update' && (w.payload as Row).delivery_status === 'failed')).toHaveLength(2);
  });
});

// ─── XLSX export structure ─────────────────────────────────────────────────

describe('buildAssetListWorkbook', () => {
  const rows = [
    { id: A1, asset_name: 'ABC-123', company_name: 'Acme Bio', originator_country: 'KR', therapeutic_area: 'oncology', modality: 'antibody', phase: 'phase_2', partnership_status: 'unpartnered', licensing_intent_score: '81.44', score_confidence: 60, nct_ids: ['NCT01234567'], territory_rights_available: ['us', 'eu'] },
    { id: A2, asset_name: 'XYZ-9', company_name: 'Beta Tx', phase: 'phase_1', licensing_intent_score: null },
  ];

  it('creates an Assets sheet with a header row, one row per asset, and a Provenance sheet', async () => {
    const wb = buildAssetListWorkbook(rows, { source: 'selection', generated_at: NOW.toISOString(), requested_by: 'analyst@example.com', base_url: 'https://solidus.test', row_count: 2 });
    const ws = wb.getWorksheet(ASSET_SHEET)!;
    expect(ws).toBeDefined();
    expect(ws.rowCount).toBe(3);
    expect(ws.getRow(1).getCell(1).value).toBe('Asset');
    expect(ws.columnCount).toBe(ASSET_COLUMNS.length);
    const first = ws.getRow(2);
    expect(first.getCell(1).value).toBe('ABC-123');
    expect(first.getCell(ASSET_COLUMNS.findIndex(c => c.key === 'intent') + 1).value).toBe(81.4);
    expect(first.getCell(ASSET_COLUMNS.findIndex(c => c.key === 'url') + 1).value).toBe(`https://solidus.test/radar/${A1}`);
    expect(first.getCell(ASSET_COLUMNS.findIndex(c => c.key === 'rights') + 1).value).toBe('us, eu');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });

    const ps = wb.getWorksheet(PROVENANCE_SHEET)!;
    const fields = ps.getColumn('field').values.filter(Boolean).map(String);
    expect(fields).toEqual(expect.arrayContaining(['Generated by', 'Generated at (UTC)', 'Requested by', 'Source', 'Rows', 'Predicted terms', 'Data sources']));
    expect(ps.getRow(2).getCell(2).value).toBe('Solidus Search & Evaluation');
    const buffer = await wb.xlsx.writeBuffer();
    expect((buffer as ArrayBuffer).byteLength).toBeGreaterThan(1000);
  });

  it('prepends watchlist columns for watchlist exports', () => {
    const wb = buildAssetListWorkbook([{ ...rows[0], priority: 'high', tags: ['q4'], watch_owner: 'Me' }], { source: 'watchlist', scope: 'team', generated_at: NOW.toISOString(), requested_by: 'u', base_url: 'https://solidus.test', row_count: 1 });
    const ws = wb.getWorksheet(ASSET_SHEET)!;
    expect(ws.getRow(1).getCell(1).value).toBe('Priority');
    expect(ws.columnCount).toBe(WATCHLIST_COLUMNS.length + ASSET_COLUMNS.length);
    expect(ws.getRow(2).getCell(1).value).toBe('high');
    const ps = wb.getWorksheet(PROVENANCE_SHEET)!;
    expect(ps.getRow(5).getCell(2).value).toBe('watchlist (team)');
  });
});

// ─── Score breakdown (legacy + v3 snapshot shapes) ─────────────────────────

describe('buildScoreBreakdown', () => {
  it('reconstructs all nine factors from the legacy factor_scores map with evidence from signals', () => {
    const snapshot = { factor_scores: { cash_runway: 80, regulatory_milestone: 40, availability_factor: 1, phase_multiplier: 1, raw_weighted: 20.8, score_confidence: 55 }, licensing_intent_score: 21, snapshot_date: '2026-09-15' };
    const signals = [{ signal_type: 'cash_runway', signal_value: 80, confidence: 70, evidence_text: 'Runway < 12 months', evidence_url: 'https://sec.gov/x', evidence_date: '2026-08-01' }];
    const b = buildScoreBreakdown({ currentScore: 21, currentConfidence: 55, snapshot, signals });
    expect(b.legacy_shape).toBe(true);
    expect(b.contributions).toHaveLength(9);
    expect(b.contributions[0]).toMatchObject({ factor: 'cash_runway', weight: 0.18, score: 80, points: 14.4, evidence_url: 'https://sec.gov/x' });
    const zero = b.contributions.find(c => c.factor === 'strategic_review')!;
    expect(zero.points).toBe(0);
    expect(zero.sources_checked.length).toBeGreaterThan(0);
    expect(b.waterfall.at(-1)).toMatchObject({ key: 'composite', value: 21 });
    expect(b.waterfall.find(s => s.key === 'raw_weighted')!.value).toBe(20.8);
  });

  it('reads the v3 contributions shape and model version', () => {
    const contributions = [{ factor: 'cash_runway', weight: 0.18, score: 50, points: 9, confidence: 80, evidence_text: 'x', evidence_url: null, evidence_date: null, sources_checked: ['companies'] }];
    const parsed = parseSnapshotFactors({ factor_scores: { model_version: 'v3.0.1', contributions, raw_weighted: 9, phase_multiplier: 0.9, availability_factor: 1 }, licensing_intent_score: 8, snapshot_date: '2026-09-15' });
    expect(parsed.legacy).toBe(false);
    expect(parsed.model_version).toBe('v3.0.1');
    expect(parsed.contributions).toHaveLength(9);
    expect(parsed.phase_multiplier).toBe(0.9);
  });
});

describe('calculatorHref', () => {
  it('maps radar vocabulary to calculator params and omits unmapped values', () => {
    expect(calculatorHref({ therapeutic_area: 'infectious_disease', phase: 'phase_1_2', modality: 'antibody', indication_specific: 'hepatitis B' }))
      .toBe('/calculator?dealType=licensing&therapeuticArea=infectiousDisease&phase=phase1_2&modality=mab&indication=hepatitis+B');
    expect(calculatorHref({ therapeutic_area: 'respiratory', phase: null, modality: null })).toBe('/calculator?dealType=licensing');
  });
});
