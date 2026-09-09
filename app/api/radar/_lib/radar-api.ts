/**
 * Asset Radar — shared route helpers (server-only).
 *
 * Lives under app/api/radar/_lib so it is colocated with the routes that use
 * it without becoming a route itself (Next.js ignores `_`-prefixed folders).
 *
 * Every /api/radar/* route still performs its own `resolveUserTier()` guard
 * inline (mirroring feed/route.ts); this module only holds the pieces that
 * would otherwise be copy-pasted: PostgREST-safe text sanitisation, UUID
 * validation, and the narrative read-through cache.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { fetchNarrativeInputs, generateNarrative } from '@/lib/radar/narrative';

// ── Input validation ──────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `value` is a syntactically valid UUID (any version). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** zod schema for a UUID string — reused by the write routes. */
export const uuidSchema = z.string().regex(UUID_RE, 'Invalid UUID');

const SLUG_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Returns `value` only when it is a plain slug (letters, digits, `_`, `-`),
 * i.e. safe to embed as an `.eq.` operand inside a PostgREST `.or()` string.
 * Use for vocabulary values (therapeutic_area, modality, indication_category).
 */
export function slugOrNull(value: unknown): string | null {
  return typeof value === 'string' && SLUG_RE.test(value) ? value : null;
}

/** ASCII control characters (0x00-0x1F, 0x7F) — dropped from search terms. */
function isControlChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code < 32 || code === 127;
}

/**
 * Strip characters that have meaning inside a PostgREST filter expression
 * (`,` separates clauses in `.or()`, `()` group them, `%` is the LIKE
 * multi-char wildcard, `\` is the LIKE escape char and would 500 if
 * trailing) so free text can be embedded in `.ilike()` / `.or()` without
 * changing the query structure. `_` (single-char wildcard) is kept: it is
 * harmless and common in asset codes. Also strips control characters,
 * collapses whitespace and caps length. Returns '' when nothing usable is left.
 */
export function sanitizeSearchTerm(raw: unknown, maxLength = 100): string {
  if (typeof raw !== 'string') return '';
  return Array.from(raw)
    .map(ch => (isControlChar(ch) || ',()%\\'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

// ── Narrative read-through cache ──────────────────────────────────────────

/** Must match the model string in lib/radar/narrative.ts (not exported there). */
export const NARRATIVE_MODEL = 'claude-opus-4-6';

/** Stable hash of the narrative inputs; fetchNarrativeInputs orders every sub-query so serialisation is deterministic. */
export function hashNarrativeInputs(inputs: unknown): string {
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

export interface NarrativeResult {
  narrative: string;
  cached: boolean;
  inputs: NonNullable<Awaited<ReturnType<typeof fetchNarrativeInputs>>>;
}

/**
 * Returns the cached narrative for the current input snapshot, generating and
 * persisting one only when the inputs have changed since the last call.
 * Cache misses (table missing, RLS, transient errors) degrade to a fresh
 * generation rather than failing the request. Table: radar_asset_narratives
 * (supabase/migrations/101_radar_rls_hardening.sql).
 */
export async function getOrGenerateNarrative(
  supabase: SupabaseClient,
  assetId: string,
): Promise<NarrativeResult | null> {
  const inputs = await fetchNarrativeInputs(supabase, assetId);
  if (!inputs) return null;

  const inputHash = hashNarrativeInputs(inputs);

  try {
    const { data: cached } = await supabase
      .from('radar_asset_narratives')
      .select('narrative')
      .eq('asset_id', assetId)
      .eq('input_hash', inputHash)
      .maybeSingle();

    if (cached?.narrative) {
      return { narrative: cached.narrative as string, cached: true, inputs };
    }
  } catch (err) {
    console.warn('[radar/narrative-cache] read failed:', err instanceof Error ? err.message : String(err));
  }

  const narrative = await generateNarrative(inputs);

  try {
    await supabase
      .from('radar_asset_narratives')
      .upsert(
        { asset_id: assetId, input_hash: inputHash, narrative, model: NARRATIVE_MODEL },
        { onConflict: 'asset_id,input_hash', ignoreDuplicates: true },
      );
  } catch (err) {
    console.warn('[radar/narrative-cache] write failed:', err instanceof Error ? err.message : String(err));
  }

  return { narrative, cached: false, inputs };
}
