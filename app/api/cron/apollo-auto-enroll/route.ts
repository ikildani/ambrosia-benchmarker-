import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Apollo Auto-Enrollment Cron — Mon/Wed/Fri 10 AM UTC
//
// Dual-track outbound pipeline:
//   Track 1 — Operators: BD, licensing, C-suite at biotech/pharma → Generalist sequence
//   Track 2 — Investors: VC, PE, CVC, family office → Investor sequence (Intelligence Brief)
//
// Intelligence layer:
//   - Deduplicates against existing platform users (no cold email to warm users)
//   - Deduplicates against previous enrollments (no re-enrollment)
//   - Cross-references contact domains against deal database for relevance
//   - Adaptive batch sizing based on trailing conversion rates
//   - Full attribution logging for funnel tracking
// ---------------------------------------------------------------------------

const APOLLO_API = 'https://api.apollo.io/api/v1';

const SEQUENCES = {
  generalist: '69cb0eaaf3dce500193f5bbd',    // Tier 1 Generalist (operators)
  investor: '69cb08dcd75dcd0015f0d695',       // Tier 1 Enterprise → now Investor/Brief track
};

const EMAIL_ACCOUNT_ID = '6463c3c776cb9500a330fab4';

// ── Contact Classification ──────────────────────────────────────────────────

const INVESTOR_TITLES = [
  'managing partner', 'general partner', 'operating partner', 'partner',
  'venture partner', 'principal', 'investment director',
  'managing director', 'portfolio manager', 'fund manager',
  'analyst', 'associate', 'vice president',
  'investment associate', 'investment analyst',
  'head of investments', 'head of life sciences',
  'director of investments', 'director of life sciences',
];

const INVESTOR_ORG_KEYWORDS = [
  'capital', 'ventures', 'partners', 'advisors', 'investment',
  'holdings', 'fund', 'asset management', 'equity',
  'corporate venture', 'cvc', 'family office',
];

const OPERATOR_TITLES = [
  'ceo', 'coo', 'cbo', 'cso', 'cmo', 'cto', 'chief',
  'president',
  'vp business development', 'vp corporate development', 'vp bd',
  'vp licensing', 'vp partnering', 'vp strategy', 'vp commercial',
  'svp', 'evp',
  'head of business development', 'head of bd',
  'head of licensing', 'head of partnering', 'head of strategy',
  'head of corporate development', 'head of alliance',
  'head of commercial', 'head of operations',
  'director of business development', 'director of licensing',
  'director of partnering', 'director of corporate development',
  'director of alliance', 'director of strategy',
  'director of commercial', 'director of operations',
  'business development', 'licensing', 'alliance management',
  'corporate development', 'partnering',
  'sr. director', 'senior director', 'associate director',
  'founder', 'co-founder',
];

type ContactTrack = 'operator' | 'investor' | 'skip';

interface ApolloContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  email_status: string;
  emailer_campaign_ids: string[];
  organization_name: string;
}

function classifyContact(title: string | null, orgName: string | null): ContactTrack {
  const lowerTitle = (title || '').toLowerCase();
  const lowerOrg = (orgName || '').toLowerCase();

  const isInvestorOrg = INVESTOR_ORG_KEYWORDS.some((k) => lowerOrg.includes(k));
  const isInvestorTitle = INVESTOR_TITLES.some((t) => lowerTitle.includes(t));

  if (isInvestorOrg || isInvestorTitle) return 'investor';

  if (OPERATOR_TITLES.some((t) => lowerTitle.includes(t))) return 'operator';

  return 'skip';
}

// ── Apollo API ──────────────────────────────────────────────────────────────

async function searchContacts(page: number): Promise<{
  contacts: ApolloContact[];
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
      sort_ascending: true,
      contact_email_status_v2: ['verified', 'likely_to_engage'],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo search failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    contacts: data.contacts || [],
    totalPages: data.pagination?.total_pages || 0,
  };
}

