/**
 * Asset Radar — Export / Brief Generation API
 *
 * GET /api/radar/export?asset_id=UUID&format=json
 *   Generates a comprehensive asset intelligence brief with all 6 layers
 *   of data, suitable for deal committee presentations.
 *
 * Returns structured JSON that can be rendered as PDF or shared internally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchNarrativeInputs, generateNarrative } from '@/lib/radar/narrative';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch all data in parallel
  const [assetRes, signalsRes, intelRes, oppsRes, thesisRes, trialsRes, snapshotsRes] = await Promise.all([
    supabase.from('clinical_assets').select('*').eq('id', assetId).single(),
    supabase.from('licensing_signals').select('*').eq('asset_id', assetId).eq('is_active', true).order('signal_value', { ascending: false }),
    supabase.from('competitive_intel').select('*').eq('asset_id', assetId).eq('is_active', true).order('intensity', { ascending: false }),
    supabase.from('radar_deal_opportunities').select('*').eq('asset_id', assetId).neq('status', 'dismissed').order('opportunity_score', { ascending: false }),
    supabase.from('radar_deal_theses').select('*').eq('asset_id', assetId).single(),
    supabase.from('company_trials').select('nct_id, trial_title, phase, status, enrollment_count, start_date, primary_completion_date, is_collaboration').ilike('intervention_name', `%${assetId}%`).limit(20),
    supabase.from('asset_signal_snapshots').select('*').eq('asset_id', assetId).order('snapshot_date', { ascending: false }).limit(30),
  ]);

  if (!assetRes.data) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Try to get trials by asset name instead
  let trials = trialsRes.data || [];
  if (trials.length === 0 && assetRes.data.asset_name) {
    const { data: trialsByName } = await supabase
      .from('company_trials')
      .select('nct_id, trial_title, phase, status, enrollment_count, start_date, primary_completion_date, is_collaboration')
      .eq('company_name', assetRes.data.company_name)
      .ilike('intervention_name', `%${assetRes.data.asset_name}%`)
      .limit(20);
    trials = trialsByName || [];
  }

  // Generate AI narrative
  let narrative: string | null = null;
  try {
    const inputs = await fetchNarrativeInputs(supabase, assetId);
    if (inputs) narrative = await generateNarrative(inputs);
  } catch { /* proceed without narrative */ }

  const asset = assetRes.data;
  const signals = signalsRes.data || [];
  const intel = intelRes.data || [];
  const opportunities = oppsRes.data || [];
  const thesis = thesisRes.data;
  const snapshots = snapshotsRes.data || [];

  // Build the brief
  const brief = {
    meta: {
      generated_at: new Date().toISOString(),
      generated_by: 'Solidus Asset Radar',
      version: '1.0',
    },

    executive_summary: {
      narrative,
      asset_name: asset.asset_name,
      company_name: asset.company_name,
      country: asset.originator_country,
      modality: asset.modality,
      therapeutic_area: asset.therapeutic_area,
      indication: asset.indication_category,
      phase: asset.phase,
      partnership_status: asset.partnership_status,
      partner: asset.partner_company_name,
    },

    scores: {
      licensing_intent: Math.round(Number(asset.licensing_intent_score || 0)),
      deal_readiness: Math.round(Number(asset.deal_readiness_score || 0)),
      competitive_heat: Math.round(Number(asset.competitive_heat || 0)),
      data_confidence: Math.round(Number(asset.confidence_score || 0)),
    },

    licensing_signals: signals.map(s => ({
      factor: s.signal_type,
      score: Math.round(Number(s.signal_value)),
      direction: s.direction,
      evidence: s.evidence_text,
    })),

    competitive_landscape: {
      total_signals: intel.length,
      competitors: intel
        .filter(i => i.competitor_name)
        .map(i => ({
          name: i.competitor_name,
          type: i.intel_type,
          intensity: Math.round(Number(i.intensity)),
        })),
    },

    deal_economics: thesis ? {
      upfront: { low: thesis.predicted_upfront_low, mid: thesis.predicted_upfront_mid, high: thesis.predicted_upfront_high },
      total: { low: thesis.predicted_total_low, mid: thesis.predicted_total_mid, high: thesis.predicted_total_high },
      royalty: { low: thesis.predicted_royalty_low, mid: thesis.predicted_royalty_mid, high: thesis.predicted_royalty_high },
      comp_count: thesis.comp_count,
      confidence: thesis.thesis_confidence,
    } : null,

    proposed_acquirers: opportunities.map(o => ({
      acquirer: o.acquirer_name,
      score: Math.round(Number(o.opportunity_score)),
      strategic_fit: Math.round(Number(o.strategic_fit_score)),
      gap_type: o.gap_type,
      rationale: o.rationale,
      drivers: o.strategic_drivers,
      risks: o.risk_factors,
    })),

    clinical_program: {
      trial_count: asset.trial_count,
      enrollment_total: asset.enrollment_total,
      trials: trials.map(t => ({
        nct_id: t.nct_id,
        title: t.trial_title,
        phase: t.phase,
        status: t.status,
        enrollment: t.enrollment_count,
        completion_date: t.primary_completion_date,
      })),
    },

    score_trend: snapshots.slice(0, 14).map(s => ({
      date: s.snapshot_date,
      intent: Math.round(Number(s.licensing_intent_score)),
      heat: Math.round(Number(s.competitive_heat)),
      readiness: Math.round(Number(s.deal_readiness_score)),
      trend: s.trend,
    })),
  };

  return NextResponse.json(brief);
}
