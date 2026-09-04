/**
 * Asset Radar — AI Narrative Synthesis
 *
 * Generates a one-paragraph institutional-grade analyst brief per asset
 * by synthesizing all 6 layers of intelligence into a single coherent
 * assessment. This is the "so what" — the synthesis a senior BD analyst
 * would write after reviewing all the data.
 *
 * Uses Claude to synthesize: asset profile, licensing signals (L2),
 * competitive landscape (L5), proposed acquirers (L6), and deal thesis (L3).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

export interface NarrativeInput {
  asset: {
    asset_name: string;
    company_name: string;
    modality: string | null;
    therapeutic_area: string | null;
    indication_category: string | null;
    phase: string | null;
    trial_status: string | null;
    partnership_status: string | null;
    trial_count: number;
    enrollment_total: number;
    licensing_intent_score: number;
    competitive_heat: number;
    deal_readiness_score: number;
    confidence_score: number;
    originator_country: string | null;
  };
  signals: {
    type: string;
    value: number;
    direction: string;
    evidence: string;
  }[];
  competitors: {
    name: string;
    type: string;
    intensity: number;
  }[];
  proposedAcquirers: {
    acquirer_name: string;
    opportunity_score: number;
    gap_type: string;
    rationale: string;
  }[];
  thesis: {
    predicted_upfront_mid: number | null;
    predicted_total_mid: number | null;
    predicted_royalty_mid: number | null;
    comp_count: number;
  } | null;
  trialCount: number;
  competitorCount: number;
}

export async function generateNarrative(input: NarrativeInput): Promise<string> {
  const { asset, signals, competitors, proposedAcquirers, thesis } = input;

  const signalSummary = signals
    .filter(s => s.value >= 10)
    .map(s => `${s.type.replace(/_/g, ' ')}: ${s.value}/100 (${s.direction}) — ${s.evidence.slice(0, 150)}`)
    .join('\n');

  const competitorSummary = competitors.length > 0
    ? competitors.slice(0, 8).map(c => `${c.name} (${c.type}, intensity ${c.intensity})`).join(', ')
    : 'No significant competitors detected';

  const acquirerSummary = proposedAcquirers.length > 0
    ? proposedAcquirers.map(a => `${a.acquirer_name} (score ${a.opportunity_score}, ${a.gap_type.replace(/_/g, ' ')}): ${a.rationale.slice(0, 100)}`).join('\n')
    : 'No proposed acquirers';

  const thesisSummary = thesis && thesis.predicted_upfront_mid
    ? `Predicted upfront: $${thesis.predicted_upfront_mid}M, total: $${thesis.predicted_total_mid}M, royalty: ${thesis.predicted_royalty_mid}% (based on ${thesis.comp_count} comps)`
    : 'No deal thesis available (insufficient comparable transactions)';

  const prompt = `You are a senior pharmaceutical business development analyst writing an institutional-grade assessment brief. Write exactly ONE paragraph (4-6 sentences) synthesizing this asset intelligence.

ASSET: ${asset.asset_name} by ${asset.company_name}
- ${asset.modality || 'Unknown modality'} | ${asset.therapeutic_area || 'Unknown TA'} | ${asset.indication_category || 'Unknown indication'}
- Phase: ${asset.phase || 'Unknown'} | Status: ${asset.trial_status || 'Unknown'}
- Partnership: ${asset.partnership_status} | Country: ${asset.originator_country || 'Unknown'}
- Trials: ${asset.trial_count} | Enrollment: ${asset.enrollment_total}

SCORES:
- Licensing Intent: ${asset.licensing_intent_score}/100
- Deal Readiness: ${asset.deal_readiness_score}/100
- Competitive Heat: ${asset.competitive_heat}/100
- Data Confidence: ${asset.confidence_score}/100

LICENSING SIGNALS:
${signalSummary || 'No significant signals detected'}

COMPETITIVE LANDSCAPE:
${competitorSummary}

PROPOSED ACQUIRERS:
${acquirerSummary}

DEAL ECONOMICS:
${thesisSummary}

RULES:
- Write as a senior BD analyst at a top-tier advisory firm (Lazard, Centerview, Greenhill)
- Lead with the investment thesis (bullish, bearish, or nuanced)
- State the key risk and the key catalyst
- Mention specific competitors if relevant
- If a proposed acquirer exists, name them and why
- Use precise language: "positioned to," "faces headwinds from," "catalyst-rich," "de-risked"
- Do NOT use bullet points, headers, or markdown
- Do NOT start with "This asset" or the asset name — start with the thesis
- Exactly one paragraph, 4-6 sentences`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0];
  if (text.type !== 'text') return 'Unable to generate narrative.';
  return text.text.trim();
}

export async function fetchNarrativeInputs(
  supabase: SupabaseClient,
  assetId: string,
): Promise<NarrativeInput | null> {
  const { data: asset } = await supabase
    .from('clinical_assets')
    .select('asset_name, company_name, modality, therapeutic_area, indication_category, phase, trial_status, partnership_status, trial_count, enrollment_total, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country')
    .eq('id', assetId)
    .single();

  if (!asset) return null;

  const [signalsRes, intelRes, oppsRes, thesisRes] = await Promise.all([
    supabase
      .from('licensing_signals')
      .select('signal_type, signal_value, direction, evidence_text')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .order('signal_value', { ascending: false })
      .limit(9),
    supabase
      .from('competitive_intel')
      .select('competitor_name, intel_type, intensity')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .not('competitor_name', 'is', null)
      .order('intensity', { ascending: false })
      .limit(10),
    supabase
      .from('radar_deal_opportunities')
      .select('acquirer_name, opportunity_score, gap_type, rationale')
      .eq('asset_id', assetId)
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .limit(5),
    supabase
      .from('radar_deal_theses')
      .select('predicted_upfront_mid, predicted_total_mid, predicted_royalty_mid, comp_count')
      .eq('asset_id', assetId)
      .single(),
  ]);

  return {
    asset: asset as NarrativeInput['asset'],
    signals: (signalsRes.data || []).map(s => ({
      type: s.signal_type,
      value: Number(s.signal_value),
      direction: s.direction,
      evidence: s.evidence_text || '',
    })),
    competitors: (intelRes.data || []).map(c => ({
      name: c.competitor_name!,
      type: c.intel_type,
      intensity: Number(c.intensity),
    })),
    proposedAcquirers: (oppsRes.data || []).map(a => ({
      acquirer_name: a.acquirer_name,
      opportunity_score: Number(a.opportunity_score),
      gap_type: a.gap_type || 'unknown',
      rationale: a.rationale,
    })),
    thesis: thesisRes.data ? {
      predicted_upfront_mid: thesisRes.data.predicted_upfront_mid,
      predicted_total_mid: thesisRes.data.predicted_total_mid,
      predicted_royalty_mid: thesisRes.data.predicted_royalty_mid,
      comp_count: thesisRes.data.comp_count,
    } : null,
    trialCount: asset.trial_count,
    competitorCount: (intelRes.data || []).length,
  };
}
