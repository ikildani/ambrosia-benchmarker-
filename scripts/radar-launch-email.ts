/**
 * Search & Evaluation launch note (one-off, run by hand after the flag flip).
 *
 *   npx tsx --tsconfig tsconfig.json scripts/radar-launch-email.ts --wave day0            # dry run: prints the audience
 *   npx tsx --tsconfig tsconfig.json scripts/radar-launch-email.ts --wave day0 --send     # sends, one row per recipient in the ledger
 *   npx tsx --tsconfig tsconfig.json scripts/radar-launch-email.ts --wave day7 --send     # nudge, 6+ days after day0, only to people who have not used it
 *   npx tsx --tsconfig tsconfig.json scripts/radar-launch-email.ts --wave day0 --send --to you@example.com   # one test send, not ledgered
 *
 * Audience: active Pro and Portfolio accounts (pro_expires_at null or in the
 * future), excluding auto-trials and the internal team, drip-suppressed
 * accounts (a founder sequence is already running), platform-update opt-outs,
 * and anyone already in radar_launch_email_sends for the wave. day7 also skips
 * anyone with a mandate, a watchlist row or a saved view: they found it.
 *
 * Plain founder note, no template chrome, sent from Issa with reply-to Issa
 * so answers land in the inbox. Needs SENDGRID_API_KEY and the Supabase
 * service key in the environment (.env.local).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/client';
import { dripSuppressionFilter } from '@/lib/email/drip-suppression';

const FROM = 'Issa Kildani <ikildani@ambrosiaventures.co>';
const REPLY_TO = 'ikildani@ambrosiaventures.co';
const SITE = 'https://solidus.ambrosiaventures.co';
const EXCLUDED_ENGAGEMENT = ['auto-trial', 'internal_team'];
const DAY7_MIN_GAP_DAYS = 6;

type Wave = 'day0' | 'day7';

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function firstName(fullName: string | null, email: string): string {
  const fromName = (fullName || '').trim().split(/\s+/)[0];
  if (fromName && /^[A-Za-z][A-Za-z'-]*$/.test(fromName)) return fromName;
  const local = email.split('@')[0].split(/[._-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain paragraphs in a readable column: what a note from a person looks like, not a campaign. */
