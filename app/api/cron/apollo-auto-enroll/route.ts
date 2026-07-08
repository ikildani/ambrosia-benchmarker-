import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Apollo Auto-Enrollment Cron — Mon/Wed/Fri 10 AM UTC
//
// Pulls unenrolled contacts from Apollo (verified email, not in any sequence)
// and adds them to the Generalist outreach sequence:
//   - Tier 1 Generalist: biotech/pharma operators (BD, licensing, C-suite)
//   - Skips VCs, CVCs, PE firms (your strategist handles those directly)
//
// Batches of 100 per run. At 3x/week = ~300 contacts/week enrolled.
// Logs each enrollment batch to apollo_enrollments for attribution tracking.
//
// Auth: Bearer $CRON_SECRET
// Requires: APOLLO_API_KEY env var
// ---------------------------------------------------------------------------

const APOLLO_API = 'https://api.apollo.io/api/v1';
const BATCH_SIZE = 100;

const SEQUENCES = {
  enterprise: '69cb08dcd75dcd0015f0d695',
  generalist: '69cb0eaaf3dce500193f5bbd',
};

const EMAIL_ACCOUNT_ID = '6463c3c776cb9500a330fab4';

// Titles your strategist handles — SKIP these, don't auto-enroll
const ENTERPRISE_SKIP_TITLES = [
  'managing partner', 'general partner', 'operating partner', 'partner',
  'venture partner', 'principal', 'investment director',
  'managing director',
  'portfolio manager', 'fund manager',
];

// Company types your strategist handles — SKIP these
const ENTERPRISE_SKIP_ORG_KEYWORDS = [
  'capital', 'ventures', 'partners', 'advisors', 'investment',
  'holdings', 'fund', 'asset management', 'equity',
  'corporate venture', 'cvc',
];

// Pro/Report targets — biotech/pharma operators who run deals
const PRO_FIT_TITLES = [
  'ceo', 'coo', 'cbo', 'cso', 'cmo', 'chief',
  'president',
  'vp business development', 'vp corporate development', 'vp bd',
  'vp licensing', 'vp partnering', 'vp strategy',
  'svp', 'evp',
  'head of business development', 'head of bd',
  'head of licensing', 'head of partnering', 'head of strategy',
  'head of corporate development', 'head of alliance',
  'director of business development', 'director of licensing',
  'director of partnering', 'director of corporate development',
  'director of alliance', 'director of strategy',
  'business development', 'licensing', 'alliance management',
  'corporate development', 'partnering',
  'sr. director', 'senior director', 'associate director',
  'founder', 'co-founder',
];

function shouldSkipForStrategist(title: string | null, orgName: string | null): boolean {
  const lowerTitle = (title || '').toLowerCase();
  const lowerOrg = (orgName || '').toLowerCase();

  if (ENTERPRISE_SKIP_TITLES.some(t => lowerTitle.includes(t))) return true;
  if (ENTERPRISE_SKIP_ORG_KEYWORDS.some(k => lowerOrg.includes(k))) return true;

  return false;
}

function isProFit(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return PRO_FIT_TITLES.some(t => lower.includes(t));
}

async function apolloFetch(path: string, body: Record<string, unknown>) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('APOLLO_API_KEY not configured');

  const res = await fetch(`${APOLLO_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

async function getUnenrolledContacts(page: number = 1): Promise<{
  contacts: Array<{
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    email_status: string;
    emailer_campaign_ids: string[];
    organization_name: string;
  }>;
  totalPages: number;
}> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('APOLLO_API_KEY not configured');

  // Filter server-side: verified email, sort oldest-first so we reach contacts
  // that haven't been enrolled yet (newest contacts are most likely already in a sequence).
  // Note: Apollo's search API does not support a "currently_in_sequence" filter —
  // we filter out already-enrolled contacts client-side via emailer_campaign_ids.
  const res = await fetch(`${APOLLO_API}/contacts/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      page,
      per_page: 100,
      sort_by_field: 'contact_created_at',
      sort_ascending: true,
      contact_email_status_v2: ['verified', 'likely_to_engage'],
    }),
  });

  if (!res.ok) throw new Error(`Apollo search failed: ${res.status}`);
  const data = await res.json();

  return {
    contacts: data.contacts || [],
    totalPages: data.pagination?.total_pages || 0,
  };
}

