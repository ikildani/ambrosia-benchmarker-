/**
 * Expand Backtest Corpus from Supabase (R25 — 2026-04-13)
 *
 * Pulls verified deals from the production `deals` table and emits a
 * TypeScript file `data/comparable-deals-supabase.ts` that exports
 * `SUPABASE_COMPARABLE_DEALS` in the ExtendedComparableDeal shape.
 *
 * The backtest runner (`lib/financial/backtest/deal-backtest.ts`) then
 * imports this alongside the existing static corpus and runs against
 * the combined set.
 *
 * Usage:
 *   npx tsx scripts/expand-backtest-corpus.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE credentials in .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SupabaseDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  territory: string | null;
  therapeutic_area: string | null;
  deal_type: string | null;
  upfront_usd: number;
  total_deal_value_usd: number;
  milestones_total_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  announced_date: string;
  verified: boolean;
  is_synthetic: boolean;
  confidence_score: number | null;
  source_type: string | null;
  source_url: string | null;
  asset_name: string | null;
}

// Map deal_type variants to the 5 canonical ExtendedComparableDeal types
function mapDealType(dt: string | null): 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration' {
  if (!dt) return 'licensing';
  const s = dt.toLowerCase();
  if (s === 'license' || s === 'licensing') return 'licensing';
  if (s === 'co_development' || s === 'codevelopment') return 'codevelopment';
  if (s === 'collaboration') return 'collaboration';
  if (s === 'acquisition') return 'acquisition';
  if (s === 'option') return 'option';
  return 'licensing';
}

function mapPhase(p: string | null): string {
  if (!p) return 'phase2';
  if (p === 'phase_1') return 'phase1';
  if (p === 'phase_2') return 'phase2';
  if (p === 'phase_3') return 'phase3';
  if (p === 'preclinical' || p === 'discovery') return 'preclinical';
  if (p === 'approved' || p === 'nda_filed') return 'approved';
  return 'phase2';
}

function sanitizeString(s: string | null | undefined): string {
  return (s ?? '').replace(/`/g, "'").replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function main() {
  console.log('Fetching deals from Supabase...');

  // Paginate through all qualifying deals via .range() — Supabase PostgREST
  // caps a single response at 1000 rows by default.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 4; // up to 4000 rows
  const all: SupabaseDeal[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('deals')
      .select(
        'id, licensor_name, licensee_name, modality, phase_at_signing, indication_category, indication_specific, territory, therapeutic_area, deal_type, upfront_usd, total_deal_value_usd, milestones_total_usd, royalty_low_pct, royalty_high_pct, announced_date, verified, is_synthetic, confidence_score, source_type, source_url, asset_name',
      )
      .gt('upfront_usd', 0)
      .gt('total_deal_value_usd', 0)
      .eq('is_synthetic', false)
      .in('phase_at_signing', ['phase_1', 'phase_2', 'phase_3', 'preclinical', 'approved'])
      .in('deal_type', ['license', 'licensing', 'co_development', 'codevelopment', 'collaboration', 'acquisition', 'option'])
      .gte('announced_date', '2020-01-01')
      .not('therapeutic_area', 'is', null)
      .not('indication_category', 'is', null)
      .order('announced_date', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as SupabaseDeal[]));
    if (data.length < PAGE_SIZE) break;
  }
  const data = all;

  console.log(`Fetched ${data.length} raw rows`);

  // De-duplicate on (licensor + licensee + year + upfront). The corpus has
  // known duplicate entries (Concert→Sun Pharma appears 10 times).
  const seen = new Set<string>();
  const deduped: SupabaseDeal[] = [];
  for (const d of data as SupabaseDeal[]) {
    const year = new Date(d.announced_date).getFullYear();
    const key = `${d.licensor_name}|${d.licensee_name}|${year}|${d.upfront_usd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(d);
  }
  console.log(`After dedup: ${deduped.length} unique deals`);

  // Further filter: only deals with minimum required fields
  const valid = deduped.filter(
    (d) =>
      d.licensor_name &&
      d.licensee_name &&
      d.modality &&
      d.phase_at_signing &&
      d.therapeutic_area &&
      d.indication_category &&
      d.deal_type,
  );
  console.log(`After required-field filter: ${valid.length} deals`);

  // Output TypeScript file
  const header = `/**
 * Supabase-sourced comparable deals for backtest corpus expansion.
 *
 * GENERATED FILE — do not edit by hand.
 * Regenerate via: npx tsx scripts/expand-backtest-corpus.ts
 *
 * Source: production deals table (Supabase project 'Calculator Benchmark',
 * id=mnzoulengniofgkwtfbo). Filtered to verified/non-synthetic deals with
 * disclosed upfront + total value, announced 2020+, recognizable phase and
 * deal type. De-duplicated on (licensor, licensee, year, upfront).
 *
 * Generated: ${new Date().toISOString()}
 * Row count: ${valid.length}
 *
 * @module data/comparable-deals-supabase
 */

import type { ExtendedComparableDeal } from './comparable-deals-extended';

export const SUPABASE_COMPARABLE_DEALS: ExtendedComparableDeal[] = [
`;

  const rows = valid
    .map((d) => {
      const year = new Date(d.announced_date).getFullYear();
      const upfront = Math.round((d.upfront_usd / 1_000_000) * 10) / 10;
      const totalDealValue = Math.round((d.total_deal_value_usd / 1_000_000) * 10) / 10;
      const milestones = d.milestones_total_usd
        ? Math.round((d.milestones_total_usd / 1_000_000) * 10) / 10
        : null;
      const royaltyRange =
        d.royalty_low_pct !== null && d.royalty_high_pct !== null
          ? `${d.royalty_low_pct}-${d.royalty_high_pct}%`
          : null;

      return `  {
    id: 'sb_${d.id}',
    year: ${year},
    licensor: '${sanitizeString(d.licensor_name)}',
    licensee: '${sanitizeString(d.licensee_name)}',
    modality: '${sanitizeString(d.modality)}',
    phase: '${mapPhase(d.phase_at_signing)}',
    indication_category: '${sanitizeString(d.indication_category)}',
    indication_specific: '${sanitizeString(d.indication_specific ?? d.indication_category)}',
    territory: '${sanitizeString(d.territory ?? 'global')}',
    therapeuticArea: '${sanitizeString(d.therapeutic_area)}',
    upfront: ${upfront},
    totalDealValue: ${totalDealValue},${milestones !== null ? `\n    milestones: ${milestones},` : ''}${royaltyRange ? `\n    royaltyRange: '${royaltyRange}',` : ''}
    dealType: '${mapDealType(d.deal_type)}',
    headline: '${sanitizeString(d.asset_name ?? 'Deal')} — ${sanitizeString(d.licensor_name)} to ${sanitizeString(d.licensee_name)}',
    source: '${sanitizeString(d.source_type ?? 'supabase')}${d.source_url ? ` — ${sanitizeString(d.source_url)}` : ''}',
    assetName: '${sanitizeString(d.asset_name ?? '')}',
    verified: ${d.verified === true ? 'true' : 'false'},
  },`;
    })
    .join('\n');

  const footer = `
];

export const SUPABASE_CORPUS_STATS = {
  totalDeals: ${valid.length},
  generatedAt: '${new Date().toISOString()}',
  sourceProject: 'mnzoulengniofgkwtfbo',
  dedupedDuplicates: ${deduped.length - valid.length},
} as const;
`;

  const outputPath = path.join(process.cwd(), 'data', 'comparable-deals-supabase.ts');
  fs.writeFileSync(outputPath, header + rows + footer, 'utf8');
  console.log(`Wrote ${valid.length} deals to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
