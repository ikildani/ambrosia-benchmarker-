/**
 * Asset Radar — AI Narrative Synthesis
 *
 * Generates a one-paragraph institutional-grade analyst brief per asset
 * by synthesizing all 6 layers of intelligence into a single coherent
 * assessment. This is the "so what" — the synthesis a senior BD analyst
 * would write after reviewing all the data.
 *
 * Grounding contract: every input is handed to the model as an evidence row
 * with an id (P# profile, S# licensing signal, C# competitor, Q# proposed
 * acquirer, T# deal thesis). Every sentence must cite at least one id, and
 * any sentence that cites an id not in the input — or cites nothing — is
 * stripped before the text is returned. Risk / catalyst are requested only
 * when a bearish / bullish signal exists to cite, so they cannot be invented.
 *
 * Uses Claude (claude-opus-4-6, temperature 0) to synthesize: asset profile,
 * licensing signals (L2), competitive landscape (L5), proposed acquirers (L6),
 * and deal thesis (L3).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

/** Must match NARRATIVE_MODEL in app/api/radar/_lib/radar-api.ts. */
const NARRATIVE_MODEL = 'claude-opus-4-6';

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
    /** evidence_date (or detected_at) — ISO date string when known. */
    date?: string | null;
    /** evidence_source (e.g. 'sec_edgar', 'press_release') when known. */
    source?: string | null;
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
    comp_relaxation?: string | null;
    insufficient_comps?: boolean | null;
  } | null;
  trialCount: number;
  competitorCount: number;
}

// ═══════════════════════════════════════════════════════════════════════
// EVIDENCE ROWS
// ═══════════════════════════════════════════════════════════════════════

interface EvidenceRow {
  id: string;
  text: string;
}

const MIN_SIGNAL_VALUE = 10;

function fmtPhase(p: string | null): string {
  return p ? p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown phase';
}

/** Build the id-tagged evidence rows the model is allowed to cite. */
export function buildEvidenceRows(input: NarrativeInput): {
  rows: EvidenceRow[];
  bullishIds: string[];
  bearishIds: string[];
  thesisId: string | null;
} {
  const { asset, signals, competitors, proposedAcquirers, thesis } = input;
  const rows: EvidenceRow[] = [];

  rows.push({
    id: 'P1',
    text: `${asset.asset_name} by ${asset.company_name}: ${asset.modality || 'unknown modality'}, ${asset.therapeutic_area || 'unknown TA'}, ${asset.indication_category?.replace(/_/g, ' ') || 'unknown indication'}; ${fmtPhase(asset.phase)}; trial status ${asset.trial_status || 'unknown'}; ${asset.trial_count} trial(s), ${asset.enrollment_total} enrolled; partnership status ${asset.partnership_status || 'unknown'}; originator country ${asset.originator_country || 'unknown'}.`,
  });
  rows.push({
    id: 'P2',
    text: `Scores (0-100): licensing intent ${asset.licensing_intent_score}, deal readiness ${asset.deal_readiness_score}, competitive heat ${asset.competitive_heat}, data confidence ${asset.confidence_score}.`,
  });

  const bullishIds: string[] = [];
  const bearishIds: string[] = [];
  signals
    .filter(s => s.value >= MIN_SIGNAL_VALUE)
    .forEach((s, i) => {
      const id = `S${i + 1}`;
      const when = s.date ? ` (${String(s.date).slice(0, 10)})` : '';
      const src = s.source ? `, source: ${s.source}` : '';
      rows.push({
        id,
        text: `Licensing signal "${s.type.replace(/_/g, ' ')}" ${s.value}/100, ${s.direction}${when}${src}: ${s.evidence.slice(0, 220) || 'no evidence text'}`,
      });
      if (s.direction === 'bullish') bullishIds.push(id);
      if (s.direction === 'bearish') bearishIds.push(id);
    });

  competitors.slice(0, 8).forEach((c, i) => {
    rows.push({
      id: `C${i + 1}`,
      text: `Competitor ${c.name} — ${c.type.replace(/_/g, ' ')}, intensity ${c.intensity}/100.`,
    });
  });

  proposedAcquirers.slice(0, 5).forEach((a, i) => {
    rows.push({
      id: `Q${i + 1}`,
      text: `Proposed acquirer ${a.acquirer_name} — opportunity score ${a.opportunity_score}/100, gap: ${a.gap_type.replace(/_/g, ' ')}. ${a.rationale.slice(0, 160)}`,
    });
  });

  let thesisId: string | null = null;
  if (thesis && !thesis.insufficient_comps && thesis.predicted_upfront_mid != null) {
    thesisId = 'T1';
    const relax = thesis.comp_relaxation && thesis.comp_relaxation !== 'none'
      ? ` (comp pool widened: ${thesis.comp_relaxation.replace(/_/g, ' ')})`
      : '';
    const royalty = thesis.predicted_royalty_mid != null ? `, royalty ${thesis.predicted_royalty_mid}%` : '';
    const total = thesis.predicted_total_mid != null ? `, total $${thesis.predicted_total_mid}M` : '';
    rows.push({
      id: thesisId,
      text: `Deal thesis from ${thesis.comp_count} comparable transactions${relax}: predicted upfront $${thesis.predicted_upfront_mid}M${total}${royalty} (medians).`,
    });
  }

  return { rows, bullishIds, bearishIds, thesisId };
}

