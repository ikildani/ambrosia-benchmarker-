/**
 * archiveAfterResponse — for API routes: archive scores after the response is
 * sent (next/server `after`), so archiving never delays or breaks a request.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { archiveScores, type ScoreArchiveEntry } from './index';

/** `entries` may be a thunk so building them never delays or breaks the response. */
export function archiveAfterResponse(
  entries: ScoreArchiveEntry[] | (() => ScoreArchiveEntry[]),
  supabase?: SupabaseClient,
): void {
  const run = async () => {
    try {
      const list = typeof entries === 'function' ? entries() : entries;
      if (list.length === 0) return;
      await archiveScores(supabase ?? createServiceClient(), list);
    } catch (err) {
      console.warn('[ScoreArchive] after-response archive failed:', err instanceof Error ? err.message : err);
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): run now, still fire-and-forget.
    void run();
  }
}
