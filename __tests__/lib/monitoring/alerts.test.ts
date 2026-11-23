/**
 * @jest-environment node
 */
import { planAlerts, transitionLines, digestLines, type MonitorState } from '@/lib/monitoring/alerts';
import { runCheck, runRevenueMonitor, selectChecks, dailyDue, ALL_CHECKS, STATE_KEY, DAILY_UTC_HOUR } from '@/lib/monitoring';
import type { CheckResult, CheckStatus, MonitorCheck } from '@/lib/monitoring/types';
import { fakeDb, makeCtx } from './fakes';

const at = (iso: string) => new Date(iso);
const result = (id: string, status: CheckStatus, reason = status): CheckResult =>
  ({ id, label: id.toUpperCase(), cadence: 'hourly', status, reason, durationMs: 1 });

describe('planAlerts: page only on entering or leaving fail', () => {
  const t0 = at('2026-11-23T10:20:00Z');
  const t1 = at('2026-11-23T11:20:00Z');
  const t2 = at('2026-11-25T11:20:00Z');

  it('first run: alerts existing failures, not oks or warns', () => {
    const plan = planAlerts(null, [result('a', 'ok'), result('b', 'fail', 'down'), result('c', 'warn')], t0, { digestDue: false });
    expect(plan.transitions).toEqual([{ id: 'b', label: 'B', from: null, to: 'fail', reason: 'down' }]);
    expect(plan.next.checks.b).toMatchObject({ status: 'fail', since: t0.toISOString(), lastRun: t0.toISOString() });
  });

  it('ok -> fail alerts once; staying failed does not re-alert', () => {
    const p1 = planAlerts(null, [result('a', 'ok')], t0, { digestDue: false });
    const p2 = planAlerts(p1.next, [result('a', 'fail', 'boom')], t1, { digestDue: false });
    expect(p2.transitions).toHaveLength(1);
    const p3 = planAlerts(p2.next, [result('a', 'fail', 'still boom')], t2, { digestDue: false });
    expect(p3.transitions).toHaveLength(0);
    expect(p3.next.checks.a.since).toBe(t1.toISOString());
    expect(p3.next.checks.a.reason).toBe('still boom');
  });

  it('fail -> ok alerts a recovery with how long it was down', () => {
    const p1 = planAlerts(null, [result('a', 'fail')], t0, { digestDue: false });
    const p2 = planAlerts(p1.next, [result('a', 'ok', 'fine')], t2, { digestDue: false });
    expect(p2.transitions).toEqual([{ id: 'a', label: 'A', from: 'fail', to: 'ok', reason: 'fine', failingSince: t0.toISOString() }]);
    expect(transitionLines(p2.transitions, t2)[0]).toBe('✅ *A* recovered after 2 days: fine');
  });

  it('fail -> warn counts as a recovery; ok <-> warn never pages', () => {
    const p1 = planAlerts(null, [result('a', 'fail'), result('b', 'ok')], t0, { digestDue: false });
    const p2 = planAlerts(p1.next, [result('a', 'warn'), result('b', 'warn')], t1, { digestDue: false });
    expect(p2.transitions.map(t => [t.id, t.from, t.to])).toEqual([['a', 'fail', 'warn']]);
    const p3 = planAlerts(p2.next, [result('b', 'ok')], t2, { digestDue: false });
    expect(p3.transitions).toHaveLength(0);
  });

  it('keeps state of checks that did not run this pass (daily checks)', () => {
    const p1 = planAlerts(null, [result('daily', 'fail'), result('a', 'ok')], t0, { digestDue: false });
    const p2 = planAlerts(p1.next, [result('a', 'ok')], t1, { digestDue: false });
    expect(p2.next.checks.daily.status).toBe('fail');
    expect(p2.transitions).toHaveLength(0);
  });

  it('posts the digest once per UTC day', () => {
    const p1 = planAlerts(null, [result('a', 'ok')], t0, { digestDue: true });
    expect(p1.digest).toBe(true);
    expect(p1.next.lastDigest).toBe('2026-11-23');
    expect(planAlerts(p1.next, [result('a', 'ok')], t1, { digestDue: true }).digest).toBe(false);
    expect(planAlerts(p1.next, [result('a', 'ok')], t2, { digestDue: true }).digest).toBe(true);
    expect(planAlerts(p1.next, [result('a', 'ok')], t2, { digestDue: false }).digest).toBe(false);
  });

  it('digest lists worst first with a headline', () => {
    const state = planAlerts(null, [result('z', 'ok', 'fine'), result('m', 'warn', 'slow'), result('b', 'fail', 'down')], t0, { digestDue: false }).next;
    const d = digestLines(state);
    expect(d.headline).toBe('Revenue paths: 1 failing, 1 warning, 1 ok');
    expect(d.lines).toEqual(['🔴 b: down', '⚠️ m: slow', '✅ z: fine']);
    expect(digestLines(planAlerts(null, [result('z', 'ok')], t0, { digestDue: false }).next).headline).toBe('Revenue paths: all 1 checks ok');
  });
});

