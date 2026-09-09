#!/usr/bin/env npx tsx
/**
 * Sep 2026 trial-cohort campaign: account operations.
 *
 * Two independent operations, both idempotent, both dry-run by default:
 *
 *   --suppress   set user_profiles.drip_suppressed_until for the whole cohort
 *                (migration 108) so the lifecycle crons stay silent while the
 *                founder-led sequence runs. Logs a manual_sequence_suppressed
 *                event per user.
 *
 *   --reopen     reopen Pro for the win-back accounts (7 days) and grant
 *                open-ended Pro to the advisory guest. Logs a
 *                winback_access_reopened event per user.
 *
 *   --apply      actually write. Without it the script only prints the plan.
 *
 * Usage:
 *   npx tsx scripts/cohort-sep2026.ts --suppress            # dry run
 *   npx tsx scripts/cohort-sep2026.ts --suppress --apply
 *   npx tsx scripts/cohort-sep2026.ts --reopen --apply
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/** Lifecycle crons stay silent for the cohort until this date. */
const SUPPRESS_UNTIL = '2026-10-05T00:00:00.000Z';
const CAMPAIGN = 'trial-cohort-sep2026';

/** Everyone receiving the personal sequence (active trials + win-back + guest). */
const COHORT = [
  // Active trials
  'ulmanovaanastasia8@gmail.com',
  'chensu.wang1004@gmail.com',
  'jstrafford@isomorphiclabs.com',
  'manishaneja1977@gmail.com',
  'niyoshi.patel@beonemed.com',
  'kathyxiang187@gmail.com',
  'kviswanadham@apogeepharma.ca',
  'bhogg@apogeepharma.ca',
  'jason.zhang@huishengvc.com',
  'ellis.yuan@huishengvc.com',
  'philip.bacchus@tredapps.com',
  'kombarovrv@gmail.com',
  'jaidyn@wego-solutions.com',
  'chirag@annulustx.com',
  'melanyramos8493@gmail.com',
  'aregladochris@gmail.com',
  'girishkharosekar@gmail.com',
  'jnestor@eumederis.com',
  'krumholz@uni-muenster.de',
  'hans-christian.krumholz@uni-muenster.de', // duplicate account, suppressed so it never drips
  'demetris.iacovides@gmail.com',
  'pandabob0605@gmail.com',
  // Expired trials (win-back)
  'lev.kogon@gmail.com',
  'bryan.czyzewski@gmail.com',
  'sarah.molina2@bcm.edu',
  'thelakecam@gmail.com',
  'jonatanstaaf@hotmail.se',
  'ronbhagia@gmail.com',
  'mehdi.chelbi@biper-tx.com',
  // Advisory guest
  'helenmccormack38@gmail.com',
];

/** Win-back: Pro reopened for 7 days, no card. */
const WINBACK_7D = [
  'lev.kogon@gmail.com',
  'bryan.czyzewski@gmail.com',
  'sarah.molina2@bcm.edu',
  'thelakecam@gmail.com',
  'jonatanstaaf@hotmail.se',
  'ronbhagia@gmail.com',
  'mehdi.chelbi@biper-tx.com',
];

/** Advisory prospect: open-ended Pro, no expiry, no pitch. */
const ADVISORY_GUEST = ['helenmccormack38@gmail.com'];

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DO_SUPPRESS = args.has('--suppress');
const DO_REOPEN = args.has('--reopen');

if (!DO_SUPPRESS && !DO_REOPEN) {
  console.error('Pass --suppress and/or --reopen (add --apply to write).');
  process.exit(1);
}

interface Profile {
  id: string;
  email: string;
  tier: string;
  pro_expires_at: string | null;
  pro_engagement_type: string | null;
  drip_suppressed_until: string | null;
}

async function loadProfiles(emails: string[]): Promise<Map<string, Profile>> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, tier, pro_expires_at, pro_engagement_type, drip_suppressed_until')
    .in('email', emails);
  if (error) throw new Error(`user_profiles load failed: ${error.message}`);
  const map = new Map<string, Profile>();
  for (const row of data || []) map.set(row.email.toLowerCase(), row as Profile);
  const missing = emails.filter(e => !map.has(e.toLowerCase()));
  if (missing.length) console.warn(`  WARNING: ${missing.length} not found:`, missing.join(', '));
  return map;
}