// ═══════════════════════════════════════════════════════════════════════
// CITATION ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════

const CITATION_RE = /\[([A-Z]\d+(?:\s*[,;/]\s*[A-Z]\d+)*)\]/g;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?](?:\s*\[[A-Z0-9,;/\s]+\])*)\s+(?=[A-Z"“(])/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Keep only sentences whose every citation resolves to a supplied evidence
 * id. Sentences with no citation are dropped too — an uncited sentence is by
 * definition not traceable to the input.
 */
export function enforceCitations(text: string, validIds: Set<string>): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const sentence of splitSentences(text)) {
    const cited: string[] = [];
    for (const m of sentence.matchAll(CITATION_RE)) {
      for (const id of m[1].split(/\s*[,;/]\s*/)) cited.push(id.trim());
    }
    if (cited.length === 0 || cited.some(id => !validIds.has(id))) {
      dropped.push(sentence);
    } else {
      kept.push(sentence);
    }
  }
  return { kept, dropped };
}

/**
 * Deterministic, fully grounded paragraph assembled from the evidence rows.
 * Used when the model output fails the citation check.
 */
function fallbackNarrative(input: NarrativeInput, ev: ReturnType<typeof buildEvidenceRows>): string {
  const { asset } = input;
  const parts: string[] = [];
  parts.push(`${fmtPhase(asset.phase)} ${asset.modality || 'asset'} in ${asset.indication_category?.replace(/_/g, ' ') || asset.therapeutic_area || 'an undisclosed indication'}, ${asset.partnership_status || 'partnership status unknown'}, with licensing intent ${asset.licensing_intent_score}/100 and deal readiness ${asset.deal_readiness_score}/100 [P1, P2].`);
  if (ev.bullishIds.length > 0) {
    parts.push(`Bullish licensing signals are on file [${ev.bullishIds.slice(0, 3).join(', ')}].`);
  }
  if (ev.bearishIds.length > 0) {
    parts.push(`Bearish signals temper the case [${ev.bearishIds.slice(0, 3).join(', ')}].`);
  }
  const compIds = ev.rows.filter(r => r.id.startsWith('C')).map(r => r.id);
  if (compIds.length > 0) {
    parts.push(`Competitive heat stands at ${asset.competitive_heat}/100 across ${compIds.length} tracked competitor signal(s) [P2, ${compIds.slice(0, 3).join(', ')}].`);
  }
  const acqIds = ev.rows.filter(r => r.id.startsWith('Q')).map(r => r.id);
  if (acqIds.length > 0) {
    parts.push(`${input.proposedAcquirers[0].acquirer_name} is the highest-scoring proposed acquirer [${acqIds[0]}].`);
  }
  if (ev.thesisId && input.thesis) {
    parts.push(`Comparable transactions point to a median upfront of $${input.thesis.predicted_upfront_mid}M on ${input.thesis.comp_count} comps [${ev.thesisId}].`);
  } else {
    parts.push(`No deal terms are predicted: the comparable pool is below the floor required for a thesis [P1].`);
  }
  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════════════
// GENERATION
// ═══════════════════════════════════════════════════════════════════════

export async function generateNarrative(input: NarrativeInput): Promise<string> {
  const ev = buildEvidenceRows(input);
  const validIds = new Set(ev.rows.map(r => r.id));

  const evidenceBlock = ev.rows.map(r => `[${r.id}] ${r.text}`).join('\n');

  const riskInstruction = ev.bearishIds.length > 0
    ? `- State the key risk, citing the bearish signal(s) it comes from [${ev.bearishIds.join(', ')}]`
    : '- Do NOT state a risk: no bearish signal is on file. Do not invent one.';
  const catalystInstruction = ev.bullishIds.length > 0
    ? `- State the key catalyst, citing the bullish signal(s) it comes from [${ev.bullishIds.join(', ')}]`
    : '- Do NOT state a catalyst: no bullish signal is on file. Do not invent one.';
  const thesisInstruction = ev.thesisId
    ? `- Mention predicted deal economics only as given in [${ev.thesisId}]`
    : '- Do NOT quote deal economics: no deal thesis is on file. You may say terms cannot be predicted yet, citing [P1].';

  const prompt = `You are a senior pharmaceutical business development analyst writing an institutional-grade assessment brief. Write exactly ONE paragraph (4-6 sentences) synthesizing the evidence below.

EVIDENCE (the ONLY facts you may use; each row has an id):
${evidenceBlock}

RULES:
- Every sentence MUST end with a citation to one or more evidence ids in square brackets, e.g. "... de-risked by recent SEC disclosures [S1, S2]."
- Use ONLY facts present in the evidence rows. Do not add companies, numbers, dates, mechanisms, trial results, or events that are not in the evidence.
- Never cite an id that is not listed above.
- Write as a senior BD analyst at a top-tier advisory firm (Lazard, Centerview, Greenhill)
- Lead with the investment thesis (bullish, bearish, or nuanced), grounded in [P1] and [P2]
${riskInstruction}
${catalystInstruction}
- Mention specific competitors only from the [C#] rows, if relevant
- If a proposed acquirer exists in the [Q#] rows, name them and why
${thesisInstruction}
- Use precise language: "positioned to," "faces headwinds from," "catalyst-rich," "de-risked"
- Do NOT use bullet points, headers, or markdown
- Do NOT start with "This asset" or the asset name — start with the thesis
- Exactly one paragraph, 4-6 sentences`;

  const response = await anthropic.messages.create({
    model: NARRATIVE_MODEL,
    max_tokens: 500,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') return fallbackNarrative(input, ev);

  const { kept, dropped } = enforceCitations(block.text.trim(), validIds);
  if (dropped.length > 0) {
    console.warn(`[radar/narrative] stripped ${dropped.length} uncited/miscited sentence(s) for ${input.asset.company_name}/${input.asset.asset_name}`);
  }
  if (kept.length < 2) return fallbackNarrative(input, ev);
  return kept.join(' ');
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT FETCH
// ═══════════════════════════════════════════════════════════════════════

/**
 * Every sub-query carries a total ordering (primary sort + name/type
 * tiebreaker) so the serialised inputs hash deterministically for the
 * narrative cache.
 */
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
      .select('signal_type, signal_value, direction, evidence_text, evidence_date, evidence_source, detected_at')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .order('signal_value', { ascending: false })
      .order('signal_type', { ascending: true })
      .limit(9),
    supabase
      .from('competitive_intel')
      .select('competitor_name, intel_type, intensity')
      .eq('asset_id', assetId)
      .eq('is_active', true)
      .not('competitor_name', 'is', null)
      .order('intensity', { ascending: false })
      .order('competitor_name', { ascending: true })
      .limit(10),
    supabase
      .from('radar_deal_opportunities')
      .select('acquirer_name, opportunity_score, gap_type, rationale')
      .eq('asset_id', assetId)
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .order('acquirer_name', { ascending: true })
      .limit(5),
    // select('*') so the optional comp_relaxation / insufficient_comps columns
    // (migration 104) are picked up when present without failing when absent.
    supabase
      .from('radar_deal_theses')
      .select('*')
      .eq('asset_id', assetId)
      .maybeSingle(),
  ]);

  const thesisRow = thesisRes.data as Record<string, unknown> | null;

  return {
    asset: asset as NarrativeInput['asset'],
    signals: (signalsRes.data || []).map(s => ({
      type: s.signal_type,
      value: Number(s.signal_value),
      direction: s.direction,
      evidence: s.evidence_text || '',
      date: (s.evidence_date as string | null) || (s.detected_at ? String(s.detected_at).slice(0, 10) : null),
      source: (s.evidence_source as string | null) || null,
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
    thesis: thesisRow ? {
      predicted_upfront_mid: (thesisRow.predicted_upfront_mid as number | null) ?? null,
      predicted_total_mid: (thesisRow.predicted_total_mid as number | null) ?? null,
      predicted_royalty_mid: (thesisRow.predicted_royalty_mid as number | null) ?? null,
      comp_count: Number(thesisRow.comp_count ?? 0),
      comp_relaxation: (thesisRow.comp_relaxation as string | null) ?? null,
      insufficient_comps: (thesisRow.insufficient_comps as boolean | null) ?? null,
    } : null,
    trialCount: asset.trial_count,
    competitorCount: (intelRes.data || []).length,
  };
}
