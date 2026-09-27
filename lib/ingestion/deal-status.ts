/**
 * Deal status pass: is a deal we cite as precedent still alive? Terminated,
 * expired and returned deals are excluded from the comparable set, but only
 * two rows carried a status when this was written, so nothing was excluded.
 *
 * Candidates, in order: comparables used in briefs built in the last 90 days
 * (their ids live in benchmark_requests.brief_json), then quality rows never
 * checked, oldest announcements first. Each is searched (Perplexity) and
 * adjudicated (Opus, JSON only). Only a confident non-'unknown' verdict
 * writes deal_status; every check stamps deal_status_checked_at so the queue
 * moves. Rides inside the deal-verification cron on a weekly window.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../fetch-with-timeout';
import { isTimeBudgetExceeded } from '../cron-utils';
import { appendVerificationNote, extractCitationUrls, searchableAssetName } from './deal-verifier';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';
export const RECHECK_AFTER_DAYS = 180;

export type DealStatusVerdict = 'active' | 'terminated' | 'expired' | 'completed' | 'unknown';

interface StatusRow {
  id: string; licensor_name: string | null; licensee_name: string | null; asset_name: string | null;
  announced_date: string | null; deal_status: string | null; verification_notes: string | null; deal_type: string | null;
}

export interface DealStatusResult {
  checked: number;
  updated: number;
  byStatus: Record<string, number>;
  errors: string[];
}

/** Ids of comparables cited in briefs built in the last `days` days. */
export async function recentBriefCompIds(supabase: SupabaseClient, days = 90): Promise<string[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase.from('benchmark_requests').select('brief_json').gte('generation_completed_at', since).not('brief_json', 'is', null).limit(200);
  const ids = new Set<string>();
  for (const r of (data ?? []) as Array<{ brief_json: { compSet?: { rows?: Array<{ id: string }> } } | null }>) {
    for (const row of r.brief_json?.compSet?.rows ?? []) if (row?.id) ids.add(row.id);
  }
  return [...ids];
}

export function parseVerdict(text: string): { status: DealStatusVerdict; confidence: number; reason: string; date: string | null } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as { status?: string; confidence?: number; reason?: string; date?: string | null };
    const status = (['active', 'terminated', 'expired', 'completed', 'unknown'].includes(String(j.status)) ? j.status : 'unknown') as DealStatusVerdict;
    return { status, confidence: Number(j.confidence ?? 0) || 0, reason: String(j.reason ?? '').slice(0, 300), date: j.date && /^\d{4}(-\d{2})?(-\d{2})?$/.test(String(j.date)) ? String(j.date) : null };
  } catch { return null; }
}