function plain(paragraphs: string[]): string {
  const body = paragraphs
    .map(p => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2937;">${p}</p>`)
    .join('');
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"><div style="max-width:560px;">${body}</div></body></html>`;
}

export function buildEmail(wave: Wave, name: string): { subject: string; html: string } {
  if (wave === 'day0') {
    return {
      subject: 'Search & Evaluation is live in your Pro account',
      html: plain([
        `Hi ${esc(name)},`,
        'Search &amp; Evaluation is live in Solidus today. It covers the part of BD we had not touched: finding the program, not just pricing it.',
        'It ranks unpartnered clinical-stage programs from trial registries in 100 countries by how likely they are to change hands in the next twelve months, and shows the evidence behind every number. Predicted terms sit next to each asset, with the comparable deals listed.',
        'Three things worth trying this week:',
        `1. Save a mandate from a template (mid-cap oncology, ex-Asia rights, China-forward buyer) and let the digest do the looking: <a href="${SITE}/radar" style="color:#0f766e;">${SITE.replace('https://', '')}/radar</a>`,
        `2. Open the acquirer view for a company you sell to and see which programs fit its gaps: <a href="${SITE}/radar/acquirers" style="color:#0f766e;">/radar/acquirers</a>`,
        '3. Watch two or three assets and set a score alert.',
        `It is included in Pro. The methodology, backtest included, is at <a href="${SITE}/radar/methodology" style="color:#0f766e;">/radar/methodology</a>.`,
        'If something in the data looks wrong, reply to this email and tell me which asset. That is the fastest way it gets fixed.',
        'Issa',
      ]),
    };
  }
  return {
    subject: 'Did Search & Evaluation find you anything?',
    html: plain([
      `Hi ${esc(name)},`,
      'A week ago I switched on Search &amp; Evaluation in your Pro account. I can see you have not saved a mandate or watched an asset yet, so a smaller ask: pick one therapeutic area you buy in and start a mandate from a template. It takes about a minute, and the first digest arrives the next morning.',
      `<a href="${SITE}/radar" style="color:#0f766e;">${SITE.replace('https://', '')}/radar</a>`,
      'If the reason you have not tried it is that the coverage or the scoring does not fit how you work, reply and tell me. I read every one.',
      'Issa',
    ]),
  };
}

interface Profile { id: string; email: string; full_name: string | null; tier: string; pro_engagement_type: string | null; pro_expires_at: string | null }

async function main() {
  const wave = (arg('wave') ?? 'day0') as Wave;
  if (wave !== 'day0' && wave !== 'day7') throw new Error('--wave must be day0 or day7');
  const send = flag('send');
  const only = arg('to');
  const limit = Number(arg('limit') ?? '0') || 0;
  const now = new Date();

  if (only) {
    const { subject, html } = buildEmail(wave, firstName(null, only));
    if (!send) { console.log(`dry run: would send "${subject}" to ${only}`); return; }
    const r = await sendEmail({ to: only, subject, html, from: FROM, replyTo: REPLY_TO });
    console.log('test send', r);
    return;
  }

  const supabase = createServiceClient();
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, tier, pro_engagement_type, pro_expires_at')
    .in('tier', ['pro', 'portfolio'])
    .or(dripSuppressionFilter(now))
    .or('pro_expires_at.is.null,pro_expires_at.gt.' + now.toISOString());
  if (error) throw new Error(`user_profiles: ${error.message}`);
  let audience = ((profiles || []) as Profile[]).filter(p => p.email && !EXCLUDED_ENGAGEMENT.includes(p.pro_engagement_type || ''));

  const ids = audience.map(p => p.id);
  const { data: prefs } = await supabase.from('email_preferences').select('user_id, platform_updates').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const optedOut = new Set((prefs || []).filter(p => p.platform_updates === false).map(p => String(p.user_id)));
  audience = audience.filter(p => !optedOut.has(p.id));

  const { data: sent } = await supabase.from('radar_launch_email_sends').select('email, wave, sent_at');
  const sentRows = (sent || []) as { email: string; wave: string; sent_at: string }[];
  const already = new Set(sentRows.filter(r => r.wave === wave).map(r => r.email.toLowerCase()));
  audience = audience.filter(p => !already.has(p.email.toLowerCase()));

  if (wave === 'day7') {
    const day0At = new Map(sentRows.filter(r => r.wave === 'day0').map(r => [r.email.toLowerCase(), new Date(r.sent_at).getTime()]));
    const cutoff = now.getTime() - DAY7_MIN_GAP_DAYS * 86_400_000;
    audience = audience.filter(p => {
      const t = day0At.get(p.email.toLowerCase());
      return t !== undefined && t <= cutoff;
    });
    const remaining = audience.map(p => p.id);
    if (remaining.length) {
      const [m, w, v] = await Promise.all([
        supabase.from('radar_user_mandates').select('user_id').in('user_id', remaining),
        supabase.from('radar_watchlist').select('user_id').in('user_id', remaining),
        supabase.from('radar_saved_views').select('user_id').in('user_id', remaining),
      ]);
      const used = new Set([...(m.data || []), ...(w.data || []), ...(v.data || [])].map(r => String((r as { user_id: string }).user_id)));
      audience = audience.filter(p => !used.has(p.id));
    }
  }

  if (limit > 0) audience = audience.slice(0, limit);
  const mask = (e: string) => e.replace(/^(.).*(@.*)$/, '$1***$2');
  console.log(`${wave}: ${audience.length} recipient(s)${send ? '' : ' (dry run; pass --send to send)'}`);
  for (const p of audience) console.log(`  ${mask(p.email)}  ${p.tier}  ${p.pro_engagement_type ?? '-'}`);
  if (!send) return;

  let ok = 0, failed = 0;
  for (const p of audience) {
    const { subject, html } = buildEmail(wave, firstName(p.full_name, p.email));
    const r = await sendEmail({ to: p.email, subject, html, from: FROM, replyTo: REPLY_TO });
    if (r.success) {
      ok++;
      const { error: ledgerErr } = await supabase.from('radar_launch_email_sends').insert({ email: p.email.toLowerCase(), wave, user_id: p.id, message_id: r.id ?? null });
      if (ledgerErr) console.error(`ledger insert failed for ${mask(p.email)}: ${ledgerErr.message}`);
    } else {
      failed++;
      console.error(`send failed for ${mask(p.email)}: ${r.error}`);
    }
    await new Promise(res => setTimeout(res, 250));
  }
  console.log(`sent ${ok}, failed ${failed}`);
}

// Run only as a script (jest imports buildEmail without sending anything).
if (process.argv[1] && /radar-launch-email\.ts$/.test(process.argv[1])) {
  main().catch(err => { console.error('FATAL', err instanceof Error ? err.stack : err); process.exit(1); });
}
