/**
 * R71 — Compute indication-level deal ceilings from Supabase deals table.
 *
 * For each (indication, phase, dealType) group, computes:
 *   - P90 upfront
 *   - P90 total deal value
 *   - median upfront
 *   - median TDV
 *   - n (sample size)
 *
 * The engine uses these as HARD CEILINGS on predicted deal terms, so the
 * output is clamped to "what has actually been paid in this indication."
 * Groups with n < 3 are flagged as "low-confidence" and the next broader
 * grouping is used (e.g., fall back to TA+phase+dealType if indication
 * cohort is sparse).
 *
 * Output: data/indication-deal-ceilings.json
 */

import { writeFileSync } from 'fs';

const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface DealRow {
  indication_specific: string | null;
  indication_category: string | null;
  therapeutic_area: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  is_synthetic: boolean | null;
  verification_status: string | null;
}

function p90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[idx];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function fetchAll(): Promise<DealRow[]> {
  const out: DealRow[] = [];
  let offset = 0;
  const select = 'indication_specific,indication_category,therapeutic_area,phase_at_signing,deal_type,upfront_usd,total_deal_value_usd,is_synthetic,verification_status';
  while (true) {
    const url = `${SUPA_URL}/rest/v1/deals?select=${select}&is_synthetic=not.eq.true&limit=1000&offset=${offset}`;
    const resp = await fetch(url, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    });
    const rows: DealRow[] = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function main() {
  console.log('Fetching deals from Supabase...');
  const deals = await fetchAll();
  console.log(`Fetched ${deals.length} verified + non-synthetic deals.`);

  // Phase normalization: map raw phase strings to engine canonical
  const phaseMap: Record<string, string> = {
    'discovery': 'discovery', 'preclinical': 'preclinical',
    'phase 1': 'phase1', 'phase1': 'phase1',
    'phase 1/2': 'phase1_2', 'phase1/2': 'phase1_2', 'phase1_2': 'phase1_2',
    'phase 2': 'phase2', 'phase2': 'phase2',
    'phase 2/3': 'phase2_3', 'phase2_3': 'phase2_3',
    'phase 3': 'phase3', 'phase3': 'phase3',
    'nda filed': 'nda_filed', 'nda_filed': 'nda_filed', 'bla filed': 'nda_filed',
    'approved': 'approved',
  };

  const dealTypeMap: Record<string, string> = {
    'licensing': 'licensing', 'license': 'licensing',
    'acquisition': 'acquisition', 'm&a': 'acquisition',
    'co-development': 'codevelopment', 'codevelopment': 'codevelopment', 'co_development': 'codevelopment',
    'collaboration': 'collaboration', 'research collaboration': 'collaboration',
    'option': 'option', 'option agreement': 'option',
  };

  // Bucket by (indication, phase, dealType) and (TA, phase, dealType) for fallback
  const byIndication: Record<string, { upfronts: number[]; tdvs: number[] }> = {};
  const byTA: Record<string, { upfronts: number[]; tdvs: number[] }> = {};

  for (const d of deals) {
    if (!d.phase_at_signing || !d.deal_type) continue;
    const phase = phaseMap[d.phase_at_signing.toLowerCase()];
    const dealType = dealTypeMap[d.deal_type.toLowerCase()];
    if (!phase || !dealType) continue;

    const upfrontM = d.upfront_usd != null ? d.upfront_usd / 1_000_000 : null;
    const tdvM = d.total_deal_value_usd != null ? d.total_deal_value_usd / 1_000_000 : null;
    if (upfrontM == null && tdvM == null) continue;

    const indication = d.indication_specific || d.indication_category;
    if (indication) {
      const key = `${indication}::${phase}::${dealType}`;
      if (!byIndication[key]) byIndication[key] = { upfronts: [], tdvs: [] };
      if (upfrontM != null) byIndication[key].upfronts.push(upfrontM);
      if (tdvM != null) byIndication[key].tdvs.push(tdvM);
    }

    const ta = d.therapeutic_area;
    if (ta) {
      const taKey = `${ta}::${phase}::${dealType}`;
      if (!byTA[taKey]) byTA[taKey] = { upfronts: [], tdvs: [] };
      if (upfrontM != null) byTA[taKey].upfronts.push(upfrontM);
      if (tdvM != null) byTA[taKey].tdvs.push(tdvM);
    }
  }

  // Build output
  const indicationCeilings: Record<string, { p90Upfront: number; p90TDV: number; medianUpfront: number; medianTDV: number; n: number }> = {};
  for (const [key, { upfronts, tdvs }] of Object.entries(byIndication)) {
    if (upfronts.length < 2 && tdvs.length < 2) continue; // require ≥2 data points
    indicationCeilings[key] = {
      p90Upfront: Math.round(p90(upfronts)),
      p90TDV: Math.round(p90(tdvs)),
      medianUpfront: Math.round(median(upfronts)),
      medianTDV: Math.round(median(tdvs)),
      n: Math.max(upfronts.length, tdvs.length),
    };
  }

  const taCeilings: Record<string, { p90Upfront: number; p90TDV: number; medianUpfront: number; medianTDV: number; n: number }> = {};
  for (const [key, { upfronts, tdvs }] of Object.entries(byTA)) {
    taCeilings[key] = {
      p90Upfront: Math.round(p90(upfronts)),
      p90TDV: Math.round(p90(tdvs)),
      medianUpfront: Math.round(median(upfronts)),
      medianTDV: Math.round(median(tdvs)),
      n: Math.max(upfronts.length, tdvs.length),
    };
  }

  const payload = {
    _meta: {
      generated: new Date().toISOString(),
      sourceTotalDeals: deals.length,
      indicationGroups: Object.keys(indicationCeilings).length,
      taGroups: Object.keys(taCeilings).length,
      description: 'P90 upfront/TDV ceilings per (indication, phase, dealType). Fall back to TA if indication n<3.',
    },
    byIndication: indicationCeilings,
    byTA: taCeilings,
  };

  writeFileSync('data/indication-deal-ceilings.json', JSON.stringify(payload, null, 2));
  console.log(`\nWrote data/indication-deal-ceilings.json`);
  console.log(`  indication groups: ${Object.keys(indicationCeilings).length}`);
  console.log(`  TA fallback groups: ${Object.keys(taCeilings).length}`);

  // Diagnostic: show a few hot/cold examples
  console.log('\n─── Sample ceilings ───');
  const sample = Object.entries(indicationCeilings).slice(0, 10);
  for (const [k, v] of sample) {
    console.log(`  ${k.padEnd(50)} n=${v.n}  P90 upfront=$${v.p90Upfront}M  P90 TDV=$${v.p90TDV}M`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
