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

const ENTERPRISE_TITLES = [
  'ceo', 'coo', 'cbo', 'cso', 'cmo', 'chief',
  'president', 'managing director', 'managing partner',
  'vp business development', 'vp corporate development', 'vp bd',
  'svp', 'evp', 'head of business development', 'head of bd',
  'head of licensing', 'head of partnering', 'head of strategy',
  'operating partner', 'general partner', 'partner',
  'director of business development', 'director of licensing',
];

function isEnterpriseTitle(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return ENTERPRISE_TITLES.some(t => lower.includes(t));
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
    const enterpriseContacts: string[] = [];
    const generalistContacts: string[] = [];
    let scanned = 0;
    let skippedNoEmail = 0;
    let skippedAlreadyEnrolled = 0;

    // Scan contacts page by page until we fill both batches
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

        if (enterpriseContacts.length + generalistContacts.length >= BATCH_SIZE) break;

        if (isEnterpriseTitle(contact.title)) {
          enterpriseContacts.push(contact.id);
        } else {
          generalistContacts.push(contact.id);
        }
      }

      if (enterpriseContacts.length + generalistContacts.length >= BATCH_SIZE) break;
      if (page >= totalPages) break;
    }

    const results = {
      enterprise: { added: 0, errors: [] as string[] },
      generalist: { added: 0, errors: [] as string[] },
    };

    if (enterpriseContacts.length > 0) {
      results.enterprise = await addToSequence(SEQUENCES.enterprise, enterpriseContacts);
    }

    if (generalistContacts.length > 0) {
      results.generalist = await addToSequence(SEQUENCES.generalist, generalistContacts);
    }

    const totalAdded = results.enterprise.added + results.generalist.added;
    const duration = Date.now() - startTime;

    const supabase = createServiceClient();
    await logCronRun(supabase, 'apollo-auto-enroll', {
      fetched: scanned,
      processed: enterpriseContacts.length + generalistContacts.length,
      inserted: totalAdded,
      errors: [...results.enterprise.errors, ...results.generalist.errors],
      parameters: { skippedNoEmail, skippedAlreadyEnrolled, enterprise: results.enterprise.added, generalist: results.generalist.added },
    });

    // Slack notification
    if (totalAdded > 0 && process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:rocket: Apollo Auto-Enroll: ${totalAdded} contacts added to sequences (${results.enterprise.added} enterprise, ${results.generalist.added} generalist). Scanned ${scanned}, skipped ${skippedNoEmail} no email, ${skippedAlreadyEnrolled} already enrolled.`,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      scanned,
      enrolled: totalAdded,
      enterprise: results.enterprise.added,
      generalist: results.generalist.added,
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
