/**
 * Deal Auto-Verification System
 *
 * Cross-references pending deals against web sources using Perplexity search,
 * then uses Claude to compare the DB record against search results.
 * Marks deals as verified, flagged, or rejected with confidence scores.
 *
 * Cost: ~$0.006 per Perplexity query + ~$0.01 per Claude verification
 * Expected throughput: ~20 deals per cron run
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '../fetch-with-timeout';
import { isTimeBudgetExceeded } from '../cron-utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractAuditExcerpt } from './deal-extraction-validator';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';

// ═══════════════════════════════════════════════════════════════════════
// Source URL helpers — shared by deal-verifier, perplexity-deals and
// historical-backfill so every writer keeps the citation it already gets.
// ═══════════════════════════════════════════════════════════════════════

/** Hosts whose citations are preferred as a deal's source_url. */
export const PREFERRED_SOURCE_HOSTS = [
  'sec.gov',
  'businesswire.com',
  'prnewswire.com',
  'globenewswire.com',
] as const;

const NEWSWIRE_HOSTS = ['businesswire.com', 'prnewswire.com', 'globenewswire.com', 'newswire.ca', 'accesswire.com'];

const COMPANY_SUFFIX_RE = /\b(inc|corp|corporation|ltd|limited|plc|llc|lp|co|company|pharmaceuticals?|pharma|therapeutics?|biosciences?|biotech|biotechnology|sciences?|ag|sa|gmbh|nv|ab|holdings?|group)\b/gi;

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

/**
 * Best-effort domain stem for a company name ("Esperion Therapeutics, Inc."
 * → "esperion"). Returns null when no distinctive token (≥ 4 chars) remains.
 */
export function companyDomainStem(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name.replace(/[.,()]/g, ' ').replace(COMPANY_SUFFIX_RE, ' ');
  const token = cleaned.split(/\s+/).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '')).find(t => t.length >= 4);
  return token || null;
}

/** URLs appearing verbatim in free text (last-resort citation source). */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s)\]>"']+/g) || [];
  return Array.from(new Set(matches.map(m => m.replace(/[.,;:]+$/, ''))));
}

/**
 * Collect citation URLs from a Perplexity response body, whichever API shape
 * it used: Chat Completions (`citations: string[]`, `search_results[].url`)
 * or Responses (`output[].content[].annotations[]` with `url_citation`).
 * Order is preserved; duplicates removed.
 */
export function extractCitationUrls(data: unknown): string[] {
  const urls: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && /^https?:\/\//.test(v)) urls.push(v);
    else if (v && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string') urls.push((v as { url: string }).url);
  };
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.citations)) d.citations.forEach(push);
  if (Array.isArray(d.search_results)) d.search_results.forEach(push);
  if (Array.isArray(d.output)) {
    for (const item of d.output as Array<Record<string, unknown>>) {
      for (const content of (Array.isArray(item?.content) ? item.content : []) as Array<Record<string, unknown>>) {
        for (const ann of (Array.isArray(content?.annotations) ? content.annotations : []) as Array<Record<string, unknown>>) {
          if (ann?.type === 'url_citation') push(ann);
        }
      }
    }
  }
  return Array.from(new Set(urls));
}

export type SourceUrlPath = 'preferred_host' | 'company_domain' | 'first_https';

export interface SelectedSourceUrl {
  url: string;
  host: string;
  path: SourceUrlPath;
}

/**
 * Pick the citation to persist as source_url.
 *
 * Rule: first https URL whose host is sec.gov / businesswire / prnewswire /
 * globenewswire, else first https URL on a host matching the licensor or
 * licensee company-name stem, else (when `allowFirstHttps`, default true)
 * the first https URL. Multi-deal discovery answers pass `false` so an
 * unrelated citation is never attributed to a deal.
 */
