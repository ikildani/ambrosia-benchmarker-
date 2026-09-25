/**
 * Positioning & objections — how to tell the story and what the buyer's BD /
 * S&E team will push back on.
 *
 * Grounded only in the numbers the decision layer supplies. On any failure the
 * generator returns a deterministic fallback built from the decision summary,
 * so the page always has something an advisor would stand behind.
 */

import { parseJsonResponse } from './parse-json';
import type { AssetProfile, DecisionSummary, PositioningObjections } from '@/lib/brief/types';

export const OBJECTION_MODEL = 'claude-opus-4-6';
const MAX_TOKENS = 1800;
const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 2;
export const FALLBACK_MODEL = 'deterministic-fallback';

export interface ObjectionInput {
  asset: AssetProfile;
  decision: DecisionSummary;
  /** Plain-language summary of the comp set (n, medians, band). */
  compSummary: string;
  /** Plain-language summary of the buyer map (lead, tension, urgency). */
  buyerSummary: string;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

function phaseWord(phase: string): string {
  const k = (phase || '').replace(/_/g, '').toLowerCase();
  if (k === 'phase1' || k === 'phase12') return 'Phase 1';
  if (k === 'phase2' || k === 'phase23') return 'Phase 2';
  if (k === 'phase3' || k === 'ndafiled' || k === 'nda') return 'Phase 3';
  if (k === 'approved') return 'approved';
  return 'preclinical';
}

function buildPrompt(input: ObjectionInput): string {
  const { asset, decision, compSummary, buyerSummary } = input;
  const name = asset.assetName || asset.company || 'the asset';
  const royalty = decision.ask.royaltyPct ? `${decision.ask.royaltyPct.low}–${decision.ask.royaltyPct.high}%` : 'not set';
  return `You are the Managing Partner of a life-sciences advisory firm. You are writing for your client's CEO, who will take this asset to pharma buyers. Write plainly and specifically. No hype. Never use the words "leverage", "synergies", "AI", "illustrative" or "sample".

Ground everything ONLY in the facts below. Do not invent trial results, patents, competitor names or numbers that are not listed.

ASSET
- Name: ${name}
- Company: ${asset.company || 'not given'}
- Modality: ${asset.modality}; mechanism: ${asset.mechanism || 'not given'}; target: ${asset.target || 'not given'}
- Phase: ${phaseWord(asset.phase)}; indication: ${asset.indication}; therapeutic area: ${asset.therapeuticArea}
- Territory on offer: ${asset.territory}; structure sought: ${asset.targetDealType}
- Data package stage: ${asset.dataPackageStage || 'not given'}
- Differentiation notes from the client: ${asset.differentiationNotes || 'none given'}

DECISION
- Recommendation: ${decision.recommendationLabel}
- Headline: ${decision.headline}
- Ask: ${fmt(decision.ask.totalM)} total, ${fmt(decision.ask.upfrontM)} upfront, royalty ${royalty}
- Floor: ${fmt(decision.floor.totalM)} total, ${fmt(decision.floor.upfrontM)} upfront; walk-away ${fmt(decision.walkAwayUpfrontM)} upfront
- Rationale: ${decision.rationale.map((r, i) => `(${i + 1}) ${r}`).join(' ')}
- Confidence: ${decision.confidence} — ${decision.confidenceBasis}

COMPARABLES
${compSummary || 'No comparable summary supplied.'}

BUYERS
${buyerSummary || 'No buyer summary supplied.'}

TASK
Return ONLY a JSON object with exactly this shape, no prose before or after:
{
  "positioning": ["paragraph 1 (max 70 words)", "paragraph 2 (max 70 words)"],
  "objections": [
    { "objection": "one sentence, in the buyer's words", "answer": "two to three sentences using the numbers above", "evidenceToPrepare": "the specific document, table or analysis to bring" }
  ]
}
Rules:
- positioning: paragraph 1 states what the asset is and why it matters to a buyer at this phase; paragraph 2 states the ask and why the number is defensible.
- objections: exactly 5. Cover the ones a pharma BD or search-and-evaluation team actually raises at ${phaseWord(asset.phase)}: thinness of the data package at this phase, a crowded mechanism, probability of success, manufacturing / CMC, IP runway, and why now. Pick the five most likely for this asset.
- Each answer must cite at least one number from the facts above.
- Plain English. Short sentences.`;
}

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: OBJECTION_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errBody.substring(0, 200)}`);
  }
  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content?.find(c => c.type === 'text');
  if (!text) throw new Error('No text content in response');
  return text.text;
}

const BANNED = /\b(leverage|synerg\w*|illustrative|sample)\b|\bAI\b/i;

function validate(parsed: unknown): PositioningObjections | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as { positioning?: unknown; objections?: unknown };
  if (!Array.isArray(p.positioning) || p.positioning.length < 2) return null;
  if (!Array.isArray(p.objections) || p.objections.length < 5) return null;
  const positioning = p.positioning.slice(0, 2).map(s => String(s ?? '').trim());
  if (positioning.some(s => s.length < 20 || BANNED.test(s))) return null;
  const objections = p.objections.slice(0, 5).map(o => {
    const r = (o ?? {}) as Record<string, unknown>;
    return {
      objection: String(r.objection ?? '').trim(),
      answer: String(r.answer ?? '').trim(),
      evidenceToPrepare: String(r.evidenceToPrepare ?? '').trim(),
    };
  });
  if (objections.some(o => !o.objection || !o.answer || !o.evidenceToPrepare || BANNED.test(`${o.objection} ${o.answer} ${o.evidenceToPrepare}`))) return null;
  return { generatedAt: new Date().toISOString(), positioning, objections };
}

/** Deterministic fallback from the decision summary. Still specific, still useful. */
export function buildFallbackObjections(input: ObjectionInput): PositioningObjections {
  const { asset, decision } = input;
  const name = asset.assetName || asset.company || 'The asset';
  const phase = phaseWord(asset.phase);
  const mech = asset.mechanism ? `${asset.mechanism} ` : '';
  const rationale = decision.rationale;
  const compLine = rationale.find(r => /comparable/i.test(r)) || `Comparable evidence: ${decision.confidenceBasis}.`;
  const rnpvLine = rationale.find(r => /risk-adjusted/i.test(r)) || `The ask of ${fmt(decision.ask.totalM)} sits above a floor of ${fmt(decision.floor.totalM)}.`;
  const buyerLine = rationale.find(r => /urgency/i.test(r)) || (decision.counterparties[0] ? `${decision.counterparties[0].name} is the lead: ${decision.counterparties[0].why}` : 'The buyer list is being built.');
  const catalystLine = rationale.find(r => /window/i.test(r)) || decision.wouldChangeView[1];
  const royalty = decision.ask.royaltyPct ? `, royalty ${decision.ask.royaltyPct.low}–${decision.ask.royaltyPct.high}%` : '';

  const positioning = [
    `${name} is a ${phase} ${mech}${asset.modality} for ${asset.indication}${asset.differentiationNotes ? `. ${asset.differentiationNotes.split(/(?<=\.)\s/)[0]}` : ''}. ${decision.headline}`,
    `The ask is ${fmt(decision.ask.totalM)} total with ${fmt(decision.ask.upfrontM)} upfront${royalty}. ${compLine} ${rnpvLine} The floor is ${fmt(decision.floor.totalM)} total and ${fmt(decision.floor.upfrontM)} upfront; below ${fmt(decision.walkAwayUpfrontM)} upfront we walk.`,
  ];

  const objections = [
    {
      objection: `The data package is thin for ${phase}; we cannot underwrite the ask on what is in the room.`,
      answer: `The ask is set against the comparable band, not against a best case: ${compLine} ${decision.wouldChangeView[2]}`,
      evidenceToPrepare: asset.dataPackageStage ? `Full data package through “${asset.dataPackageStage}” with study reports, plus the gap list from the diligence readiness page.` : 'Full data package with study reports and the gap list from the diligence readiness page.',
    },
    {
      objection: `The mechanism is crowded; why does this ${asset.modality} win against what is already in ${asset.indication}?`,
      answer: asset.differentiationNotes
        ? `${asset.differentiationNotes} The comparable set already prices this crowding: ${compLine}`
        : `The comparable set already prices the field: ${compLine} The differentiation case rests on the target product profile against current standard of care.`,
      evidenceToPrepare: `Pipeline map by mechanism and phase with expected readouts in the next 24 months, and the target product profile versus standard of care.`,
    },
    {
      objection: `Probability of success at ${phase} does not support ${fmt(decision.ask.totalM)}.`,
      answer: `${rnpvLine} The structure puts most of the total behind milestones the buyer controls; the upfront ask is ${fmt(decision.ask.upfrontM)}, ${decision.ask.totalM > 0 ? Math.round((decision.ask.upfrontM / decision.ask.totalM) * 100) : 0}% of the total.`,
      evidenceToPrepare: 'Risk-adjusted NPV model with the phase-transition probabilities and cost assumptions, and the milestone schedule.',
    },
    {
      objection: 'Manufacturing and supply are not ready for the next study, and the cost of goods is unknown.',
      answer: `The CMC package and its gaps are listed on the diligence readiness page; the items marked as gaps are being closed before outreach. Scale-up cost is carried in the development cost behind the ask.`,
      evidenceToPrepare: 'Batch records, stability data, CMO agreements and a commercial cost-of-goods estimate with assumptions.',
    },
    {
      objection: 'Why now? We would rather see the next readout and pay for de-risked data.',
      answer: `${catalystLine} ${buyerLine} The ask today is the floor for the conversation after the next data point, not the ceiling.`,
      evidenceToPrepare: 'Catalyst calendar with buyer-specific events, and the inflection-path table showing terms if the next readout is positive.',
    },
  ];

  return { generatedAt: new Date().toISOString(), positioning, objections, model: FALLBACK_MODEL };
}

export async function generatePositioningObjections(input: ObjectionInput): Promise<PositioningObjections> {
  const prompt = buildPrompt(input);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const text = await callAnthropic(prompt);
      const parsed = parseJsonResponse<unknown>(text);
      const valid = validate(parsed);
      if (valid) return { ...valid, model: OBJECTION_MODEL };
      // Parse succeeded but shape or wording failed: retry once.
    } catch {
      // Network, auth or parse failure: retry once, then fall back.
    }
  }
  return buildFallbackObjections(input);
}
