/**
 * Geography + counterparty-type enrichment: fill licensor/licensee country on real
 * rows whose company is not in the name map, and companies.company_type (incl. academic,
 * government, nonprofit, cro_cdmo) for counterparties that have none.
 *
 * Why (Sep 25 2026): after the name-map pass, 580 real rows still had an
 * unknown country on one side, so "20 countries" on the coverage panel was a
 * classification gap, not a coverage gap. This asks claude-haiku-4-5 for the
 * headquarters country of a company name — ISO-2 or "unknown", with a
 * confidence — and writes only confident answers to companies.hq_country and
 * the deal row. Cheap (a few tokens per name) and bounded per run.
 * Runs as an adapter in the rotating /api/cron/exchanges route.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { FunnelCounter } from './funnel';
import { deriveRegion, classifyCompanyCountry } from './company-geography';
import type { AdapterRunResult } from './exchanges/shared';

const MODEL = 'claude-haiku-4-5';
const ISO2 = /^[A-Z]{2}$/;

export const COMPANY_TYPES = ['large_pharma', 'mid_pharma', 'large_biotech', 'mid_biotech', 'specialty', 'academic', 'government', 'nonprofit', 'cro_cdmo', 'other'] as const;
export type CompanyType = typeof COMPANY_TYPES[number];

export interface GeoAnswer { country: string | null; confidence: number; type: CompanyType | null; typeConfidence: number }

export function parseGeoAnswer(text: string): GeoAnswer {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { country: null, confidence: 0, type: null, typeConfidence: 0 };
  try {
    const j = JSON.parse(m[0]) as { country?: string; confidence?: number; type?: string; type_confidence?: number };
    const c = String(j.country ?? '').trim().toUpperCase();
    const t = String(j.type ?? '').trim().toLowerCase();
    return {
      country: ISO2.test(c) ? c : null, confidence: Number(j.confidence ?? 0),
      type: (COMPANY_TYPES as readonly string[]).includes(t) ? (t as CompanyType) : null, typeConfidence: Number(j.type_confidence ?? 0),
    };
  } catch { return { country: null, confidence: 0, type: null, typeConfidence: 0 }; }
}

export async function classifyWithModel(anthropic: Anthropic, name: string): Promise<GeoAnswer> {
  const res = await anthropic.messages.create({
    model: MODEL, max_tokens: 60,
    system: 'You classify counterparties in biopharma licensing deals. Answer only with JSON.',
    messages: [{ role: 'user', content: `Organisation: "${name}"
Return {"country": <ISO 3166-1 alpha-2 of the headquarters country, or "unknown">, "confidence": <0-100>,
        "type": <one of large_pharma (revenue > $10B), mid_pharma ($1–10B), large_biotech (public, > $1B market cap or revenue), mid_biotech, specialty (generics/OTC/specialty pharma), academic (university, research institute, hospital), government (NIH, HHS, BARDA, ministries, agencies), nonprofit (foundations, PPPs such as CEPI, MPP), cro_cdmo, other, or "unknown">, "type_confidence": <0-100>}.
If the name is ambiguous, a person, or you are not sure, return "unknown" for that field.` }],
  });
  const text = res.content[0]?.type === 'text' ? res.content[0].text : '';
  return parseGeoAnswer(text);
}

export interface GeoRunOptions { anthropicApiKey: string; dryRun?: boolean; timeBudgetMs?: number; maxNames?: number; minConfidence?: number }

export async function runGeoEnrichment(supabase: SupabaseClient, opts: GeoRunOptions): Promise<AdapterRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 60_000;
  const maxNames = opts.maxNames ?? 40;
  const minConfidence = opts.minConfidence ?? 80;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const anthropic = new Anthropic({ apiKey: opts.anthropicApiKey, timeout: 30_000 });

  const { data, error } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, licensor_id, licensee_id, licensor_country, licensee_country, licensor:companies!deals_licensor_id_fkey(company_type), licensee:companies!deals_licensee_id_fkey(company_type)')
    .eq('is_synthetic', false)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(400);
  if (error) errors.push(`queue read failed: ${error.message}`);

  // Distinct names needing a country or a type → the rows they appear on.
  type Row = { id: string; licensor_name: string; licensee_name: string; licensor_id: string | null; licensee_id: string | null; licensor_country: string | null; licensee_country: string | null; licensor?: { company_type: string | null } | { company_type: string | null }[] | null; licensee?: { company_type: string | null } | { company_type: string | null }[] | null };
  const typeOf = (x: Row['licensor']) => (Array.isArray(x) ? x[0]?.company_type : x?.company_type) ?? null;
  const names = new Map<string, Array<{ id: string; side: 'licensor' | 'licensee'; companyId: string | null }>>();
  for (const d of (data ?? []) as unknown as Row[]) {
    const needL = !d.licensor_country || (d.licensor_id && !typeOf(d.licensor));
    const needE = !d.licensee_country || (d.licensee_id && !typeOf(d.licensee));
    if (needL && d.licensor_name) names.set(d.licensor_name, [...(names.get(d.licensor_name) ?? []), { id: d.id, side: 'licensor', companyId: d.licensor_id }]);
    if (needE && d.licensee_name) names.set(d.licensee_name, [...(names.get(d.licensee_name) ?? []), { id: d.id, side: 'licensee', companyId: d.licensee_id }]);
  }

  let asked = 0, resolved = 0, rowsUpdated = 0;
  for (const [name, refs] of names) {
    if (asked >= maxNames) { funnel.count('time_budget', 'names_remaining'); break; }
    if (Date.now() - start > budget) { funnel.count('time_budget', 'names_remaining'); break; }
    funnel.count('fetched');
    // Name map first (free); then the model.
    let country: string | null = null;
    let type: CompanyType | null = null;
    const mapped = classifyCompanyCountry(name);
    if (mapped.country !== 'unknown') country = mapped.country;
    // The model is asked whenever the country is unknown OR the type is (type is never in the name map).
    asked++;
    try {
      const a = await classifyWithModel(anthropic, name);
      if (!country && a.country && a.confidence >= minConfidence) country = a.country;
      if (a.type && a.typeConfidence >= minConfidence) type = a.type;
    } catch (e) { funnel.count('extraction_error', undefined, String(e).slice(0, 120)); errors.push(`${name}: ${String(e).slice(0, 120)}`); }
    if (!country && !type) { funnel.count('confidence_gate', 'unknown', name); continue; }
    resolved++;
    if (dryRun) { funnel.count('dry_run_would_insert', `${country ?? '?'}/${type ?? '?'}`, name); continue; }
    for (const r of refs) {
      if (country) {
        const region = deriveRegion(country);
        const patch = r.side === 'licensor' ? { licensor_country: country, licensor_region: region } : { licensee_country: country, licensee_region: region };
        const { error: ue } = await supabase.from('deals').update(patch).eq('id', r.id);
        if (ue) errors.push(`${r.id}: ${ue.message}`); else rowsUpdated++;
        if (r.companyId) await supabase.from('companies').update({ hq_country: country }).eq('id', r.companyId).is('hq_country', null);
      }
      if (type && r.companyId) await supabase.from('companies').update({ company_type: type }).eq('id', r.companyId).is('company_type', null);
    }
    funnel.count('inserted', `${country ?? '?'}/${type ?? '?'}`, name);
  }
  const summary = funnel.summary();
  console.log(`[geo] names=${names.size} asked=${asked} resolved=${resolved} rows=${rowsUpdated} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { fetched: names.size, candidates: asked, extracted: asked, inserted: rowsUpdated, errors, funnel: funnel.toJSON(), summary, parameters: { resolvedNames: resolved, minConfidence }, expectRecords: names.size > 0 };
}
