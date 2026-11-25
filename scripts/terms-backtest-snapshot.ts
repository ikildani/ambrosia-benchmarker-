/**
 * Snapshot the deal-terms backtest inputs to a committed fixture, so the backtest (and the CI accuracy gate) run
 * offline and deterministically.
 *
 *   npx tsx scripts/terms-backtest-snapshot.ts [--out data/backtest/terms-backtest-fixture.json] [--from YYYY-MM-DD]
 *
 * --from widens the window's start (default 2023-01-01), e.g. for re-measuring territory multipliers on more deals.
 *
 * Writes the primary-sourced `deals_verified` licenses / collaborations / options with a disclosed upfront in the
 * window (lib/backtest/terms-backtest-fetch.ts) and the active `benchmark_calibrations` rows.
 * Read-only. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * After a refresh, regenerate the baseline in the same PR:
 *   npx tsx scripts/terms-backtest.ts --fixture data/backtest/terms-backtest-fixture.json --write-baseline
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { BACKTEST_WINDOW, fetchBacktestFixture } from '../lib/backtest/terms-backtest-fetch';

async function main() {
  const from = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : undefined;
  const { inWindow, ...fixture } = await fetchBacktestFixture(from ? { from, to: BACKTEST_WINDOW.to } : BACKTEST_WINDOW);
  const i = process.argv.indexOf('--out');
  const out = i > 0 ? process.argv[i + 1] : 'data/backtest/terms-backtest-fixture.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(fixture, null, 1) + '\n');
  console.log(`Wrote ${out}: ${fixture.deals.length} primary-sourced deals (of ${inWindow} in window), ${fixture.calibrations.length} calibration rows`);
}
main().catch((e) => { console.error(e); process.exit(1); });
