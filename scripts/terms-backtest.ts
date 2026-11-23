/**
 * Deal-terms backtest: price real licenses with the live calculator and compare to the upfront paid.
 *
 *   npx tsx scripts/terms-backtest.ts [--out file.json]
 *
 * Reads `deals_verified` (license / collaboration / option, disclosed upfront, announced 2023-01 to 2026-09,
 * global or Greater China rights) with the service-role key, loads the production calibration overlay, runs
 * calculateDealTerms with neutral inputs (the deal's phase, area, modality, territory and deal type; every other
 * factor at its default), and reports calculator / actual upfront by phase, territory and modality.
 * Read-only. Neutral inputs mean absolute ratios carry the default-indication bias; compare runs, not levels.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { calculateDealTerms } from '../lib/calculations';
import { ensureBenchmarksLoaded, staticBenchmarks } from '../lib/benchmarks';

const PHASE: Record<string, string> = {
  discovery: 'discovery', preclinical: 'preclinical', phase_1: 'phase1', phase1: 'phase1', phase_1_2: 'phase1_2', phase1_2: 'phase1_2',
  phase_2: 'phase2', phase2: 'phase2', phase_2_3: 'phase2_3', phase2_3: 'phase2_3', phase_3: 'phase3', phase3: 'phase3',
};
const MODALITY: Record<string, string> = {
  small_molecule: 'smallMolecule', smallMolecule: 'smallMolecule', antibody: 'mab', mab: 'mab', bispecific: 'bispecific', adc: 'adc',
  oligonucleotide: 'oligonucleotide', peptide: 'peptide', gene_therapy: 'geneTherapy', cell_therapy: 'cellTherapy',
  radiopharm: 'radiopharmaceutical', mrna: 'mrna', vaccine: 'therapeuticVaccine',
};
const DEAL_TYPE: Record<string, string> = { license: 'licensing', licensing: 'licensing', collaboration: 'licensing', option: 'option' };
const TA_CATEGORY: Record<string, string> = {
  oncology: 'solidTumor', neurology: 'neurology', immunology: 'immunology', metabolic: 'metabolic', cardiovascular: 'cardiovascular',
  infectiousDisease: 'infectiousDisease', ophthalmology: 'ophthalmology', womensHealth: 'womensHealth', rareDisease: 'rareDisease',
  hematology: 'hematology', dermatology: 'dermatology', gastroenterology: 'gastroenterology',
};

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const r2 = (x: number) => Math.round(x * 100) / 100;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('deals_verified')
    .select('licensor_name, licensee_name, therapeutic_area, modality, phase_at_signing, deal_type, territory, upfront_usd, announced_date')
    .gt('upfront_usd', 0)
    .gte('announced_date', '2023-01-01')
    .lte('announced_date', '2026-09-30')
    .in('deal_type', ['license', 'licensing', 'collaboration', 'option']);
  if (error) throw new Error(error.message);

  await ensureBenchmarksLoaded();
  const rows: Array<Record<string, unknown>> = [];
  for (const d of data ?? []) {
    const phase = PHASE[String(d.phase_at_signing)];
    const modality = MODALITY[String(d.modality)];
    const category = TA_CATEGORY[String(d.therapeutic_area)];
    const terr = String(d.territory ?? '').toLowerCase();
    const territory = terr === 'global' ? 'global' : terr.includes('china') ? 'china' : null;
    if (!phase || !modality || !category || !territory) continue;
    const indication = Object.keys((staticBenchmarks.indications as Record<string, Record<string, unknown>>)[category])[0];
    const r = calculateDealTerms({
      phase, modality, territory, indication, therapeuticArea: d.therapeutic_area, dealType: DEAL_TYPE[String(d.deal_type)] ?? 'licensing',
      biomarker: 'unselected', lineOfTherapy: '2L', dataQuality: 'promising', competitivePosition: 'racing',
      combinationPotential: 'standalone', treatmentApproach: 'symptomatic',
      regulatoryDesignations: { prime: false, orphan: false, fastTrack: false, breakthrough: false },
    } as never);
    const actual = Number(d.upfront_usd) / 1e6;
    rows.push({ deal: `${d.licensor_name} / ${d.licensee_name}`, ta: d.therapeutic_area, phase, modality, territory, actual, calc: r.terms.upfront.median, ratio: r.terms.upfront.median / actual });
  }

  const group = (label: string, pick: (r: Record<string, unknown>) => string) => {
    const by = new Map<string, number[]>();
    for (const r of rows) { const k = pick(r); by.set(k, [...(by.get(k) ?? []), Number(r.ratio)]); }
    console.log(`\n${label}`);
    for (const [k, v] of [...by.entries()].sort()) {
      const within2x = v.filter((x) => x >= 0.5 && x <= 2).length / v.length;
      const mdae = median(v.map((x) => Math.abs(Math.log(x))));
      console.log(`  ${k.padEnd(28)} n=${String(v.length).padStart(3)}  median calc/actual x${r2(median(v))}  within 2x ${Math.round(within2x * 100)}%  MdAE(log) ${r2(mdae)}`);
    }
  };
  group('All', () => 'all');
  group('By territory', (r) => String(r.territory));
  group('By phase (global)', (r) => (r.territory === 'global' ? String(r.phase) : 'z_china'));
  group('By TA (global)', (r) => (r.territory === 'global' ? String(r.ta) : 'z_china'));
  group('By modality (global)', (r) => (r.territory === 'global' ? String(r.modality) : 'z_china'));

  const out = process.argv.indexOf('--out');
  if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify(rows, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
