import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { dripSuppressionFilter } from '@/lib/email/drip-suppression';
import {
  planForToday,
  lintEmail,
  textToHtml,
  eventTypeFor,
  offersFromEnv,
  indicationSearchTerm,
  FOUNDER_FROM,
  FOUNDER_REPLY_TO,
  type SequenceCalculation,
  type SequenceComp,
  type SequenceEmail,
  type SequenceProfile,
} from '@/lib/lifecycle/trial-sequence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Trial Lifecycle — Daily 13:00 UTC (09:00 ET)
//
// The standing founder-led conversion motion. Three touches keyed to each
// account's real pro_expires_at:
//   active trial   T-5  insight + deep link   | day-of  one line, one link | T+3 still there
//   zero-calc      T-5  build it for you      | day-of                     | T+3
//   win-back       reopen day                 | 2 days before close        | T+3
//
// Plain text, from Issa, reply-to Issa, full price, no discount, no auto-
// extension. Respects user_profiles.drip_suppressed_until. Dedupes on
// events rows trial_seq_t1 / t2 / t3. Emails Issa a digest of what went out.
//
// See docs/trial-lifecycle.md.
// ---------------------------------------------------------------------------

const MAX_SENDS_PER_RUN = 60;
const LOOKBACK_DAYS = 6;   // T+3 window ends at -5
const LOOKAHEAD_DAYS = 8;  // winback T1 window starts at +7
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'ikildani@ambrosiaventures.co';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  tier: string | null;
  pro_expires_at: string | null;
  pro_engagement_type: string | null;
  subscription_status: string | null;
}

interface CalcRow {
  user_id: string;
  therapeutic_area: string | null;
  indication_specific: string | null;
  indication_category: string | null;
  development_phase: string | null;
  modality: string | null;
  deal_type: string | null;
  created_at: string;
}

interface DealRow {
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string | null;
  verified: boolean | null;
}

function toProfile(r: ProfileRow): SequenceProfile {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    tier: r.tier,
    proExpiresAt: r.pro_expires_at,
    proEngagementType: r.pro_engagement_type,
    subscriptionStatus: r.subscription_status,
  };
}

function toCalc(r: CalcRow): SequenceCalculation {
  return {
    therapeuticArea: r.therapeutic_area,
    indication: r.indication_specific || r.indication_category,
    phase: r.development_phase,
    modality: r.modality,
    dealType: r.deal_type,
    createdAt: r.created_at,
  };
}

const term = (c: SequenceCalculation | undefined) => (c ? indicationSearchTerm(c.indication) : null);