export function selectSourceUrl(
  urls: string[],
  parties: { licensor?: string | null; licensee?: string | null },
  options?: { allowFirstHttps?: boolean }
): SelectedSourceUrl | null {
  const allowFirstHttps = options?.allowFirstHttps ?? true;
  const candidates = urls
    .map(url => ({ url, host: hostOf(url) }))
    .filter((c): c is { url: string; host: string } => !!c.host);
  if (candidates.length === 0) return null;

  const preferred = candidates.find(c => PREFERRED_SOURCE_HOSTS.some(h => hostMatches(c.host, h)));
  if (preferred) return { ...preferred, path: 'preferred_host' };

  const stems = [companyDomainStem(parties.licensor), companyDomainStem(parties.licensee)].filter((s): s is string => !!s);
  if (stems.length > 0) {
    const byCompany = candidates.find(c => stems.some(stem => c.host.split('.').some(label => label === stem || label.startsWith(stem))));
    if (byCompany) return { ...byCompany, path: 'company_domain' };
  }

  return allowFirstHttps ? { ...candidates[0], path: 'first_https' } : null;
}

/** True when the URL points at a newswire or a company press-release page. */
export function isPressReleaseUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (NEWSWIRE_HOSTS.some(h => hostMatches(host, h))) return true;
  try {
    return /press[-_]?release|news[-_]?release|\/newsroom\/|\/press\//i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Column patch that fills source_url (and press_release_url / raw_text_excerpt)
 * only where the row currently has null. Never overwrites a non-null URL:
 * returns {} when source_url is already set.
 */
export function buildSourceUrlUpdate(
  existing: { source_url?: string | null; press_release_url?: string | null; raw_text_excerpt?: string | null },
  candidate: { url: string; excerpt?: string | null }
): Record<string, string> {
  if (existing.source_url) return {};
  const patch: Record<string, string> = { source_url: candidate.url };
  if (!existing.press_release_url && isPressReleaseUrl(candidate.url)) patch.press_release_url = candidate.url;
  if (!existing.raw_text_excerpt && candidate.excerpt) patch.raw_text_excerpt = candidate.excerpt.slice(0, 600);
  return patch;
}

/** Append a note to verification_notes without discarding what is there. */
export function appendVerificationNote(existing: string | null | undefined, note: string): string {
  const base = (existing || '').trim();
  return base ? `${base} | ${note}` : note;
}

interface VerificationResult {
  status: 'verified' | 'flagged' | 'rejected';
  confidence: number;
  reason: string;
  corrected_value?: number;
  corrected_date?: string;
}

export async function verifyPendingDeals(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  options?: {
    maxDeals?: number;
    timeBudgetMs?: number;
    priorityTAs?: string[];
    /**
     * After the pending queue, also process up to N already-verified,
     * non-synthetic deals that still lack a source_url. For these the
     * verdict is NOT rewritten — only the corroborating URL (and excerpt)
     * is filled in. Default 0 (off).
     */
    sourceBackfillSlots?: number;
  }
): Promise<{
  verified: number;
  flagged: number;
  unchanged: number;
  sourceUrlsAdded: number;
  errors: string[];
}> {
  const maxDeals = options?.maxDeals ?? 20;
  const timeBudgetMs = options?.timeBudgetMs ?? 250_000;
  const startTime = Date.now();
  const priorityTAs = options?.priorityTAs || [];
  const sourceBackfillSlots = options?.sourceBackfillSlots ?? 0;

  const result = { verified: 0, flagged: 0, unchanged: 0, sourceUrlsAdded: 0, errors: [] as string[] };
  const DEAL_COLUMNS = 'id, licensor_name, licensee_name, asset_name, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, announced_date, indication_category, therapeutic_area, phase_at_signing, territory, source_url, press_release_url, raw_text_excerpt, verification_notes, confidence_score';

  // 1. Query pending deals — prioritize discovery-stage deals (only 9%
  // verified vs 29% for preclinical) then highest value. The two-pass
  // approach ensures early-stage deals get verified without starving
  // high-value deals from the queue.
  const { data: discoveryDeals } = await supabase
    .from('deals')
    .select(DEAL_COLUMNS)
    .eq('verification_status', 'pending')
    .in('phase_at_signing', ['discovery', 'preclinical'])
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(Math.ceil(maxDeals * 0.3));

  const discoveryIds = new Set((discoveryDeals || []).map(d => d.id));

  const { data: remainingDeals, error: queryError } = await supabase
    .from('deals')
    .select(DEAL_COLUMNS)
    .eq('verification_status', 'pending')
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(maxDeals);

  let deals = [
    ...(discoveryDeals || []),
    ...(remainingDeals || []).filter(d => !discoveryIds.has(d.id)),
  ].slice(0, maxDeals);

  // Source-URL backfill pass: already-verified deals with no link. They are
  // appended after the pending queue so they only consume leftover budget,
  // and their verdict is left untouched (URL-only update).
  const sourceBackfillIds = new Set<string>();
  if (sourceBackfillSlots > 0) {
    const { data: noSourceDeals } = await supabase
      .from('deals')
      .select(DEAL_COLUMNS)
      .eq('verification_status', 'verified')
      .is('source_url', null)
      .or('is_synthetic.is.null,is_synthetic.eq.false')
      .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
      .limit(sourceBackfillSlots);
    for (const d of noSourceDeals || []) {
      if (deals.some(existing => existing.id === d.id)) continue;
      sourceBackfillIds.add(d.id);
      deals.push(d);
    }
  }

  // Sort deals so priority TAs (user-demanded) come first
  if (priorityTAs.length > 0) {
    const prioritySet = new Set(priorityTAs);
    deals.sort((a, b) => {
      const aIsPriority = prioritySet.has(a.therapeutic_area) ? 1 : 0;
      const bIsPriority = prioritySet.has(b.therapeutic_area) ? 1 : 0;
      return bIsPriority - aIsPriority; // Priority deals first
    });
  }

  if (queryError) {
    result.errors.push(`Query failed: ${queryError.message}`);
    return result;
  }

  if (!deals || deals.length === 0) {
    return result;
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 60_000 });

  for (const deal of deals) {
    // 3. Check time budget between each deal
    if (isTimeBudgetExceeded(startTime, timeBudgetMs)) {
      console.log('[deal-verifier] Time budget exceeded, stopping');
      break;
    }

    try {
      // 2a. Build Perplexity search query
      const year = deal.announced_date
        ? new Date(deal.announced_date).getFullYear()
        : '';
      const searchQuery = `"${deal.licensor_name}" "${deal.licensee_name}" deal ${year} terms`;

      // 2b. Call Perplexity API
      const response = await fetchWithTimeout(PERPLEXITY_API, {
        timeoutMs: 20_000,
        retries: 1,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preset: 'fast-search',
          input: searchQuery,
        }),
      });

      if (!response.ok) {
        result.errors.push(`Perplexity ${response.status} for ${deal.licensor_name}/${deal.licensee_name}`);
        result.unchanged++;
        continue;
      }

      const data = await response.json();
      const citationUrls = extractCitationUrls(data);
      let perplexityText = '';
      for (const item of data.output || []) {
        if (item.type === 'message') {
          for (const content of item.content || []) {
            if (content.type === 'output_text') {
              perplexityText += content.text + '\n';
            }
          }
        }
      }

      if (perplexityText.length < 50) {
        // Not enough data to verify — leave as pending
        result.unchanged++;
        continue;
      }
      if (citationUrls.length === 0) citationUrls.push(...extractUrlsFromText(perplexityText));

      // 2c. Send to Claude for comparison
      const dealRecord = {
        licensor: deal.licensor_name,
        licensee: deal.licensee_name,
        asset: deal.asset_name,
        deal_type: deal.deal_type,
        upfront_usd: deal.upfront_usd,
        milestones_total_usd: deal.milestones_total_usd,
        total_deal_value_usd: deal.total_deal_value_usd,
        announced_date: deal.announced_date,
        indication: deal.indication_category,
        therapeutic_area: deal.therapeutic_area,
        phase: deal.phase_at_signing,
        territory: deal.territory,
      };

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 600,
        system: 'You verify biopharma deal data. Compare a database record against web search results. Return ONLY valid JSON.',
        messages: [{
          role: 'user',
          content: `Compare this deal record from our database against the web search results.

Database record: ${JSON.stringify(dealRecord)}

Web search results: ${perplexityText.substring(0, 4000)}

Respond with JSON: { "status": "verified" | "flagged" | "rejected", "confidence": number (0-100), "reason": string, "corrected_value": number | null, "corrected_date": string | null }

Rules:
- "verified": The deal exists and key facts (companies, approximate value, date) match.
- "flagged": The deal likely exists but has significant discrepancies (value off by >30%, wrong date, wrong companies).
- "rejected": No evidence this deal exists or it appears fabricated.
- corrected_value: If the total deal value in the DB is wrong, provide the correct value in USD. Otherwise null.
- corrected_date: If the announced date is wrong, provide correct date as YYYY-MM-DD. Otherwise null.`,
        }],
      });

      // 2d. Parse Claude's response
      const textContent = claudeResponse.content[0];
      if (textContent.type !== 'text') {
        result.unchanged++;
        continue;
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        result.unchanged++;
        continue;
      }

      let verification: VerificationResult;
      try {
        verification = JSON.parse(jsonMatch[0]) as VerificationResult;
      } catch {
        result.errors.push(`JSON parse failed for ${deal.licensor_name}/${deal.licensee_name}`);
        result.unchanged++;
        continue;
      }

      // Validate status
      if (!['verified', 'flagged', 'rejected'].includes(verification.status)) {
        result.unchanged++;
        continue;
      }

      // 2e. Keep the corroborating citation when the row has no link yet.
      // Rejected verdicts never supply a URL (nothing corroborated).
      let sourcePatch: Record<string, string> = {};
      let sourceNote: string | null = null;
      if (verification.status !== 'rejected' && !deal.source_url) {
        const selected = selectSourceUrl(citationUrls, {
          licensor: deal.licensor_name,
          licensee: deal.licensee_name,
        });
        if (selected) {
          sourcePatch = buildSourceUrlUpdate(deal, {
            url: selected.url,
            excerpt: extractAuditExcerpt(perplexityText, deal.licensee_name ?? '', 600),
          });
          if (sourcePatch.source_url) {
            sourceNote = `source_url set by deal-verifier from Perplexity citation (${selected.path}: ${selected.host})`;
          }
        }
      }

      const isSourceBackfill = sourceBackfillIds.has(deal.id);
      if (isSourceBackfill) {
        // URL-only pass: never rewrite an existing verdict here.
        if (!sourcePatch.source_url || !sourceNote) {
          result.unchanged++;
          continue;
        }
        await supabase
          .from('deals')
          .update({ ...sourcePatch, verification_notes: appendVerificationNote(deal.verification_notes, sourceNote) })
          .eq('id', deal.id)
          .is('source_url', null); // race guard: never overwrite a URL written meanwhile
        result.sourceUrlsAdded++;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      // 2f-g. Update deal based on status
      const updates: Record<string, unknown> = {
        verification_status: verification.status,
        verification_notes: sourceNote
          ? appendVerificationNote(verification.reason, sourceNote)
          : verification.reason,
        ...sourcePatch,
      };
      if (sourcePatch.source_url) result.sourceUrlsAdded++;

      if (verification.status === 'verified') {
        updates.verified = true;

        // 2h. Apply corrections if verified with corrected values
        if (verification.corrected_value && verification.corrected_value > 0) {
          updates.total_deal_value_usd = verification.corrected_value;
        }
        if (verification.corrected_date && /^\d{4}-\d{2}-\d{2}$/.test(verification.corrected_date)) {
          const today = new Date().toISOString().split('T')[0];
          if (verification.corrected_date <= today && verification.corrected_date >= '2017-01-01') {
            updates.announced_date = verification.corrected_date;
          }
        }

        result.verified++;
      } else if (verification.status === 'flagged') {
        result.flagged++;
      } else {
        // rejected
        result.flagged++; // count in flagged for reporting purposes
      }

      await supabase.from('deals').update(updates).eq('id', deal.id);

      // Rate limit between API calls
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      result.errors.push(`${deal.licensor_name}/${deal.licensee_name}: ${String(err)}`);
      result.unchanged++;
    }
  }

  return result;
}