async function logEvent(userId: string, tier: string, eventType: string, eventData: Record<string, unknown>) {
  const { error } = await supabase.from('events').insert({
    user_id: userId,
    event_type: eventType,
    event_data: { campaign: CAMPAIGN, ...eventData },
    user_tier: tier,
  });
  if (error) console.error(`  event insert failed (${eventType}) for ${userId}: ${error.message}`);
}

async function suppress() {
  console.log(`\n== Suppress lifecycle drips until ${SUPPRESS_UNTIL} (${COHORT.length} accounts) ==`);
  const profiles = await loadProfiles(COHORT);
  let changed = 0;
  for (const email of COHORT) {
    const p = profiles.get(email.toLowerCase());
    if (!p) continue;
    const already = p.drip_suppressed_until && new Date(p.drip_suppressed_until) >= new Date(SUPPRESS_UNTIL);
    console.log(`  ${already ? 'skip ' : 'set  '} ${email}  (tier=${p.tier}, current=${p.drip_suppressed_until ?? 'null'})`);
    if (already || !APPLY) continue;
    const { error } = await supabase
      .from('user_profiles')
      .update({ drip_suppressed_until: SUPPRESS_UNTIL, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) {
      console.error(`  update failed for ${email}: ${error.message}`);
      continue;
    }
    await logEvent(p.id, p.tier, 'manual_sequence_suppressed', {
      previous: p.drip_suppressed_until,
      until: SUPPRESS_UNTIL,
    });
    changed += 1;
  }
  console.log(`  ${APPLY ? 'updated' : 'would update'} ${APPLY ? changed : COHORT.length} accounts`);
}

async function reopen() {
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 86400000).toISOString();
  console.log(`\n== Reopen Pro: ${WINBACK_7D.length} win-back for 7 days (to ${sevenDays}), ${ADVISORY_GUEST.length} open-ended ==`);
  const profiles = await loadProfiles([...WINBACK_7D, ...ADVISORY_GUEST]);

  const plan: Array<{ email: string; update: Record<string, unknown>; label: string }> = [];
  for (const email of WINBACK_7D) {
    plan.push({
      email,
      label: 'winback-7d',
      update: {
        tier: 'pro',
        pro_expires_at: sevenDays,
        pro_engagement_type: 'winback-sep2026',
        tier_change_authorized: true,
        subscription_status: 'trialing',
        updated_at: now.toISOString(),
      },
    });
  }
  for (const email of ADVISORY_GUEST) {
    plan.push({
      email,
      label: 'advisory-guest',
      update: {
        tier: 'pro',
        pro_expires_at: null,
        pro_engagement_type: 'advisory-guest',
        tier_change_authorized: true,
        updated_at: now.toISOString(),
      },
    });
  }

  let changed = 0;
  for (const item of plan) {
    const p = profiles.get(item.email.toLowerCase());
    if (!p) continue;
    console.log(`  ${item.label.padEnd(15)} ${item.email}  (was tier=${p.tier}, expires=${p.pro_expires_at ?? 'null'}, type=${p.pro_engagement_type ?? 'null'})`);
    if (!APPLY) continue;
    const { error } = await supabase.from('user_profiles').update(item.update).eq('id', p.id);
    if (error) {
      console.error(`  update failed for ${item.email}: ${error.message}`);
      continue;
    }
    await logEvent(p.id, 'pro', 'winback_access_reopened', {
      mode: item.label,
      previous_tier: p.tier,
      previous_expiry: p.pro_expires_at,
      previous_engagement_type: p.pro_engagement_type,
      new_expiry: item.update.pro_expires_at ?? null,
    });
    changed += 1;
  }
  console.log(`  ${APPLY ? 'updated' : 'would update'} ${APPLY ? changed : plan.length} accounts`);
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY (writing)' : 'MODE: dry run (no writes)');
  if (DO_SUPPRESS) await suppress();
  if (DO_REOPEN) await reopen();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