function toComp(r: DealRow): SequenceComp {
  return {
    licensorName: r.licensor_name,
    licenseeName: r.licensee_name,
    assetName: r.asset_name,
    phaseAtSigning: r.deal_type === 'acquisition' ? 'acquisition' : r.phase_at_signing,
    upfrontUsd: r.upfront_usd,
    totalDealValueUsd: r.total_deal_value_usd,
    announcedDate: r.announced_date,
    verified: r.verified,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const isValid = token.length === cronSecret.length && timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const offers = offersFromEnv();
  const results = {
    considered: 0,
    due: 0,
    sent: 0,
    skippedAlreadySent: 0,
    skippedLint: 0,
    errors: [] as string[],
    sends: [] as Array<{ email: string; track: string; touch: string; subject: string }>,
  };

  try {
    const from = new Date(now.getTime() - LOOKBACK_DAYS * 86400000).toISOString();
    const to = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000).toISOString();

    // 1. Accounts whose expiry is inside any touch window. Tier is not filtered:
    //    T+3 lands after the account has dropped back to free.
    const { data: profiles, error: pErr } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, pro_expires_at, pro_engagement_type, subscription_status')
      .not('pro_expires_at', 'is', null)
      .gte('pro_expires_at', from)
      .lte('pro_expires_at', to)
      // Founder-led one-off sequences take precedence (migration 108)
      .or(dripSuppressionFilter(now));
    if (pErr) throw new Error(`profiles: ${pErr.message}`);
    const rows = (profiles || []) as ProfileRow[];
    results.considered = rows.length;
    if (rows.length === 0) {
      return NextResponse.json({ success: true, ...results, message: 'No accounts in a touch window' });
    }
    const ids = rows.map(r => r.id);

    // 2. Their calculations (most recent first) and prior sequence events.
    const [{ data: calcs }, { data: events }] = await Promise.all([
      supabase
        .from('calculations')
        .select('user_id, therapeutic_area, indication_specific, indication_category, development_phase, modality, deal_type, created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('events')
        .select('user_id, event_type')
        .in('user_id', ids)
        .in('event_type', ['trial_seq_t1', 'trial_seq_t2', 'trial_seq_t3']),
    ]);
    const calcsByUser = new Map<string, SequenceCalculation[]>();
    for (const c of (calcs || []) as CalcRow[]) {
      if (!calcsByUser.has(c.user_id)) calcsByUser.set(c.user_id, []);
      calcsByUser.get(c.user_id)!.push(toCalc(c));
    }
    const sentByUser = new Map<string, Set<string>>();
    for (const e of (events || []) as Array<{ user_id: string; event_type: string }>) {
      if (!sentByUser.has(e.user_id)) sentByUser.set(e.user_id, new Set());
      sentByUser.get(e.user_id)!.add(e.event_type);
    }

    // 3. Verified comps per (TA, indication), fetched once per key.
    const compCache = new Map<string, { comps: SequenceComp[]; count: number; scope: 'indication' | 'ta' }>();
    async function compsFor(calc: SequenceCalculation | undefined): Promise<{ comps: SequenceComp[]; count: number; scope: 'indication' | 'ta' }> {
      if (!calc?.therapeuticArea) return { comps: [], count: 0, scope: 'ta' };
      const term = indicationSearchTerm(calc.indication);
      const key = `${calc.therapeuticArea}|${term || ''}`;
      const cached = compCache.get(key);
      if (cached) return cached;
      let q = supabase
        .from('deals')
        .select('licensor_name, licensee_name, asset_name, phase_at_signing, deal_type, upfront_usd, total_deal_value_usd, announced_date, verified', { count: 'exact' })
        .eq('is_synthetic', false)
        .or('is_canonical.is.null,is_canonical.eq.true')
        .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
        .eq('therapeutic_area', calc.therapeuticArea)
        .not('upfront_usd', 'is', null)
        .gt('upfront_usd', 0);
      if (term) q = q.or(`indication_specific.ilike.%${term}%,asset_description.ilike.%${term}%`);
      const { data, count } = await q
        .order('verified', { ascending: false })
        .order('announced_date', { ascending: false })
        .limit(5);
      const value = { comps: ((data || []) as DealRow[]).map(toComp), count: count || 0, scope: (term ? 'indication' : 'ta') as 'indication' | 'ta' };
      compCache.set(key, value);
      return value;
    }

    // 4. Plan and send.
    for (const row of rows) {
      if (results.sent >= MAX_SENDS_PER_RUN) break;
      const profile = toProfile(row);
      const calculations = calcsByUser.get(row.id) || [];
      const primary = calculations[0];
      const { comps, count, scope } = await compsFor(primary);
      const email: SequenceEmail | null = planForToday({ profile, calculations, comps, indicationDealCount: term(primary) ? count : 0, compsScope: scope, offers, now });
      if (!email) continue;
      results.due += 1;

      const eventType = eventTypeFor(email.touch);
      if (sentByUser.get(row.id)?.has(eventType)) {
        results.skippedAlreadySent += 1;
        continue;
      }
      const lint = lintEmail(email);
      if (lint.length > 0) {
        results.skippedLint += 1;
        results.errors.push(`${row.email} ${email.track}/${email.touch}: ${lint.join('; ')}`);
        continue;
      }

      const sent = await sendEmail({
        to: row.email,
        subject: email.subject,
        html: textToHtml(email.text),
        text: email.text,
        from: FOUNDER_FROM,
        replyTo: FOUNDER_REPLY_TO,
      });
      if (!sent.success) {
        results.errors.push(`${row.email} ${email.track}/${email.touch}: ${sent.error}`);
        continue;
      }
      await supabase.from('events').insert({
        user_id: row.id,
        event_type: eventType,
        event_data: { track: email.track, touch: email.touch, subject: email.subject, cta: email.cta, offers },
        user_tier: row.tier || 'free',
      });
      results.sent += 1;
      results.sends.push({ email: row.email, track: email.track, touch: email.touch, subject: email.subject });
    }

    // 5. Digest to Issa so every send is reviewable the same morning.
    if (results.sends.length > 0 || results.errors.length > 0) {
      const lines = [
        `Trial lifecycle, ${now.toISOString().slice(0, 10)}`,
        '',
        `${results.sent} sent, ${results.skippedAlreadySent} already sent, ${results.skippedLint} held by lint, ${results.errors.length} errors.`,
        '',
        ...results.sends.map(s => `${s.track}/${s.touch}  ${s.email}  "${s.subject}"`),
        ...(results.errors.length ? ['', 'Errors:', ...results.errors] : []),
        '',
        `Offers: Terrain ${offers.terrainAccess ? 'on' : 'off'}, Search module ${offers.searchModule ? 'on' : 'off'}.`,
      ];
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Trial lifecycle: ${results.sent} sent today`,
        html: textToHtml(lines.join('\n')),
        text: lines.join('\n'),
      }).catch(() => undefined);
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    captureApiError(error, 'trial-lifecycle');
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'unknown', ...results }, { status: 500 });
  }
}
