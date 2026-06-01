import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Apollo Auto-Enrollment Cron — Twice weekly (Mon & Thu 10 AM UTC)
//
// Pulls unenrolled contacts from Apollo (verified email, not in any sequence)
// and adds them in batches to the two outreach sequences:
//   - Tier 1 Enterprise Contacts (C-suite, VP BD, operating partners)
//   - Tier 1 Generalist (all other biotech/pharma contacts)
//
// Batches of 50 per run to stay within Apollo rate limits and warm the
// sending domain gradually. At 2x/week = ~100 contacts/week enrolled.
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
      sort_ascending: false,
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

    return {
      added: data.contacts?.length || contactIds.length,
      errors: data.errors || [],
    };
  } catch (err) {
    return {
      added: 0,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    };
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
    const proFitContacts: string[] = [];
    let scanned = 0;
    let skippedNoEmail = 0;
    let skippedAlreadyEnrolled = 0;
    let skippedEnterprise = 0;
    let skippedNoTitleMatch = 0;

    // Scan contacts — only enroll Pro/Report-fit biotech operators
    // Skip VCs, CVCs, and enterprise contacts (your strategist handles those)
    for (let page = 1; page <= 10; page++) {
      const { contacts, totalPages } = await getUnenrolledContacts(page);
      if (contacts.length === 0) break;

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

        proFitContacts.push(contact.id);
        if (proFitContacts.length >= BATCH_SIZE) break;
      }

      if (proFitContacts.length >= BATCH_SIZE) break;
      if (page >= totalPages) break;
    }

    const results = {
      generalist: { added: 0, errors: [] as string[] },
    };

    if (proFitContacts.length > 0) {
      results.generalist = await addToSequence(SEQUENCES.generalist, proFitContacts);
    }

    const totalAdded = results.generalist.added;
    const duration = Date.now() - startTime;

    const supabase = createServiceClient();
    await logCronRun(supabase, 'apollo-auto-enroll', {
      fetched: scanned,
      processed: proFitContacts.length,
      inserted: totalAdded,
      errors: results.generalist.errors,
      parameters: { skippedNoEmail, skippedAlreadyEnrolled, skippedEnterprise, skippedNoTitleMatch, proEnrolled: results.generalist.added },
    });

    // Slack notification
    if (totalAdded > 0 && process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:rocket: Apollo Auto-Enroll: ${totalAdded} Pro-fit contacts enrolled into Generalist sequence. Scanned ${scanned}, skipped ${skippedEnterprise} enterprise/VC (strategist), ${skippedNoTitleMatch} no title match, ${skippedNoEmail} no email, ${skippedAlreadyEnrolled} already enrolled.`,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      scanned,
      enrolled: totalAdded,
      proFit: results.generalist.added,
      skippedEnterprise,
      skippedNoTitleMatch,
      skippedNoEmail,
      skippedAlreadyEnrolled,
      durationMs: duration,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const supabase = createServiceClient();
    await logCronRun(supabase, 'apollo-auto-enroll', { errors: [message] });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
