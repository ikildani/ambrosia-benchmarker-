import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Smart Trial Extension Cron — Daily 7AM UTC
//
// Extends Pro trial users by 7 days if they meet BOTH criteria:
//   1. pro_expires_at is within the next 2 days (about to expire)
//   2. 3+ events in the last 7 days (actively using the product)
//
// Rationale: extending active trial users costs $0 (they're not paying yet)
// but doubles conversion probability — 14 days of usage vs 7.
//
// Guards against infinite extensions: only extends once per user by checking
// for a prior 'smart_trial_extension' event.
//
// Cron config (vercel.json): "0 7 * * *"
// Auth: Bearer $CRON_SECRET
// ---------------------------------------------------------------------------

const BASE_URL = 'https://solidus.ambrosiaventures.co';


export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RETIRED (Sep 2026). Automatic 7-day extensions contradicted the founder-led
  // trial sequence (app/api/cron/trial-lifecycle): an account would get "your
  // trial has been extended" the day after Issa told them it ends Sunday, and
  // the extension removed the deadline the sequence is built on. Extensions are
  // now granted only by hand, on request. The route stays so nothing 404s; it is
  // no longer scheduled in vercel.json.
  console.log('[smart-trial-extend] retired: automatic trial extensions are disabled; see docs/trial-lifecycle.md');
  return NextResponse.json({ success: true, retired: true, checked: 0, extended: 0, message: 'Automatic trial extensions are retired; extensions are granted by hand.' });
}