describe('runner', () => {
  it('turns a throw into fail and a hang into a timeout fail', async () => {
    const ctx = makeCtx();
    const throws: MonitorCheck = { id: 't', label: 'T', cadence: 'hourly', run: async () => { throw new Error('kaput'); } };
    expect(await runCheck(throws, ctx)).toMatchObject({ status: 'fail', reason: 'check error: kaput' });
    const hangs: MonitorCheck = { id: 'h', label: 'H', cadence: 'hourly', run: () => new Promise(() => {}) };
    expect(await runCheck(hangs, ctx, 20)).toMatchObject({ status: 'fail', reason: 'check error: timed out after 0 s' });
  });

  it('covers all seven areas, with the reset and session checks daily', () => {
    const ids = ALL_CHECKS.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['auth_config', 'password_reset', 'stripe_prices', 'checkout_session', 'stripe_webhook', 'calculator_data', 'ingestion_freshness', 'ai_keys', 'public_pages', 'database']));
    expect(ALL_CHECKS.filter(c => c.cadence === 'daily').map(c => c.id).sort()).toEqual(['checkout_session', 'password_reset']);
  });

  it('auto scope adds a daily check when it never ran or is 23 h stale after the daily hour', () => {
    const daily = ALL_CHECKS.find(c => c.id === 'password_reset')!;
    const state = (lastRun: string): MonitorState => ({ checks: { password_reset: { status: 'ok', reason: '', cadence: 'daily', since: lastRun, lastRun } } });
    expect(dailyDue(daily, null, at('2026-11-23T03:20:00Z'))).toBe(true);
    expect(dailyDue(daily, state('2026-11-22T14:20:00Z'), at('2026-11-23T13:20:00Z'))).toBe(false);
    expect(dailyDue(daily, state('2026-11-22T14:20:00Z'), at(`2026-11-23T${DAILY_UTC_HOUR}:20:00Z`))).toBe(true);
    expect(dailyDue(daily, state('2026-11-23T14:20:00Z'), at('2026-11-23T15:20:00Z'))).toBe(false);
    // Missed 14:20: picked up at 15:20.
    expect(dailyDue(daily, state('2026-11-22T14:20:00Z'), at('2026-11-23T15:20:00Z'))).toBe(true);
    expect(selectChecks('hourly').some(c => c.cadence === 'daily')).toBe(false);
    expect(selectChecks('all')).toHaveLength(ALL_CHECKS.length);
    expect(selectChecks('all', { only: ['database'] }).map(c => c.id)).toEqual(['database']);
  });

  it('record: loads state, alerts only the transition, posts the digest, saves state', async () => {
    const prev: MonitorState = {
      checks: { database: { status: 'ok', reason: 'fine', cadence: 'hourly', since: '2026-11-22T00:00:00Z', lastRun: '2026-11-23T14:20:00Z' } },
      lastDigest: '2026-11-22',
    };
    const { client, calls } = fakeDb({
      system_config: ops => (ops.some(o => o[0] === 'upsert') ? {} : { data: { value: prev } }),
      deals: { error: { message: 'connection refused' } },
    });
    const transitions = jest.fn(async () => {});
    const digest = jest.fn(async () => {});
    const ctx = makeCtx({ now: at('2026-11-23T15:20:00Z'), service: () => client as never });
    const run = await runRevenueMonitor(ctx, { scope: 'all', only: ['database'], record: true, notify: { transitions, digest } });

    expect(run.results[0]).toMatchObject({ id: 'database', status: 'fail' });
    expect(transitions).toHaveBeenCalledWith([expect.stringMatching(/^🔴 \*Database\* failing: query failed/)], true);
    expect(digest).toHaveBeenCalledTimes(1);
    const upsert = calls.find(c => c.table === 'system_config' && c.ops.some(o => o[0] === 'upsert'))!;
    const row = upsert.ops.find(o => o[0] === 'upsert')![1] as { key: string; value: MonitorState };
    expect(row.key).toBe(STATE_KEY);
    expect(row.value.checks.database.status).toBe('fail');
    expect(row.value.lastDigest).toBe('2026-11-23');
  });

  it('on-demand read (record off) never touches Slack or state', async () => {
    const { client, calls } = fakeDb({ deals: { data: [] } });
    const transitions = jest.fn();
    const digest = jest.fn();
    const run = await runRevenueMonitor(makeCtx({ service: () => client as never }), { scope: 'all', only: ['database'], record: false, notify: { transitions, digest } });
    expect(run.recorded).toBe(false);
    expect(transitions).not.toHaveBeenCalled();
    expect(digest).not.toHaveBeenCalled();
    expect(calls.some(c => c.table === 'system_config')).toBe(false);
  });
});