async function addToSequence(
  sequenceId: string,
  contactIds: string[],
): Promise<{ added: number; errors: string[] }> {
  if (contactIds.length === 0) return { added: 0, errors: [] };

  try {
    const data = await apolloFetch('/emailer_campaigns/add_contact_ids', {
      id: sequenceId,
      emailer_campaign_id: sequenceId,
      contact_ids: contactIds,
      send_email_from_email_account_id: EMAIL_ACCOUNT_ID,
      sequence_active_in_other_campaigns: false,
      sequence_no_email: false,
      sequence_unverified_email: false,
      sequence_finished_in_other_campaigns: true,
    });

    const addedCount = data.contacts?.length || contactIds.length;
    const apiErrors = data.errors || [];

    // Verify enrollment: if Apollo says 0 contacts added but we sent some, flag it
    if (addedCount === 0 && contactIds.length > 0 && apiErrors.length === 0) {
      apiErrors.push(`Enrollment verification failed: sent ${contactIds.length} contacts but Apollo returned 0 added`);
    }

    return {
      added: addedCount,
      errors: apiErrors,
    };
  } catch (err) {
    return {
      added: 0,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
  }
}

async function sendSlackNotification(message: string, isError = false): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {
    // Non-fatal
  }
}

interface EnrolledContact {
  apollo_contact_id: string;
  email: string;
  email_domain: string;
  name: string;
  title: string | null;
  organization_name: string;
  sequence_id: string;
  sequence_name: string;
}

