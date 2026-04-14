/**
 * Audit approved-phase deals by TA to inform per-TA post-approval multiplier
 * calibration. Reads from __tests__/backtest/baseline-errors.json which is
 * already populated by the last backtest run.
 */
import * as fs from 'fs';

interface BacktestResult {
  case: {
    therapeuticArea: string;
    phase: string;
    dealType: string;
    actualUpfront_M: number;
  };
  predictedUpfront_M: number;
  upfrontErrorPct: number;
}

const raw = JSON.parse(fs.readFileSync('__tests__/backtest/baseline-errors.json', 'utf8')) as {
  results: BacktestResult[];
};

const approved = raw.results.filter((r) => r.case.phase === 'approved');
const approvedLicensing = approved.filter(
  (r) =>
    r.case.dealType === 'licensing' ||
    r.case.dealType === 'codevelopment' ||
    r.case.dealType === 'collaboration',
);

console.log(`Total approved deals:           ${approved.length}`);
console.log(`Approved licensing/codev/collab: ${approvedLicensing.length}\n`);

const byTA: Record<string, BacktestResult[]> = {};
for (const r of approvedLicensing) {
  (byTA[r.case.therapeuticArea] ??= []).push(r);
}

console.log('Per-TA approved licensing:');
console.log('  (suggested_mult = 0.08 × actual_med / predicted_med; linear scaling of multiplier)');
console.log('');
const sorted = Object.entries(byTA).sort((a, b) => b[1].length - a[1].length);
for (const [ta, rows] of sorted) {
  const n = rows.length;
  const preds = [...rows.map((r) => r.predictedUpfront_M)].sort((a, b) => a - b);
  const acts = [...rows.map((r) => r.case.actualUpfront_M)].sort((a, b) => a - b);
  const errs = [...rows.map((r) => r.upfrontErrorPct)].sort((a, b) => a - b);
  const predMed = preds[Math.floor(n / 2)];
  const actMed = acts[Math.floor(n / 2)];
  const sgnMed = errs[Math.floor(n / 2)];
  const suggested = actMed > 0 && predMed > 0 ? (0.08 * actMed) / predMed : 0.08;
  console.log(
    `  ${ta.padEnd(20)} n=${n.toString().padStart(2)}  pred_med=$${predMed.toFixed(0).padStart(4)}M  act_med=$${actMed.toFixed(0).padStart(4)}M  signed_med=${(sgnMed * 100).toFixed(0).padStart(4)}%  suggested_mult=${suggested.toFixed(3)}`,
  );
}