export async function checkDealStatuses(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  opts: { maxDeals?: number; timeBudgetMs?: number; ids?: string[] } = {},
): Promise<DealStatusResult> {
  const maxDeals = opts.maxDeals ?? 30;
  const timeBudgetMs = opts.timeBudgetMs ?? 120_000;
  const start = Date.now();
  const result: DealStatusResult = { checked: 0, updated: 0, byStatus: {}, errors: [] };
  const COLS = 'id, licensor_name, licensee_name, asset_name, announced_date, deal_status, verification_notes, deal_type';
  const recheckBefore = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000).toISOString();

  // 1. Candidates: brief comps first, then the never-checked quality pool.
  const rows: StatusRow[] = [];
  const briefIds = opts.ids ?? await recentBriefCompIds(supabase);
  if (briefIds.length) {
    const { data } = await supabase.from('deals').select(COLS).in('id', briefIds.slice(0, 200))
      .or(`deal_status_checked_at.is.null,deal_status_checked_at.lt.${recheckBefore}`).limit(maxDeals);
    rows.push(...((data ?? []) as StatusRow[]));
  }
  if (rows.length < maxDeals) {
    const { data } = await supabase.from('deals').select(COLS)
      .is('deal_status_checked_at', null)
      .eq('is_synthetic', false).not('is_canonical', 'is', false)
      .eq('verification_status', 'verified')
      .gt('total_deal_value_usd', 0)
      .order('announced_date', { ascending: true, nullsFirst: false })
      .limit(maxDeals - rows.length);
    const seen = new Set(rows.map(r => r.id));
    rows.push(...((data ?? []) as StatusRow[]).filter(r => !seen.has(r.id)));
  }
  if (!rows.length) return result;

  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 60_000 });
  for (const deal of rows) {
    if (isTimeBudgetExceeded(start, timeBudgetMs)) break;
    const stamp = new Date().toISOString();
    try {
      const year = deal.announced_date ? new Date(deal.announced_date).getUTCFullYear() : '';
      const assetTerm = searchableAssetName(deal.asset_name);
      const query = `"${deal.licensor_name}" "${deal.licensee_name}" ${assetTerm ? `"${assetTerm}" ` : ''}${year} agreement terminated OR ended OR returned rights OR expired OR "mutually agreed" OR discontinued`;
      const response = await fetchWithTimeout(PERPLEXITY_API, {
        timeoutMs: 20_000, retries: 1, method: 'POST',
        headers: { Authorization: `Bearer ${perplexityApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'fast-search', input: query }),
      });
      if (!response.ok) { result.errors.push(`Perplexity ${response.status} for ${deal.id}`); await supabase.from('deals').update({ deal_status_checked_at: stamp }).eq('id', deal.id); result.checked++; continue; }
      const data = await response.json();
      let text = '';
      for (const item of (data.output ?? []) as Array<{ type: string; content?: Array<{ type: string; text: string }> }>) {
        if (item.type === 'message') for (const c of item.content ?? []) if (c.type === 'output_text') text += c.text + '\n';
      }
      const citations = extractCitationUrls(data);

      const claude = await anthropic.messages.create({
        model: 'claude-opus-4-6', max_tokens: 300,
        system: 'You determine whether a biopharma deal is still in force. Return ONLY valid JSON.',
        messages: [{ role: 'user', content: `Deal: ${deal.licensor_name} → ${deal.licensee_name}${deal.asset_name ? `, ${deal.asset_name}` : ''}${deal.announced_date ? `, announced ${deal.announced_date}` : ''}${deal.deal_type ? ` (${deal.deal_type})` : ''}.

Web search results:
${text.slice(0, 3500)}

Respond with JSON: { "status": "active" | "terminated" | "expired" | "completed" | "unknown", "confidence": number (0-100), "date": "YYYY-MM" | null, "reason": string }
Rules:
- "terminated": a party ended the agreement, rights were returned, the program was discontinued under the deal, or the collaboration was wound down before its term.
- "expired": the option or research term lapsed without exercise or extension.
- "completed": an acquisition closed, or the deal ran its full term.
- "active": the search shows the deal continuing (milestones paid, programs advancing) with no end reported.
- "unknown": the results say nothing either way. Never guess.
- date: when the status changed, if reported.` }],
      });
      const tc = claude.content[0];
      const verdict = tc.type === 'text' ? parseVerdict(tc.text) : null;
      result.checked++;
      const patch: Record<string, unknown> = { deal_status_checked_at: stamp };
      if (verdict && verdict.status !== 'unknown' && verdict.confidence >= 70) {
        patch.deal_status = verdict.status;
        patch.verification_notes = appendVerificationNote(deal.verification_notes, `status ${verdict.status}${verdict.date ? ` (${verdict.date})` : ''}, ${verdict.confidence}%: ${verdict.reason}${citations[0] ? ` [${citations[0]}]` : ''}`);
        if (deal.deal_status !== verdict.status) result.updated++;
        result.byStatus[verdict.status] = (result.byStatus[verdict.status] ?? 0) + 1;
      } else {
        result.byStatus.unknown = (result.byStatus.unknown ?? 0) + 1;
      }
      await supabase.from('deals').update(patch).eq('id', deal.id);
    } catch (e) {
      result.errors.push(`${deal.id}: ${e instanceof Error ? e.message : String(e)}`);
      await supabase.from('deals').update({ deal_status_checked_at: stamp }).eq('id', deal.id);
    }
  }
  return result;
}