async function logEnrollments(
  supabase: ReturnType<typeof createServiceClient>,
  contacts: EnrolledContact[],
): Promise<void> {
  if (contacts.length === 0) return;

  try {
    const rows = contacts.map((c) => ({
      apollo_contact_id: c.apollo_contact_id,
      email: c.email,
      email_domain: c.email_domain,
      name: c.name,
      title: c.title,
      organization_name: c.organization_name,
      sequence_id: c.sequence_id,
      sequence_name: c.sequence_name,
      enrolled_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('apollo_enrollments').insert(rows);
    if (error) {
      console.error('[apollo-auto-enroll] Failed to log enrollments:', error.message);
    }
  } catch (err) {
    console.error('[apollo-auto-enroll] Enrollment logging error:', err);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || !authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.APOLLO_API_KEY) {
    return NextResponse.json({ error: 'APOLLO_API_KEY not configured' }, { status: 500 });
  }

  const startTime = Date.now();

  try {
    // Track full contact details for enrollment logging
    const proFitContactDetails: Array<{
      id: string;
      email: string;
      name: string;
      title: string | null;
      organization_name: string;
    }> = [];
    let scanned = 0;
    let skippedNoEmail = 0;
    let skippedAlreadyEnrolled = 0;
    let skippedEnterprise = 0;
    let skippedNoTitleMatch = 0;

    // Resume pagination from where we left off last run.
    // This avoids re-scanning the same oldest contacts every time.
    const supabase = createServiceClient();
    let startPage = 1;
    const { data: pageConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'apollo_enroll_page')
      .single();

    if (pageConfig?.value) {
      const parsed = parseInt(pageConfig.value, 10);
      if (!isNaN(parsed) && parsed > 0) startPage = parsed;
    }

    // Scan contacts -- only enroll Pro/Report-fit biotech operators
    // Skip VCs, CVCs, and enterprise contacts (your strategist handles those)
    let lastPage = startPage;
    let hitEnd = false;
    for (let page = startPage; page < startPage + 10; page++) {
      const { contacts, totalPages } = await getUnenrolledContacts(page);
      if (contacts.length === 0) { hitEnd = true; break; }

      lastPage = page;

      for (const contact of contacts) {
        scanned++;

        if (!contact.email || contact.email_status !== 'verified') {
          skippedNoEmail++;
          continue;
        }

        if (contact.emailer_campaign_ids && contact.emailer_campaign_ids.length > 0) {
          skippedAlreadyEnrolled++;
          continue;
        }

        if (shouldSkipForStrategist(contact.title, contact.organization_name)) {
          skippedEnterprise++;
          continue;
        }

        if (!isProFit(contact.title)) {
          skippedNoTitleMatch++;
          continue;
        }

        proFitContactDetails.push({
          id: contact.id,
          email: contact.email,
          name: contact.name,
          title: contact.title,
          organization_name: contact.organization_name,
        });
        if (proFitContactDetails.length >= BATCH_SIZE) break;
      }

      if (proFitContactDetails.length >= BATCH_SIZE) break;
      if (page >= totalPages) { hitEnd = true; break; }
    }

    // Persist the next page to resume from. Reset to 1 if we hit the end.
    const nextPage = hitEnd ? 1 : lastPage + 1;
    await supabase
      .from('system_config')
      .upsert({ key: 'apollo_enroll_page', value: String(nextPage), updated_at: new Date().toISOString() }, { onConflict: 'key' });

    const proFitContactIds = proFitContactDetails.map((c) => c.id);

    const results = {
      generalist: { added: 0, errors: [] as string[] },
    };

    if (proFitContactIds.length > 0) {
      results.generalist = await addToSequence(SEQUENCES.generalist, proFitContactIds);
    }

    const totalAdded = results.generalist.added;
    const hasErrors = results.generalist.errors.length > 0;
    const duration = Date.now() - startTime;

    // Log enrollment details to apollo_enrollments table for attribution tracking
    if (totalAdded > 0) {
      const enrolledContacts: EnrolledContact[] = proFitContactDetails.slice(0, totalAdded).map((c) => ({
        apollo_contact_id: c.id,
        email: c.email,
        email_domain: c.email.split('@')[1] || '',
        name: c.name,
        title: c.title,
        organization_name: c.organization_name,
        sequence_id: SEQUENCES.generalist,
        sequence_name: 'Tier 1 Generalist',
      }));
      await logEnrollments(supabase, enrolledContacts);
    }

    await logCronRun(supabase, 'apollo-auto-enroll', {
      fetched: scanned,
      processed: proFitContactDetails.length,
      inserted: totalAdded,
      errors: results.generalist.errors,
      parameters: { skippedNoEmail, skippedAlreadyEnrolled, skippedEnterprise, skippedNoTitleMatch, proEnrolled: results.generalist.added },
    });

    // Diagnostic: log sample of skipped contacts for debugging
    console.log(`[apollo-auto-enroll] Scan results: ${scanned} scanned, ${proFitContactDetails.length} fit, ${totalAdded} enrolled`);
    console.log(`[apollo-auto-enroll] Skip breakdown: ${skippedNoEmail} no email, ${skippedAlreadyEnrolled} already enrolled, ${skippedEnterprise} enterprise/VC, ${skippedNoTitleMatch} no title match`);

    // Slack notification -- always send with full diagnostic
    const enrollmentRate = scanned > 0 ? ((proFitContactDetails.length / scanned) * 100).toFixed(1) : '0';
    if (totalAdded > 0) {
      await sendSlackNotification(
        `:rocket: Apollo Auto-Enroll: *${totalAdded}* contacts enrolled into Generalist sequence\n` +
        `Scanned ${scanned} | Fit rate: ${enrollmentRate}%\n` +
        `Skipped: ${skippedEnterprise} enterprise/VC, ${skippedNoTitleMatch} no title match, ${skippedNoEmail} no email, ${skippedAlreadyEnrolled} already in sequence` +
        `${hasErrors ? `\n:warning: Errors: ${results.generalist.errors.join(', ')}` : ''}`,
      );
    } else if (scanned === 0) {
      await sendSlackNotification(
        `:x: Apollo Auto-Enroll: *No contacts returned from Apollo API*. Check APOLLO_API_KEY and account status.`,
        true,
      );
    } else {
      await sendSlackNotification(
        `:warning: Apollo Auto-Enroll: 0 enrolled from ${scanned} scanned\n` +
        `Skip breakdown: ${skippedNoEmail} no email, ${skippedAlreadyEnrolled} already enrolled, ${skippedEnterprise} enterprise/VC (strategist), ${skippedNoTitleMatch} no title match\n` +
        `${proFitContactDetails.length > 0 ? `:x: ${proFitContactDetails.length} contacts were fit but Apollo enrollment API returned 0. Check sequence ${SEQUENCES.generalist} status.` : 'No contacts matched Pro-fit title criteria.'}` +
        `${hasErrors ? `\nErrors: ${results.generalist.errors.join(', ')}` : ''}`,
      );
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'apollo-auto-enroll', {
        processed: scanned,
        inserted: totalAdded,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      scanned,
      enrolled: totalAdded,
      proFit: results.generalist.added,
      skippedEnterprise,
      skippedNoTitleMatch,
      skippedNoEmail,
      skippedAlreadyEnrolled,
      errors: results.generalist.errors,
      durationMs: duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const errorSupabase = createServiceClient();
    await logCronRun(errorSupabase, 'apollo-auto-enroll', { errors: [message] });

    // Alert Slack on hard failure
    await sendSlackNotification(
      `:x: Apollo Auto-Enroll FAILED: ${message}`,
      true,
    );

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