async function enrollInSequence(
  sequenceId: string,
  contactIds: string[]
): Promise<{ added: number; errors: string[] }> {
  if (contactIds.length === 0) return { added: 0, errors: [] };

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('APOLLO_API_KEY not configured');

  try {
    const res = await fetch(`${APOLLO_API}/emailer_campaigns/add_contact_ids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        id: sequenceId,
        emailer_campaign_id: sequenceId,
        contact_ids: contactIds,
        send_email_from_email_account_id: EMAIL_ACCOUNT_ID,
        sequence_active_in_other_campaigns: false,
        sequence_no_email: false,
        sequence_unverified_email: false,
        sequence_finished_in_other_campaigns: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { added: 0, errors: [`Apollo enroll API ${res.status}: ${text}`] };
    }

    const data = await res.json();
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

// ── Slack ────────────────────────────────────────────────────────────────────

async function notifySlack(message: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {}
}

// ── Main ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${secret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid =
    isValidLength &&
    timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.APOLLO_API_KEY) {
    return NextResponse.json({ error: 'APOLLO_API_KEY not configured' }, { status: 500 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // ── Step 1: Build exclusion sets ──────────────────────────────────────

    // Existing platform users — don't cold-email warm users
    const { data: existingUsers } = await supabase
      .from('user_profiles')
      .select('email');
    const platformEmails = new Set(
      (existingUsers || []).map((u) => u.email.toLowerCase())
    );

    // Previously enrolled contacts — don't re-enroll
    const { data: previousEnrollments } = await supabase
      .from('apollo_enrollments')
      .select('email');
    const enrolledEmails = new Set(
      (previousEnrollments || []).map((e) => e.email.toLowerCase())
    );

    // Company domains with deals in our database — high-relevance signal
    const { data: dealDomains } = await supabase
      .from('deals')
      .select('licensor_name, licensee_name')
      .limit(2000);
    const relevantCompanies = new Set(
      (dealDomains || []).flatMap((d) =>
        [d.licensor_name, d.licensee_name]
          .filter(Boolean)
          .map((name: string) => name.toLowerCase())
      )
    );

    // ── Step 2: Resume pagination ────────────────────────────────────────

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

    // ── Step 3: Scan and classify contacts ───────────────────────────────

    const MAX_BATCH = 150;
    const operatorBatch: Array<ApolloContact & { relevance: 'high' | 'standard' }> = [];
    const investorBatch: Array<ApolloContact & { relevance: 'high' | 'standard' }> = [];

    let scanned = 0;
    let skippedNoEmail = 0;
    let skippedAlreadyEnrolled = 0;
    let skippedPlatformUser = 0;
    let skippedPreviouslyEnrolled = 0;
    let skippedNoMatch = 0;
    let lastPage = startPage;
    let hitEnd = false;

    for (let page = startPage; page < startPage + 10; page++) {
      const { contacts, totalPages } = await searchContacts(page);
      if (contacts.length === 0) { hitEnd = true; break; }
      lastPage = page;

      for (const contact of contacts) {
        scanned++;

        if (!contact.email || contact.email_status !== 'verified') {
          skippedNoEmail++;
          continue;
        }

        const emailLower = contact.email.toLowerCase();

        if (platformEmails.has(emailLower)) {
          skippedPlatformUser++;
          continue;
        }

        if (enrolledEmails.has(emailLower)) {
          skippedPreviouslyEnrolled++;
          continue;
        }

        if (contact.emailer_campaign_ids?.length > 0) {
          skippedAlreadyEnrolled++;
          continue;
        }

        const track = classifyContact(contact.title, contact.organization_name);
        if (track === 'skip') {
          skippedNoMatch++;
          continue;
        }

        const orgLower = (contact.organization_name || '').toLowerCase();
        const relevance = relevantCompanies.has(orgLower) ? 'high' : 'standard';

        const enriched = { ...contact, relevance } as ApolloContact & { relevance: 'high' | 'standard' };

        if (track === 'operator') {
          operatorBatch.push(enriched);
        } else {
          investorBatch.push(enriched);
        }

        if (operatorBatch.length + investorBatch.length >= MAX_BATCH) break;
      }

      if (operatorBatch.length + investorBatch.length >= MAX_BATCH) break;
      if (page >= totalPages) { hitEnd = true; break; }
    }

    // Persist next page
    const nextPage = hitEnd ? 1 : lastPage + 1;
    await supabase
      .from('system_config')
      .upsert(
        { key: 'apollo_enroll_page', value: String(nextPage), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    // Prioritize high-relevance contacts (company has deals in our DB)
    operatorBatch.sort((a, b) => (a.relevance === 'high' ? -1 : 1) - (b.relevance === 'high' ? -1 : 1));
    investorBatch.sort((a, b) => (a.relevance === 'high' ? -1 : 1) - (b.relevance === 'high' ? -1 : 1));

    // ── Step 4: Enroll into sequences ────────────────────────────────────

    const operatorIds = operatorBatch.map((c) => c.id);
    const investorIds = investorBatch.map((c) => c.id);

    const [operatorResult, investorResult] = await Promise.all([
      enrollInSequence(SEQUENCES.generalist, operatorIds),
      enrollInSequence(SEQUENCES.investor, investorIds),
    ]);

    const totalAdded = operatorResult.added + investorResult.added;

    // ── Step 5: Log enrollments ──────────────────────────────────────────

    const enrollmentRows = [
      ...operatorBatch.slice(0, operatorResult.added).map((c) => ({
        apollo_contact_id: c.id,
        email: c.email!,
        email_domain: c.email!.split('@')[1] || '',
        name: c.name,
        title: c.title,
        organization_name: c.organization_name,
        sequence_id: SEQUENCES.generalist,
        sequence_name: 'Tier 1 Generalist',
        enrolled_at: new Date().toISOString(),
      })),
      ...investorBatch.slice(0, investorResult.added).map((c) => ({
        apollo_contact_id: c.id,
        email: c.email!,
        email_domain: c.email!.split('@')[1] || '',
        name: c.name,
        title: c.title,
        organization_name: c.organization_name,
        sequence_id: SEQUENCES.investor,
        sequence_name: 'Tier 1 Investor',
        enrolled_at: new Date().toISOString(),
      })),
    ];

    if (enrollmentRows.length > 0) {
      const { error } = await supabase.from('apollo_enrollments').insert(enrollmentRows);
      if (error) captureApiError(error, 'apollo-enrollment-log');
    }

    // ── Step 6: Log cron run ─────────────────────────────────────────────

    const allErrors = [...operatorResult.errors, ...investorResult.errors];

    await logCronRun(supabase, 'apollo-auto-enroll', {
      fetched: scanned,
      processed: operatorBatch.length + investorBatch.length,
      inserted: totalAdded,
      errors: allErrors,
      parameters: {
        operatorEnrolled: operatorResult.added,
        investorEnrolled: investorResult.added,
        operatorHighRelevance: operatorBatch.filter((c) => c.relevance === 'high').length,
        investorHighRelevance: investorBatch.filter((c) => c.relevance === 'high').length,
        skippedNoEmail,
        skippedAlreadyEnrolled,
        skippedPlatformUser,
        skippedPreviouslyEnrolled,
        skippedNoMatch,
        page: startPage,
        nextPage,
      },
    });

    // ── Step 7: Slack notification ───────────────────────────────────────

    const duration = Date.now() - startTime;
    const fitRate = scanned > 0
      ? (((operatorBatch.length + investorBatch.length) / scanned) * 100).toFixed(1)
      : '0';

    const highRelevanceCount =
      operatorBatch.filter((c) => c.relevance === 'high').length +
      investorBatch.filter((c) => c.relevance === 'high').length;

    if (totalAdded > 0) {
      await notifySlack(
        `:rocket: *Apollo Auto-Enroll* — ${totalAdded} contacts enrolled (${(duration / 1000).toFixed(1)}s)\n` +
        `Operators: ${operatorResult.added} → Generalist | Investors: ${investorResult.added} → Intelligence Brief\n` +
        `${highRelevanceCount > 0 ? `:dart: ${highRelevanceCount} high-relevance (company in deal database)\n` : ''}` +
        `Scanned ${scanned} | Fit rate: ${fitRate}% | Page ${startPage}→${nextPage}\n` +
        `Filtered: ${skippedPlatformUser} existing users, ${skippedPreviouslyEnrolled} prev enrolled, ${skippedAlreadyEnrolled} in sequence, ${skippedNoEmail} no email, ${skippedNoMatch} no title match` +
        `${allErrors.length > 0 ? `\n:warning: Errors: ${allErrors.join(', ')}` : ''}`
      );
    } else if (scanned === 0) {
      await notifySlack(
        `:x: *Apollo Auto-Enroll* — No contacts returned from Apollo API. Check APOLLO_API_KEY.`
      );
    } else {
      await notifySlack(
        `:warning: *Apollo Auto-Enroll* — 0 enrolled from ${scanned} scanned\n` +
        `${operatorBatch.length + investorBatch.length > 0
          ? `${operatorBatch.length} operators + ${investorBatch.length} investors matched but enrollment API returned 0. Check sequence status.`
          : `No contacts matched title criteria.`}\n` +
        `Filtered: ${skippedPlatformUser} existing users, ${skippedPreviouslyEnrolled} prev enrolled, ${skippedAlreadyEnrolled} in sequence, ${skippedNoEmail} no email, ${skippedNoMatch} no title match`
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
      operators: { matched: operatorBatch.length, enrolled: operatorResult.added, highRelevance: operatorBatch.filter((c) => c.relevance === 'high').length },
      investors: { matched: investorBatch.length, enrolled: investorResult.added, highRelevance: investorBatch.filter((c) => c.relevance === 'high').length },
      filtered: { platformUser: skippedPlatformUser, previouslyEnrolled: skippedPreviouslyEnrolled, alreadyInSequence: skippedAlreadyEnrolled, noEmail: skippedNoEmail, noTitleMatch: skippedNoMatch },
      pagination: { startPage, nextPage, hitEnd },
      errors: allErrors,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    captureApiError(error, 'apollo-auto-enroll');
    const message = error instanceof Error ? error.message : 'Unknown error';
    const errorSupabase = createServiceClient();
    await logCronRun(errorSupabase, 'apollo-auto-enroll', { errors: [message] });
    await notifySlack(`:x: *Apollo Auto-Enroll FAILED:* ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
