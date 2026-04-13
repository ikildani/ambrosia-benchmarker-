/**
 * Tier 3 Item 9 — Counterparty Premium Refresh Cron (quarterly).
 *
 * Reads disclosed deals from the `deals` table + buyer profiles from the
 * `companies` table, computes per-buyer premium multipliers via
 * `computeCounterpartyPremiums()`, and upserts results into the
 * `counterparty_premiums` table. The UI-4 playbook pages at /playbook/[slug]
 * render from this table.
 *
 * Schedule: first day of every 3rd month at 7am UTC (after patent-cliffs
 * at 6am to avoid concurrent writes on related tables).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import {
  computeCounterpartyPremiums,
  type DealRow,
  type CompanyRow,
} from '@/lib/financial/counterparty-premiums';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const sameLen = provided.length === expected.length;
  const tokenToCompare = sameLen ? provided : expected;
  const isValid = sameLen && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expected));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Pull disclosed deals with total_deal_value + indication + phase.
    const { data: dealRows, error: dealErr } = await supabase
      .from('deals')
      .select('id, licensee_id, licensee_name, indication_category, indication_specific, phase_at_signing, total_deal_value_usd, upfront_usd, modality, therapeutic_area')
      .not('total_deal_value_usd', 'is', null)
      .not('licensee_id', 'is', null)
      .limit(5000);
    if (dealErr) throw dealErr;

    // Pull companies (buyers) with their names.
    const { data: companyRows, error: compErr } = await supabase
      .from('companies')
      .select('id, name, company_type')
      .limit(5000);
    if (compErr) throw compErr;

    const deals = (dealRows ?? []) as DealRow[];
    const companies = (companyRows ?? []) as CompanyRow[];

    const premiums = computeCounterpartyPremiums(deals, companies);

    if (premiums.length === 0) {
      return NextResponse.json({
        success: true,
        buyersRefreshed: 0,
        dealsAnalyzed: deals.length,
        reason: 'No buyers with ≥3 disclosed deals',
      });
    }

    const rows = premiums.map(p => ({
      company_id: p.companyId,
      company_name: p.companyName,
      premium_multiplier: p.premiumMultiplier,
      sample_size: p.sampleSize,
      confidence: p.confidence,
      by_therapeutic_area: p.byTherapeuticArea ?? {},
      by_phase: p.byPhase ?? {},
      calculation_notes: p.calculationNotes ?? null,
      as_of_date: p.asOfDate,
    }));

    const { error: upsertErr } = await supabase
      .from('counterparty_premiums')
      .upsert(rows, { onConflict: 'company_id,as_of_date' });
    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      success: true,
      buyersRefreshed: premiums.length,
      dealsAnalyzed: deals.length,
    });
  } catch (error) {
    console.error('counterparty-calibration cron error:', error);
    return NextResponse.json({ error: 'Calibration failed' }, { status: 500 });
  }
}
