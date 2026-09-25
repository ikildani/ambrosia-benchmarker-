/**
 * Brief outcome follow-ups: stage windows, idempotency, the client-outcome
 * skip, the email copy, and the runner against a stubbed Supabase with an
 * injected sender.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FOLLOWUP_FROM,
  FOLLOWUP_MAX_DAYS,
  FOLLOWUP_REPLY_TO,
  buildFollowupEmail,
  followupLink,
  runOutcomeFollowups,
  selectFollowups,
  stageForDays,
  type FollowupCandidate,
  type FollowupOutcomeRow,
  type FollowupSender,
  type FollowupPredictionRow,
  type FollowupRequestRow,
  type FollowupSentRow,
} from '@/lib/outcomes/followups';
import { verifyOutcomeReportToken } from '@/lib/outcomes/report-token';

const NOW = new Date('2026-09-25T02:00:00Z');
const DAY = 86_400_000;
const R1 = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const R2 = '1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const R3 = '2a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const P1 = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const P2 = '7f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const P3 = '8f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const deliveredDaysAgo = (d: number) => new Date(NOW.getTime() - d * DAY - 3_600_000).toISOString();

const request = (over: Partial<FollowupRequestRow> = {}): FollowupRequestRow => ({
  id: R1, email: 'cfo@example.com', name: 'Dana Lee', delivered_at: deliveredDaysAgo(46),
  therapeutic_area: 'oncology', indication: 'NSCLC', phase: 'Phase 2', status: 'delivered', ...over,
});
const prediction = (over: Partial<FollowupPredictionRow> = {}): FollowupPredictionRow => ({
  id: P1, source_id: R1, status: 'open', asset_name: 'AV-101', upfront_mid: 45, total_mid: 620, ...over,
});

beforeEach(() => {
  process.env.OUTCOME_TOKEN_SECRET = 'followup-test-secret';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.OUTCOME_TOKEN_SECRET;
  jest.restoreAllMocks();
});

describe('stageForDays', () => {
  it('maps days since delivery to a stage or a skip', () => {
    expect(stageForDays(0)).toBe('not_due');
    expect(stageForDays(44)).toBe('not_due');
    expect(stageForDays(45)).toBe(45);
    expect(stageForDays(119)).toBe(45);
    expect(stageForDays(120)).toBe(120);
    expect(stageForDays(FOLLOWUP_MAX_DAYS - 1)).toBe(120);
    expect(stageForDays(FOLLOWUP_MAX_DAYS)).toBe('too_old');
  });
});

describe('selectFollowups', () => {
  const base = { predictions: [prediction()], sent: [] as FollowupSentRow[], clientOutcomes: [] as FollowupOutcomeRow[], now: NOW };

  it('sends day 45 in its window and day 120 in its window', () => {
    const s45 = selectFollowups({ ...base, requests: [request({ delivered_at: deliveredDaysAgo(45) })] });
    expect(s45.due.map((c) => [c.request.id, c.stage, c.daysSinceDelivery])).toEqual([[R1, 45, 45]]);
    const s120 = selectFollowups({ ...base, requests: [request({ delivered_at: deliveredDaysAgo(130) })] });
    expect(s120.due.map((c) => c.stage)).toEqual([120]);
  });

  it('skips briefs that are not due yet or too old', () => {
    const s = selectFollowups({ ...base, requests: [request({ delivered_at: deliveredDaysAgo(10) }), request({ id: R2, delivered_at: deliveredDaysAgo(400) }), request({ id: R3, delivered_at: null })] });
    expect(s.due).toHaveLength(0);
    expect(s.skipped.not_due).toBe(2);
    expect(s.skipped.too_old).toBe(1);
  });

  it('is idempotent: a recorded stage is not sent again, but the next stage still is', () => {
    const sent: FollowupSentRow[] = [{ request_id: R1, stage: 45 }];
    expect(selectFollowups({ ...base, sent, requests: [request({ delivered_at: deliveredDaysAgo(60) })] }).due).toHaveLength(0);
    const later = selectFollowups({ ...base, sent, requests: [request({ delivered_at: deliveredDaysAgo(121) })] });
    expect(later.due.map((c) => c.stage)).toEqual([120]);
    const both = selectFollowups({ ...base, sent: [...sent, { request_id: R1, stage: 120 }], requests: [request({ delivered_at: deliveredDaysAgo(121) })] });
    expect(both.due).toHaveLength(0);
    expect(both.skipped.already_sent).toBe(1);
  });

  it('does not send a missed day-45 once the day-120 window has opened (the day-120 mail carries it)', () => {
    const s = selectFollowups({ ...base, requests: [request({ delivered_at: deliveredDaysAgo(125) })] });
    expect(s.due.map((c) => c.stage)).toEqual([120]);
  });

  it('skips when the prediction already has an accepted client outcome', () => {
    const s = selectFollowups({ ...base, requests: [request()], clientOutcomes: [{ prediction_id: P1, matched_by: 'client', status: 'accepted' }] });
    expect(s.due).toHaveLength(0);
    expect(s.skipped.has_client_outcome).toBe(1);
    // an auto match is not a client report — the client is still asked
    const auto = selectFollowups({ ...base, requests: [request()], clientOutcomes: [{ prediction_id: P1, matched_by: 'auto', status: 'accepted' }] });
    expect(auto.due).toHaveLength(1);
  });

  it('skips requests without a brief prediction, without an email, or withdrawn', () => {
    const s = selectFollowups({
      ...base,
      requests: [request({ id: R2 }), request({ email: ' ' }), request({ id: R3 })],
      predictions: [prediction(), prediction({ id: P3, source_id: R3, status: 'withdrawn' })],
    });
    expect(s.due).toHaveLength(0);
    expect(s.skipped).toMatchObject({ no_prediction: 1, no_email: 1, withdrawn: 1 });
  });
});

describe('buildFollowupEmail', () => {
  const candidate = (stage: 45 | 120): FollowupCandidate => ({ request: request(), prediction: prediction(), stage, daysSinceDelivery: stage });
  const link = 'https://solidus.ambrosiaventures.co/outcomes/report/abc.def';

  it('day 45: two paragraphs, the ask, the delivery date, one link, signed by Issa', () => {
    const e = buildFollowupEmail(candidate(45), link);
    expect(e.subject).toBe('How has the process gone for AV-101?');
    expect(e.text).toContain('Hi Dana,');
    expect(e.text).toContain('$45M upfront and $620M in total value');
    expect(e.text).toContain('August 10, 2026');
    expect(e.text.split(link)).toHaveLength(2);
    expect(e.html.split(link)).toHaveLength(3); // href + visible text
    expect(e.text).toMatch(/Issa Kildani\nManaging Partner, Ambrosia Ventures$/);
    expect(e.text.split('\n\n')).toHaveLength(4); // greeting, p1, p2 + link, signature
    expect(e.html).not.toMatch(/unsubscribe|trial|upgrade|AI/i);
  });

  it('day 120: closes the loop and asks for a reply when still open', () => {
    const e = buildFollowupEmail(candidate(120), link);
    expect(e.subject).toBe('Closing the loop on AV-101');
    expect(e.text).toContain('four months');
    expect(e.text).toContain('a one-line reply on where it stands');
    expect(e.text).toContain(link);
  });

  it('falls back to indication + phase and to a generic ask when the prediction has no terms', () => {
    const c: FollowupCandidate = { request: request({ name: null }), prediction: prediction({ asset_name: null, upfront_mid: null, total_mid: null }), stage: 45, daysSinceDelivery: 45 };
    const e = buildFollowupEmail(c, link);
    expect(e.subject).toBe('How has the process gone for NSCLC, Phase 2?');
    expect(e.text).toContain('Hi there,');
    expect(e.text).toContain('the ask set at the terms in the brief');
  });

  it('escapes html in names', () => {
    const c: FollowupCandidate = { request: request({ name: '<b>X</b>' }), prediction: prediction(), stage: 45, daysSinceDelivery: 45 };
    expect(buildFollowupEmail(c, link).html).toContain('Hi &lt;b&gt;X&lt;/b&gt;,');
  });
});

describe('followupLink', () => {
  it('signs a token for the prediction and request under the configured base url', () => {
    const c: FollowupCandidate = { request: request(), prediction: prediction(), stage: 45, daysSinceDelivery: 45 };
    const url = followupLink(c, 'https://solidus.ambrosiaventures.co/', NOW);
    expect(url.startsWith('https://solidus.ambrosiaventures.co/outcomes/report/')).toBe(true);
    const token = url.split('/outcomes/report/')[1];
    const v = verifyOutcomeReportToken(token, { now: NOW });
    expect(v).toEqual({ ok: true, payload: expect.objectContaining({ predictionId: P1, requestId: R1 }) });
  });
});

// ─── runner with a stubbed database ────────────────────────────────────────

interface Tables {
  benchmark_requests: FollowupRequestRow[];
  predictions: FollowupPredictionRow[];
  outcome_followups: FollowupSentRow[];
  outcomes: FollowupOutcomeRow[];
}

function makeStub(tables: Tables, opts: { insertError?: string } = {}) {
  const inserts: Array<Record<string, unknown>> = [];
  const filters: Array<{ table: string; op: string; args: unknown[] }> = [];
  const stub = {
    from(table: keyof Tables) {
      const chain: Record<string, unknown> = {};
      const rows = () => tables[table] as unknown[];
      for (const m of ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit']) {
        chain[m] = (...args: unknown[]) => { filters.push({ table, op: m, args }); return chain; };
      }
      chain.insert = (payload: Record<string, unknown>) => {
        inserts.push(payload);
        if (!opts.insertError) (tables.outcome_followups as FollowupSentRow[]).push({ request_id: payload.request_id as string, stage: payload.stage as number });
        return { then: (res: (v: unknown) => unknown) => Promise.resolve({ error: opts.insertError ? { message: opts.insertError } : null }).then(res) };
      };
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res, rej);
      return chain;
    },
    inserts,
    filters,
  };
  return stub as unknown as SupabaseClient & { inserts: typeof inserts; filters: typeof filters };
}

describe('runOutcomeFollowups', () => {
  it('sends one email per due (request, stage) from Issa and records it', async () => {
    const tables: Tables = {
      benchmark_requests: [request(), request({ id: R2, email: 'ceo@example.com', delivered_at: deliveredDaysAgo(150) })],
      predictions: [prediction(), prediction({ id: P2, source_id: R2 })],
      outcome_followups: [],
      outcomes: [],
    };
    const db = makeStub(tables);
    const send = jest.fn<ReturnType<FollowupSender>, Parameters<FollowupSender>>(async () => ({ success: true }));
    const report = await runOutcomeFollowups(db, { now: NOW, baseUrl: 'https://solidus.ambrosiaventures.co', send });

    expect(report.errors).toEqual([]);
    expect(report).toMatchObject({ requests: 2, due: 2, sent: 2 });
    expect(send).toHaveBeenCalledTimes(2);
    const first = send.mock.calls[0][0];
    expect(first).toMatchObject({ to: 'cfo@example.com', from: FOLLOWUP_FROM, replyTo: FOLLOWUP_REPLY_TO, subject: 'How has the process gone for AV-101?' });
    expect(first.html).toContain('/outcomes/report/');
    expect(db.inserts).toEqual([
      expect.objectContaining({ request_id: R1, prediction_id: P1, stage: 45, email: 'cfo@example.com', sent_at: NOW.toISOString() }),
      expect.objectContaining({ request_id: R2, prediction_id: P2, stage: 120, email: 'ceo@example.com' }),
    ]);
    // the delivered_at window: [now − 200 d, now − 45 d]
    const gte = db.filters.find((f) => f.table === 'benchmark_requests' && f.op === 'gte')!;
    const lte = db.filters.find((f) => f.table === 'benchmark_requests' && f.op === 'lte')!;
    expect(gte.args).toEqual(['delivered_at', new Date(NOW.getTime() - 200 * DAY).toISOString()]);
    expect(lte.args).toEqual(['delivered_at', new Date(NOW.getTime() - 45 * DAY).toISOString()]);

    // second run on the same day: nothing to send
    const again = await runOutcomeFollowups(db, { now: NOW, send });
    expect(again.sent).toBe(0);
    expect(again.skipped.already_sent).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not record a follow-up when the send fails, and skips reported outcomes', async () => {
    const tables: Tables = {
      benchmark_requests: [request(), request({ id: R2, delivered_at: deliveredDaysAgo(50) })],
      predictions: [prediction(), prediction({ id: P2, source_id: R2 })],
      outcome_followups: [],
      outcomes: [{ prediction_id: P2, matched_by: 'client', status: 'accepted' }],
    };
    const db = makeStub(tables);
    const send = jest.fn(async () => ({ success: false, error: 'sendgrid down' }));
    const report = await runOutcomeFollowups(db, { now: NOW, send });
    expect(report.due).toBe(1);
    expect(report.sent).toBe(0);
    expect(report.skipped.has_client_outcome).toBe(1);
    expect(report.errors).toEqual([`send day 45 to request ${R1}: sendgrid down`]);
    expect(db.inserts).toHaveLength(0);
  });

  it('dry run selects but sends and writes nothing', async () => {
    const db = makeStub({ benchmark_requests: [request()], predictions: [prediction()], outcome_followups: [], outcomes: [] });
    const send = jest.fn(async () => ({ success: true }));
    const report = await runOutcomeFollowups(db, { now: NOW, send, dryRun: true });
    expect(report.due).toBe(1);
    expect(report.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(db.inserts).toHaveLength(0);
  });

  it('never throws: a failing query is reported', async () => {
    const db = { from: () => { throw new Error('connection refused'); } } as unknown as SupabaseClient;
    const report = await runOutcomeFollowups(db, { now: NOW, send: jest.fn(async () => ({ success: true })) });
    expect(report.errors).toEqual(['connection refused']);
    expect(report.sent).toBe(0);
  });
});
