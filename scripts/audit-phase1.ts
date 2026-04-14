import * as fs from 'fs';

interface BacktestResult {
  case: {
    therapeuticArea: string;
    phase: string;
    dealType: string;
    modality: string;
    actualUpfront_M: number;
    licensee: string;
  };
  predictedUpfront_M: number;
  upfrontErrorPct: number;
}

const raw = JSON.parse(fs.readFileSync('__tests__/backtest/baseline-errors.json', 'utf8')) as {
  results: BacktestResult[];
};

const ph1 = raw.results.filter((r) => r.case.phase === 'phase1');
console.log(`Phase 1 deals: ${ph1.length}\n`);

// Distribution by modality
const byMod: Record<string, BacktestResult[]> = {};
for (const r of ph1) {
  (byMod[r.case.modality] ??= []).push(r);
}
console.log('Phase 1 by modality (top):');
const sortedMod = Object.entries(byMod).sort((a, b) => b[1].length - a[1].length);
for (const [mod, rows] of sortedMod.slice(0, 12)) {
  const n = rows.length;
  if (n < 2) continue;
  const preds = [...rows.map((r) => r.predictedUpfront_M)].sort((a, b) => a - b);
  const acts = [...rows.map((r) => r.case.actualUpfront_M)].sort((a, b) => a - b);
  const errs = [...rows.map((r) => r.upfrontErrorPct)].sort((a, b) => a - b);
  console.log(
    `  ${mod.padEnd(20)} n=${n.toString().padStart(2)}  pred_med=$${preds[Math.floor(n / 2)].toFixed(0).padStart(4)}M  act_med=$${acts[Math.floor(n / 2)].toFixed(0).padStart(4)}M  signed_med=${(errs[Math.floor(n / 2)] * 100).toFixed(0).padStart(4)}%`,
  );
}

console.log('\nPhase 1 deals with >200% error (overshoots):');
const big = ph1.filter((r) => r.upfrontErrorPct > 2.0).sort((a, b) => b.upfrontErrorPct - a.upfrontErrorPct);
for (const r of big.slice(0, 10)) {
  console.log(
    `  ${r.case.therapeuticArea.padEnd(15)} ${r.case.modality.padEnd(15)} actual=$${r.case.actualUpfront_M.toString().padStart(4)}M  pred=$${r.predictedUpfront_M.toFixed(0).padStart(4)}M  err=${(r.upfrontErrorPct * 100).toFixed(0)}%`,
  );
}

// How many deals would the floor ACTUALLY fire on vs just coincidentally be >=100?
console.log(`\nPhase 1 prediction distribution:`);
const buckets = [0, 50, 100, 150, 200, 300, 500, 1000, 10000];
for (let i = 0; i < buckets.length - 1; i++) {
  const n = ph1.filter((r) => r.predictedUpfront_M >= buckets[i] && r.predictedUpfront_M < buckets[i + 1]).length;
  console.log(`  $${buckets[i]}–${buckets[i + 1]}M: ${n}`);
}
