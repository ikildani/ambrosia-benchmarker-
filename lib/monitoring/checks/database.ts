/**
 * Database health. Incident: Sep 25 2026 Postgres stalled under its own cron
 * load and the site returned 504s.
 */

import { type MonitorCheck, ok, warn, fail, errMsg } from '../types';

export const DB_WARN_MS = 1_500;
export const DB_FAIL_MS = 5_000;

export const databaseCheck: MonitorCheck = {
  id: 'database',
  label: 'Database',
  cadence: 'hourly',
  async run(ctx) {
    const t0 = Date.now();
    const { error } = await ctx.service().from('deals').select('id').limit(1);
    const ms = Date.now() - t0;
    if (error) return fail(`query failed after ${ms} ms: ${errMsg(error.message)}`);
    if (ms > DB_FAIL_MS) return fail(`simple query took ${ms} ms`);
    if (ms > DB_WARN_MS) return warn(`simple query took ${ms} ms`);
    return ok(`simple query ${ms} ms`);
  },
};
