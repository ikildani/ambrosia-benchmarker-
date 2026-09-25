/**
 * Cheap gate in front of the Opus deal extractor.
 *
 * Why: on Sep 25 2026 the EDGAR full-text backfill sent 2,714 filings to
 * claude-opus-4-6 in 24 hours and 1,898 of them (71%) came back "not a deal",
 * mostly EX-99.1 earnings releases and governance 8-Ks that matched a deal
 * query on one sentence. Every one of those cost a full Opus read of up to
 * 24,000 characters. Two passes here decide, for a fraction of a cent, whether
 * a filing deserves the extractor at all:
 *
 *   1. regex — free. Requires agreement language AND economic terms in the
 *      text, and rejects obvious earnings releases.
 *   2. haiku — claude-haiku-4-5, ~5 output tokens, roughly 1/40th of an Opus
 *      extraction. Answers one yes/no question.
 *
 * The gate fails OPEN: any error in the Haiku call keeps the filing, so an
 * outage can cost money but can never lose a deal.
 *
 * EXTRACTION_GATE=haiku (default) | regex | none
 */

import Anthropic from '@anthropic-ai/sdk';

export type GateMode = 'haiku' | 'regex' | 'none';

export interface GateDecision {
  keep: boolean;
  /** Short reason for the funnel: 'regex:no_agreement_terms', 'haiku:no', 'gate_error' ... */
  reason: string;
}

export const GATE_MODEL = 'claude-haiku-4-5';
/** Only the head of the filing is needed to tell a deal from a non-deal. */
export const GATE_TEXT_CHARS = 12_000;

export function gateMode(): GateMode {
  const v = (process.env.EXTRACTION_GATE || 'haiku').toLowerCase();
  return v === 'regex' || v === 'none' ? v : 'haiku';
}

const AGREEMENT = /\b(licen[cs]e|licens(?:ing|ed|or|ee)|collaborat(?:ion|e|ive)|co-?development|co-?promot|option agreement|exclusive (?:rights|option)|asset purchase|acqui(?:re|sition) of|merger agreement|research agreement|supply agreement|distribution agreement)\b/i;
const ECONOMICS = /\b(upfront|up-front|milestone|royalt(?:y|ies)|\$\s?\d|USD\s?\d|\d+(?:\.\d+)?\s?(?:million|billion)|tiered|net sales)\b/i;
const EARNINGS = /\b(financial results for the (?:first|second|third|fourth) quarter|reports? (?:first|second|third|fourth)[- ]quarter|quarterly (?:financial )?results|full[- ]year (?:financial )?results|earnings (?:call|release|conference)|conference call to discuss)\b/i;
const GOVERNANCE_ONLY = /\b(annual meeting of (?:stock|share)holders|appointment of (?:director|officer)|resignation of|compensatory arrangement|employment agreement|severance)\b/i;

/** Free pass. Keeps anything with agreement language plus economics; rejects earnings and governance filings that carry neither. */
export function regexDealGate(text: string): GateDecision {
  const head = text.slice(0, GATE_TEXT_CHARS);
  const hasAgreement = AGREEMENT.test(head);
  const hasEconomics = ECONOMICS.test(head);
  if (hasAgreement && hasEconomics) return { keep: true, reason: 'regex:agreement_and_terms' };
  if (EARNINGS.test(head) && !hasAgreement) return { keep: false, reason: 'regex:earnings_release' };
  if (GOVERNANCE_ONLY.test(head) && !hasAgreement) return { keep: false, reason: 'regex:governance_only' };
  if (!hasAgreement) return { keep: false, reason: 'regex:no_agreement_terms' };
  // Agreement language without any number: a definitive agreement exhibit can still carry terms
  // deeper than the head, so let it through and let Haiku or Opus decide.
  return { keep: true, reason: 'regex:agreement_no_economics' };
}

const HAIKU_SYSTEM = `You screen SEC filing text for a biopharma deal database. Answer with exactly one word: YES or NO.
Answer YES only if the text describes a specific agreement between two named companies in which one grants the other rights to a drug, biologic, platform, or product (license, option, collaboration, co-development, acquisition, or supply/distribution of a therapeutic) AND at least one financial term is stated (upfront payment, milestone payments, royalties, equity, total deal value, or purchase price).
Answer NO for earnings releases, financing announcements, governance or personnel changes, general pipeline updates, clinical data announcements without an agreement, and agreements with no financial terms.`;

/** Paid pass, about 1/40th of an Opus extraction. Fails open. */
export async function haikuDealGate(text: string, anthropicApiKey: string): Promise<GateDecision> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 30_000, maxRetries: 1 });
  try {
    const res = await anthropic.messages.create({
      model: GATE_MODEL,
      max_tokens: 5,
      system: HAIKU_SYSTEM,
      messages: [{ role: 'user', content: `Filing text:\n${text.slice(0, GATE_TEXT_CHARS)}\n\nDoes this describe a biopharma deal with at least one financial term? Answer YES or NO.` }],
    });
    const first = res.content[0];
    const answer = first && first.type === 'text' ? first.text.trim().toUpperCase() : '';
    if (answer.startsWith('NO')) return { keep: false, reason: 'haiku:no' };
    if (answer.startsWith('YES')) return { keep: true, reason: 'haiku:yes' };
    return { keep: true, reason: 'haiku:unparsed' };
  } catch (e) {
    console.error('[deal-gate] haiku gate error, keeping filing:', e instanceof Error ? e.message : e);
    return { keep: true, reason: 'gate_error' };
  }
}

/** Run the configured gate. `none` keeps everything. */
export async function dealGate(text: string, anthropicApiKey: string, mode: GateMode = gateMode()): Promise<GateDecision> {
  if (mode === 'none') return { keep: true, reason: 'none' };
  const r = regexDealGate(text);
  if (!r.keep || mode === 'regex') return r;
  return haikuDealGate(text, anthropicApiKey);
}
