/**
 * Geography enrichment: fill licensor/licensee country on real rows whose
 * company is not in the name map or the companies table.
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

export interface GeoAnswer { country: string | null; confidence: number }

export function parseGeoAnswer(text: string): GeoAnswer {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { country: null, confidence: 0 };
  try {
    const j = JSON.parse(m[0]) as { country?: string; confidence?: number };
    const c = String(j.country ?? '').trim().toUpperCase();
    return { country: ISO2.test(c) ? c : null, confidence: Number(j.confidence ?? 0) };
  } catch { return { country: null, confidence: 0 }; }
}

export async function classifyWithModel(anthropic: Anthropic, name: string): Promise<GeoAnswer> {
  const res = await anthropic.messages.create({
    model: MODEL, max_tokens: 60,
    system: 'You identify the headquarters country of biopharma and life-science companies. Answer only with JSON.',
    messages: [{ role: 'user', content: `Company: "${name}"\nReturn {"country": <ISO 3166-1 alpha-2 of the headquarters country, or "unknown">, "confidence": <0-100>}. If the name is ambiguous, a person, a government body, or you are not sure, return "unknown".` }],
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
    .select('id, licensor_name, licensee_name, licensor_id, licensee_id, licensor_country, licensee_country')
    .eq('is_synthetic', false)
    .or('licensor_country.is.null,licensee_country.is.null')
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) errors.push(`queue read failed: ${error.message}`);

  // Distinct unknown names → the rows they appear on.
  const names = new Map<string, Array<{ id: string; side: 'licensor' | 'licensee'; companyId: string | null }>>();
  for (const d of data ?? []) {
    if (!d.licensor_country && d.licensor_name) names.set(d.licensor_name, [...(names.get(d.licensor_name) ?? []), { id: d.id, side: 'licensor', companyId: d.licensor_id }]);
    if (!d.licensee_country && d.licensee_name) names.set(d.licensee_name, [...(names.get(d.licensee_name) ?? []), { id: d.id, side: 'licensee', companyId: d.licensee_id }]);
  }

  let asked = 0, resolved = 0, rowsUpdated = 0;
  for (const [name, refs] of names) {
    if (asked >= maxNames) { funnel.count('time_budget', 'names_remaining'); break; }
    if (Date.now() - start > budget) { funnel.count('time_budget', 'names_remaining'); break; }
    funnel.count('fetched');
    // Name map first (free); then the model.
    let country: string | null = null;
    const mapped = classifyCompanyCountry(name);
    if (mapped.country !== 'unknown') country = mapped.country;
    else {
      asked++;
      try {
        const a = await classifyWithModel(anthropic, name);
        if (a.country && a.confidence >= minConfidence) country = a.country;
        else { funnel.count('confidence_gate', a.country ? 'low_confidence' : 'unknown', name); continue; }
      } catch (e) { funnel.count('extraction_error', undefined, String(e).slice(0, 120)); errors.push(`${name}: ${String(e).slice(0, 120)}`); continue; }
    }
    resolved++;
    const region = deriveRegion(country);
    if (dryRun) { funnel.count('dry_run_would_insert', country, name); continue; }
    for (const r of refs) {
      const patch = r.side === 'licensor' ? { licensor_country: country, licensor_region: region } : { licensee_country: country, licensee_region: region };
      const { error: ue } = await supabase.from('deals').update(patch).eq('id', r.id);
      if (ue) errors.push(`${r.id}: ${ue.message}`); else rowsUpdated++;
      if (r.companyId) await supabase.from('companies').update({ hq_country: country }).eq('id', r.companyId).is('hq_country', null);
    }
    funnel.count('inserted', country, name);
  }
  const summary = funnel.summary();
  console.log(`[geo] names=${names.size} asked=${asked} resolved=${resolved} rows=${rowsUpdated} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { fetched: names.size, candidates: asked, extracted: asked, inserted: rowsUpdated, errors, funnel: funnel.toJSON(), summary, parameters: { resolvedNames: resolved, minConfidence }, expectRecords: names.size > 0 };
}
