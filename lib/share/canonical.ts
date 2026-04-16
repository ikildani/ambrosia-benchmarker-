/**
 * Canonical token resolver — the heart of the share aliasing system.
 *
 * When a share is "superseded" (e.g. Issa accidentally sent the wrong indication
 * link and needs to point it at the corrected analysis), the old token's
 * `canonical_token` column is set to the new token. The share GET endpoint
 * follows this chain (with cycle protection) and serves the canonical content.
 *
 * Any consumer that wants to render share content should:
 *   1. Call resolveCanonicalToken(requestedToken)
 *   2. Use the returned canonical row's content (inputs/results/labels)
 *   3. Optionally show a "this analysis was updated" banner if the requested
 *      token differs from the resolved one
 *
 * Built 2026-04-10 after the Vishaal/Endeavor incident: an obesity GLP-1
 * share link was sent to a Phase 2 IPF prospect by mistake. The wrong link
 * was already in the prospect's inbox; the only fix was to update the row
 * in place. The aliasing system makes this kind of "I sent the wrong link"
 * recovery a single admin operation that automatically routes everyone to
 * the correct analysis no matter which URL they have.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CanonicalShareRow {
  share_token: string;
  canonical_token: string | null;
  user_id: string | null;
  email: string | null;
  inputs: unknown;
  results: unknown;
  labels: Record<string, unknown> | null;
  is_public: boolean;
  expires_at: string | null;
  created_at: string;
  view_count: number | null;
  model_version: string | null;
  superseded_at: string | null;
  superseded_by_email: string | null;
}

export interface ResolveResult {
  /** The row to actually render (the canonical version). */
  canonical: CanonicalShareRow;
  /** The token the user requested. */
  requestedToken: string;
  /** True if requestedToken !== canonical.share_token (i.e., we followed an alias). */
  wasSuperseded: boolean;
  /** The chain of tokens we walked to get here, for debugging. */
  aliasChain: string[];
}

/** Maximum hops to follow in an alias chain. Protects against cycles + DoS. */
const MAX_ALIAS_HOPS = 5;

/**
 * Follow the canonical_token chain starting at `requestedToken` and return the
 * canonical row. If the requested token has no alias, returns it as-is.
 *
 * Returns null if:
 *   - The requested token doesn't exist
 *   - The chain hits a missing/expired/private row
 *   - The chain exceeds MAX_ALIAS_HOPS (probable cycle)
 */
export async function resolveCanonicalToken(
  supabase: SupabaseClient,
  requestedToken: string
): Promise<ResolveResult | null> {
  if (!requestedToken) return null;

  const aliasChain: string[] = [];
  let currentToken = requestedToken;

  for (let hops = 0; hops < MAX_ALIAS_HOPS; hops++) {
    aliasChain.push(currentToken);

    const { data: row, error } = await supabase
      .from('shared_calculations')
      .select('*')
      .eq('share_token', currentToken)
      .eq('is_public', true)
      .single();

    if (error || !row) {
      // Chain broken — token doesn't exist or isn't public
      return null;
    }

    // Check expiration on the visited row
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return null;
    }

    // If this row has no alias, it's canonical — return it
    if (!row.canonical_token) {
      return {
        canonical: row as CanonicalShareRow,
        requestedToken,
        wasSuperseded: aliasChain.length > 1,
        aliasChain,
      };
    }

    // Detect cycles: if we're about to hop to a token already in the chain, abort
    if (aliasChain.includes(row.canonical_token)) {
      console.error(
        `[canonical] Cycle detected in alias chain: ${aliasChain.join(' → ')} → ${row.canonical_token}`
      );
      return null;
    }

    currentToken = row.canonical_token;
  }

  // Exceeded MAX_ALIAS_HOPS without reaching a canonical row
  console.error(
    `[canonical] Alias chain exceeded ${MAX_ALIAS_HOPS} hops starting at ${requestedToken}: ${aliasChain.join(' → ')}`
  );
  return null;
}

/**
 * Mark `oldToken` as an alias for `newToken`. Used by the supersede admin endpoint.
 *
 * Validates that:
 *   - Both tokens exist
 *   - The caller's email owns BOTH tokens (prevents one user from hijacking another's link)
 *   - newToken doesn't already alias somewhere else (prevents accidental chains)
 *   - oldToken !== newToken
 *
 * On success, sets oldToken.canonical_token = newToken, superseded_at = now(),
 * superseded_by_email = callerEmail.
 */
export async function supersedeShare(
  supabase: SupabaseClient,
  oldToken: string,
  newToken: string,
  callerEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (oldToken === newToken) {
    return { success: false, error: 'Cannot supersede a token with itself' };
  }

  // Fetch both rows
  const { data: rows, error: fetchError } = await supabase
    .from('shared_calculations')
    .select('share_token, email, canonical_token')
    .in('share_token', [oldToken, newToken]);

  if (fetchError || !rows || rows.length !== 2) {
    return { success: false, error: 'One or both tokens not found' };
  }

  const oldRow = rows.find((r) => r.share_token === oldToken);
  const newRow = rows.find((r) => r.share_token === newToken);

  if (!oldRow || !newRow) {
    return { success: false, error: 'Token lookup mismatch' };
  }

  // Ownership check — caller must own both
  if (oldRow.email !== callerEmail || newRow.email !== callerEmail) {
    return { success: false, error: 'You do not own both share tokens' };
  }

  // newToken must be canonical itself (not aliased somewhere else)
  if (newRow.canonical_token) {
    return {
      success: false,
      error: `Cannot supersede with ${newToken} — it is itself an alias for ${newRow.canonical_token}. Resolve to canonical first.`,
    };
  }

  // Apply the alias
  const { error: updateError } = await supabase
    .from('shared_calculations')
    .update({
      canonical_token: newToken,
      superseded_at: new Date().toISOString(),
      superseded_by_email: callerEmail,
    })
    .eq('share_token', oldToken);

  if (updateError) {
    return { success: false, error: `Update failed: ${updateError.message}` };
  }

  return { success: true };
}
