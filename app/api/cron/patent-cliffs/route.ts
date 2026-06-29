/**
 * Tier 4 Item 14 — Patent Cliff Refresh Cron (quarterly)
 *
 * Upserts the static PATENT_CLIFFS_STATIC map into `indication_patent_cliffs`.
 * A follow-up iteration will hit FDA Orange Book + Drugs@FDA to auto-refresh
 * from upstream; for now this cron guarantees the DB is hydrated with the
 * curated 2024 data whenever Supabase is rebuilt or a new environment spins
 * up. Also logs any LOE year shifts vs. the existing DB rows.
 *
 * Schedule: first day of every 3rd month, 6am UTC (cron "0 6 1 star/3 star").
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { PATENT_CLIFFS_STATIC } from '@/lib/financial/patent-cliffs';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken),
  );
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Pull existing rows so we can detect LOE year shifts.
    const { data: existingRows } = await supabase
      .from('indication_patent_cliffs')
      .select('indication, drug, loe_year');
    const existingMap = new Map<string, number>();
    (existingRows ?? []).forEach(r => {
      existingMap.set(`${r.indication}|${r.drug}`, Number(r.loe_year));
    });

    const rows = Object.values(PATENT_CLIFFS_STATIC)
      .flat()
      .map(c => ({
        indication: c.indication,
        drug: c.drug,
        loe_year: c.loeYear,
        biosimilar_year: c.biosimilarYear,
        current_revenue_usd_m: c.currentRevenueUsdM,
        rank: c.rank,
        source: c.source,
        source_year: c.sourceYear,
        notes: c.notes ?? null,
        last_refreshed: new Date().toISOString(),
      }));

    // Detect and log LOE year shifts.
    let changedCount = 0;
    for (const r of rows) {
      const prev = existingMap.get(`${r.indication}|${r.drug}`);
      if (prev != null && Math.abs(prev - r.loe_year) >= 1) {
        changedCount++;
        try {
          const Sentry = require('@sentry/nextjs');
          Sentry.addBreadcrumb?.({
            category: 'engine.patent-cliffs',
            level: 'info',
            message: `LOE year shift for ${r.drug} in ${r.indication}: ${prev} → ${r.loe_year}`,
          });
        } catch {
          /* Sentry optional */
        }
      }
    }

    const { error } = await supabase
      .from('indication_patent_cliffs')
      .upsert(rows, { onConflict: 'indication,drug' });
    if (error) {
      console.error('indication_patent_cliffs upsert failed', error);
      return NextResponse.json({ error: 'Patent cliff refresh failed' }, { status: 500 });
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'patent-cliffs', {
        processed: rows.length,
        inserted: rows.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      refreshedCount: rows.length,
      changedCount,
    });
  } catch (error) {
    console.error('patent-cliffs cron error:', error);
    return NextResponse.json({ error: 'Patent cliff refresh failed' }, { status: 500 });
  }
}
