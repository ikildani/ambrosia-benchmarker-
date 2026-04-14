import * as fs from 'fs';

interface BacktestResult {
  case: {
    id: string;
    year: number;
    licensor: string;
    licensee: string;
    therapeuticArea: string;
    indication: string;
    phase: string;
    dealType: string;
    modality: string;
    actualUpfront_M: number;
  };
  predictedUpfront_M: number;
  upfrontErrorPct: number;
}

const raw = JSON.parse(fs.readFileSync('__tests__/backtest/baseline-errors.json', 'utf8')) as {
  results: BacktestResult[];
};

const ph2 = raw.results.filter((r) => r.case.phase === 'phase2');
console.log(`Total phase2 deals: ${ph2.length}`);

// Breakdown by deal type
const byDT: Record<string, BacktestResult[]> = {};
for (const r of ph2) {
  (byDT[r.case.dealType] ??= []).push(r);
}
console.log('\nBy dealType:');
for (const [dt, rows] of Object.entries(byDT).sort((a, b) => b[1].length - a[1].length)) {
  const n = rows.length;
  const preds = [...rows.map((r) => r.predictedUpfront_M)].sort((a, b) => a - b);
  const acts = [...rows.map((r) => r.case.actualUpfront_M)].sort((a, b) => a - b);
  const errs = [...rows.map((r) => r.upfrontErrorPct)].sort((a, b) => a - b);
  const predMed = preds[Math.floor(n / 2)];
  const actMed = acts[Math.floor(n / 2)];
  const sgnMed = errs[Math.floor(n / 2)];
  const hits25 = rows.filter((r) => Math.abs(r.upfrontErrorPct) <= 0.25).length;
  console.log(
    `  ${dt.padEnd(15)} n=${n.toString().padStart(2)}  hit25=${((hits25 / n) * 100).toFixed(0).padStart(3)}%  pred_med=$${predMed.toFixed(0).padStart(4)}M  act_med=$${actMed.toFixed(0).padStart(4)}M  signed_med=${(sgnMed * 100).toFixed(0).padStart(5)}%`,
  );
}

// Non-licensing+codev worst overshoots AND undershoots
const nonCore = ph2.filter(
  (r) =>
    r.case.dealType !== 'licensing' && r.case.dealType !== 'codevelopment',
);
console.log(`\n\nPhase 2 NON-CORE (not licensing/codev): n=${nonCore.length}`);

console.log('\nTop 10 undershoots (engine << actual) in phase2 non-core:');
const sortedAsc = [...nonCore].sort((a, b) => a.upfrontErrorPct - b.upfrontErrorPct).slice(0, 10);
for (const r of sortedAsc) {
  console.log(
    `  ${r.case.year} ${r.case.licensor.padEnd(28)} → ${r.case.licensee.padEnd(20)} ${r.case.therapeuticArea.padEnd(14)} ${r.case.dealType.padEnd(12)} ${r.case.modality.padEnd(14)} actual=$${r.case.actualUpfront_M.toFixed(0).padStart(4)}M pred=$${r.predictedUpfront_M.toFixed(0).padStart(4)}M  err=${(r.upfrontErrorPct * 100).toFixed(0)}%`,
  );
}

console.log('\nTop 10 overshoots in phase2 non-core:');
const sortedDesc = [...nonCore].sort((a, b) => b.upfrontErrorPct - a.upfrontErrorPct).slice(0, 10);
for (const r of sortedDesc) {
  console.log(
    `  ${r.case.year} ${r.case.licensor.padEnd(28)} → ${r.case.licensee.padEnd(20)} ${r.case.therapeuticArea.padEnd(14)} ${r.case.dealType.padEnd(12)} ${r.case.modality.padEnd(14)} actual=$${r.case.actualUpfront_M.toFixed(0).padStart(4)}M pred=$${r.predictedUpfront_M.toFixed(0).padStart(4)}M  err=${(r.upfrontErrorPct * 100).toFixed(0)}%`,
  );
}
