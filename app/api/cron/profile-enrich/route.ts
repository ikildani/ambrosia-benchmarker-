import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { enrichProfile } from '@/lib/enrichment/profile-enrichment';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Profile Enrichment Cron — daily 08:00 UTC
//
// Fills empty identity fields (name, company, company type, title) on up to
// 50 profiles per run, oldest first, using lib/enrichment/profile-enrichment.
// Profiles are retried until name and company are both present, at most once
// per 7 days, so a free-mail signup that Apollo cannot resolve does not burn
// a call every day.
//
// Cron config (vercel.json): "0 8 * * *"
// Auth: Bearer $CRON_SECRET
// ---------------------------------------------------------------------------

const BATCH = 50;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const isValid = token.length === cronSecret.length && timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createServiceClient();
    const retryBefore = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, company_name, company_domain, company_type, job_title, job_function, profile_enriched_at')
      .or('full_name.is.null,company_name.is.null')
      .or(`profile_enriched_at.is.null,profile_enriched_at.lt.${retryBefore}`)
      .order('created_at', { ascending: true })
      .limit(BATCH);
    if (error) throw error;

    const results = { processed: 0, filled: 0, apolloCalls: 0, skipped: 0, errors: 0 };
    for (const p of profiles || []) {
      results.processed += 1;
      try {
        const r = await enrichProfile(supabase, p);
        if (r.apolloUsed) results.apolloCalls += 1;
        if (Object.keys(r.filled).length > 0) results.filled += 1;
        else results.skipped += 1;
      } catch (e) {
        results.errors += 1;
        captureApiError(e, 'profile-enrich-cron');
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    captureApiError(error, 'profile-enrich-cron');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
