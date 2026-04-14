/**
 * Retag non-ADC modality sub-classes on the production deals corpus.
 *
 * R20 (modality-profiles.ts) ships 18 fine-grain sub-modality slugs. Round 20
 * was logged as zero-delta because the corpus was still tagged at the coarse
 * parent level. This script activates the non-ADC subset by classifying each
 * deal into a fine-grain sub-class.
 *
 * Two passes:
 *   1. Rule-based regex over asset_name + mechanism_of_action — high-precision,
 *      low-recall. Catches the obvious cases (e.g., asset_name literally
 *      contains "Base editing").
 *   2. (--with-claude) Claude Haiku 4.5 classifier — looks at all eligible
 *      deals with full context (asset, indication, description, MoA) and
 *      picks the best-fit sub-slug or "none". When --with-claude is set,
 *      Claude's verdict overrides the rule-based one for any conflicts.
 *
 * Sub-classes (ADCs are handled separately, per user priority):
 *   - TCE:        tce_bcma, tce_cd20, tce_gpcr
 *   - Degraders:  degrader_oral, molecular_glue
 *   - RNA:        saRNA, circRNA
 *   - Cell therapy: carT_allogeneic, carT_armored, til_therapy
 *   - Gene editing: crispr_base_editing, crispr_prime_editing
 *   - Small-mol:  covalent_inhibitor, allosteric_inhibitor
 *
 * Usage:
 *   npx tsx scripts/retag-non-adc-modalities.ts                   # dry-run, rules only
 *   npx tsx scripts/retag-non-adc-modalities.ts --with-claude     # dry-run, rules + Claude
 *   npx tsx scripts/retag-non-adc-modalities.ts --with-claude --apply
 *   npx tsx scripts/retag-non-adc-modalities.ts --limit=50 --with-claude
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * and ANTHROPIC_API_KEY (when --with-claude is used).
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const WITH_CLAUDE = process.argv.includes('--with-claude');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

if (WITH_CLAUDE && !process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY env var (required with --with-claude).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = WITH_CLAUDE ? new Anthropic() : null;

interface DealRow {
  id: string;
  asset_name: string | null;
  asset_description: string | null;
  mechanism_of_action: string | null;
  indication_specific: string | null;
  indication_category: string | null;
  modality: string | null;
  is_synthetic?: boolean | null;
  verified?: boolean | null;
  upfront_usd?: number | null;
}

/**
 * Normalize a modality string to a canonical slug key for parent-class
 * matching. Mirrors `normalizeModality` in lib/comparableDeals.ts.
 */
function normalizeParent(m: string | null | undefined): string {
  if (!m) return '';
  return m.toLowerCase().replace(/[_\-\s]/g, '');
}

/** Which coarse parent slugs are eligible for non-ADC sub-class retagging. */
const ELIGIBLE_PARENTS = new Set([
  'smallmolecule', 'smallmolecules',
  'bispecific', 'bispecificantibody', 'bispecificab', 'tce', 'tcellengager', 'biteantibody',
  'celltherapy', 'cellbasedtherapy', 'cart', 'cartcelltherapy', 'cartcell', 'cartsolid', 'cartheme', 'cartautoimmune',
  'rnai', 'mrna', 'rna', 'oligonucleotide', 'aso', 'antisenseoligonucleotide', 'smallinterferingrna', 'sirna',
  'geneediting', 'genetherapy', 'genetherapygeneral', 'crispr', 'genetherapysystemic',
  // legacy free-text variants seen in the corpus
  '', 'other', 'unknown',
]);

interface Rule {
  /** Slug assigned if the pattern matches */
  slug: string;
  /** Human label for the dry-run table */
  label: string;
  /** Pattern run against the concatenated haystack */
  pattern: RegExp;
  /** Optional: parent slug must be one of these for the rule to fire (extra safety) */
  parents?: string[];
}

// Rules are evaluated in order; first match wins. Order from most specific → least.
const RULES: Rule[] = [
  // Cell therapy sub-types (evaluate before small-mol / bispecific since TIL / CAR-T
  // share keywords with bispecifics occasionally)
  {
    slug: 'til_therapy',
    label: 'TIL therapy',
    pattern: /\b(til therapy|til[- ]?based|tumor[- ]?infiltrating lymphocyte|lifileucel)\b/i,
  },
  {
    slug: 'carT_allogeneic',
    label: 'Allogeneic CAR-T',
    pattern: /\ballogen(e)?ic\b.*car[- ]?t|car[- ]?t.*\ballogen(e)?ic\b|\boff[- ]the[- ]shelf\b.*car[- ]?t/i,
  },
  {
    slug: 'carT_armored',
    label: 'Armored CAR-T',
    pattern: /armored car[- ]?t|car[- ]?t.*(il[- ]?12|il[- ]?15|il[- ]?18)|cytokine[- ]?armed car[- ]?t/i,
  },

  // T-cell engagers (target-specific patterns on bispecific / TCE parent)
  {
    slug: 'tce_bcma',
    label: 'BCMA T-cell engager',
    pattern: /\bbcma\b.*(bispecific|engager|bite|tce|t[- ]?cell)|\b(teclistamab|elranatamab|tecvayli|elrexfio|linvoseltamab)\b/i,
  },
  {
    slug: 'tce_cd20',
    label: 'CD20 T-cell engager',
    pattern: /\bcd20\b.*(bispecific|engager|bite|tce|t[- ]?cell)|\b(blinatumomab|mosunetuzumab|epcoritamab|glofitamab|odronextamab|lunsumio|columvi|epkinly)\b/i,
  },
  {
    slug: 'tce_gpcr',
    label: 'GPCR/solid-tumor T-cell engager',
    pattern: /\b(gpc3|dll3|cldn6|claudin[- ]?6|psma|steap2|prame|muc16|fap)\b.*(bispecific|engager|bite|tce|t[- ]?cell)|\btarlatamab\b/i,
  },

  // Degraders
  {
    slug: 'molecular_glue',
    label: 'Molecular glue',
    pattern: /\bmolecular glue\b|\bcrbn modulator\b|\bcereblon[- ]?based\b|\bimid\b.*degrader/i,
  },
  {
    slug: 'degrader_oral',
    label: 'Targeted protein degrader',
    pattern: /\b(protac|protein degrader|targeted protein degradation|bivalent degrader)\b|\b(arv-|kt-|dt-)\d{2,4}\b/i,
  },

  // Gene editing sub-types
  {
    slug: 'crispr_base_editing',
    label: 'Base editing',
    pattern: /\bbase edit(ing|or)\b|\b(abe|cbe)\b|\badenine base editor\b|\bcytosine base editor\b/i,
  },
  {
    slug: 'crispr_prime_editing',
    label: 'Prime editing',
    pattern: /\bprime edit(ing|or)\b|\bpegrna\b/i,
  },

  // RNA sub-types
  {
    slug: 'saRNA',
    label: 'Self-amplifying RNA',
    pattern: /\bsarna\b|\bself[- ]?amplifying\b/i,
  },
  {
    slug: 'circRNA',
    label: 'Circular RNA',
    pattern: /\bcircrna\b|\bcircular rna\b/i,
  },

  // Small-molecule sub-classes (lowest priority — many drugs will match the
  // generic `inhibitor` keyword so we gate these behind explicit sub-class terms).
  {
    slug: 'covalent_inhibitor',
    label: 'Covalent inhibitor',
    pattern: /\bcovalent inhibitor\b|\birreversible inhibitor\b|\bkras g12c\b|\b(sotorasib|adagrasib|divarasib)\b/i,
    parents: ['smallmolecule', 'smallmolecules'],
  },
  {
    slug: 'allosteric_inhibitor',
    label: 'Allosteric inhibitor',
    pattern: /\ballosteric (inhibitor|modulator|antagonist)\b|\b(shp2|sos1)\b.*(inhibitor|modulator)|\b(rmc-|jab-\d)/i,
    parents: ['smallmolecule', 'smallmolecules'],
  },
];

function classify(d: DealRow): { slug: string; label: string; pattern: string } | null {
  // Only match against asset_name + mechanism_of_action. asset_description
  // and indication_specific pull in too much generic prose (e.g., indication
  // placeholders like "myeloma" or "psoriasis") and cause false positives.
  const haystack = [d.asset_name, d.mechanism_of_action].filter(Boolean).join(' | ');
  if (!haystack) return null;
  const parent = normalizeParent(d.modality);
  for (const rule of RULES) {
    if (rule.parents && !rule.parents.includes(parent)) continue;
    if (rule.pattern.test(haystack)) {
      return { slug: rule.slug, label: rule.label, pattern: rule.pattern.source };
    }
  }
  return null;
}

// All non-ADC R20 sub-slugs Claude can choose from, plus "none".
const CLAUDE_SLUG_ENUM = [
  'tce_bcma',
  'tce_cd20',
  'tce_gpcr',
  'degrader_oral',
  'molecular_glue',
  'saRNA',
  'circRNA',
  'carT_allogeneic',
  'carT_armored',
  'til_therapy',
  'crispr_base_editing',
  'crispr_prime_editing',
  'covalent_inhibitor',
  'allosteric_inhibitor',
  'none',
] as const;

const ClaudeClassification = z.object({
  slug: z.enum(CLAUDE_SLUG_ENUM),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
});

const CLAUDE_SYSTEM_PROMPT = `You classify pharmaceutical/biotech licensing deals into fine-grain modality sub-classes for a deal-benchmarking engine.

Pick exactly one slug from this list, or "none" if no sub-class is a clean fit.

Sub-class definitions (non-ADC only — do NOT propose ADC slugs):

T-cell engagers — ONLY bispecific antibodies with one CD3-binding arm + one tumor-target arm.
CRITICAL: CAR-T cell products are NOT T-cell engagers. Do not classify any CAR-T asset
(Carvykti/cilta-cel, Yescarta/axi-cel, Breyanzi/liso-cel, Kymriah/tisa-cel, Tecartus/brexu-cel,
or any investigational CAR-T) as a TCE, even if it targets BCMA/CD20 — return "none".
- tce_bcma: BCMA-targeted BISPECIFIC ANTIBODY (e.g., teclistamab/Tecvayli, elranatamab/Elrexfio, linvoseltamab).
- tce_cd20: CD20-targeted BISPECIFIC ANTIBODY (e.g., blinatumomab, mosunetuzumab/Lunsumio, epcoritamab/Epkinly, glofitamab/Columvi, odronextamab).
- tce_gpcr: Solid-tumor bispecific (GPC3, DLL3, CLDN6, PSMA, STEAP2, PRAME, MUC16, FAP). e.g., tarlatamab.

Targeted protein degraders:
- degrader_oral: Heterobifunctional PROTAC-style oral degraders (e.g., ARV-, KT-, DT- coded assets, "protein degrader", "PROTAC", "bivalent degrader").
- molecular_glue: CRBN-modulating molecular glues / IMiD-class degraders.

RNA modalities (NOT mRNA vaccines or standard siRNA):
- saRNA: Self-amplifying RNA / replicon RNA.
- circRNA: Circular RNA.

Cell therapy sub-types:
- carT_allogeneic: Off-the-shelf ALLOGENEIC (donor-derived) CAR-T only.
  IMPORTANT: The following are all AUTOLOGOUS (patient-derived) CAR-Ts and do NOT fit this slug
  (return "none"): Yescarta/axicabtagene ciloleucel, Kymriah/tisagenlecleucel, Breyanzi/lisocabtagene
  maraleucel, Tecartus/brexucabtagene autoleucel, Carvykti/ciltacabtagene autoleucel, Abecma/idecabtagene
  vicleucel. Only classify as carT_allogeneic when the asset description explicitly uses the word
  "allogeneic" or "off-the-shelf" or references the manufacturer's allogeneic platform (Allogene, Caribou,
  CRISPR Tx CTX/CTA series, Cellectis UCART, Precision BioSciences, Atara, Century, etc.).
- carT_armored: CAR-T engineered with cytokine arming (IL-12/15/18) for solid tumors.
- til_therapy: Tumor-infiltrating lymphocyte therapy (e.g., lifileucel/Amtagvi).

Gene editing sub-types (in vivo or ex vivo gene editing — distinct from gene therapy):
- crispr_base_editing: Base editing (ABE/CBE — adenine/cytosine base editors).
- crispr_prime_editing: Prime editing (pegRNA-driven).

Small-molecule sub-classes (only for deals already tagged smallMolecule):
- covalent_inhibitor: Covalent / irreversible binders (e.g., KRAS G12C inhibitors like sotorasib, adagrasib; BTK covalent inhibitors).
- allosteric_inhibitor: Allosteric modulators / non-orthosteric inhibitors (e.g., SHP2, SOS1, AMPA NAMs).

Rules:
- Return "none" when uncertain or when the asset is a plain antibody/mAb/SM that doesn't cleanly fit a sub-class.
- Return "none" if the modality looks like an ADC (antibody-drug conjugate) — those are handled separately.
- Confidence "high" only when the asset name OR mechanism_of_action explicitly matches the sub-class definition.
- Confidence "low" should usually default to "none".
- Reason: ≤ 200 chars, cite the field that drove the decision (e.g., "asset_name explicitly contains 'allogeneic CAR-T'").`;

interface ClaudeProposal {
  id: string;
  asset: string;
  from: string;
  to: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

async function classifyWithClaude(d: DealRow): Promise<ClaudeProposal | null> {
  if (!anthropic) return null;
  const userPayload = [
    `Asset name: ${d.asset_name ?? '(none)'}`,
    `Indication (specific): ${d.indication_specific ?? '(none)'}`,
    `Indication (category): ${d.indication_category ?? '(none)'}`,
    `Asset description: ${d.asset_description ?? '(none)'}`,
    `Mechanism of action: ${d.mechanism_of_action ?? '(none)'}`,
    `Current modality tag: ${d.modality ?? '(none)'}`,
  ].join('\n');

  try {
    const response = await anthropic.messages.parse({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPayload }],
      output_config: { format: zodOutputFormat(ClaudeClassification) },
    });
    const parsed = response.parsed_output;
    if (!parsed || parsed.slug === 'none') return null;
    // Skip low-confidence picks — they're more noise than signal.
    if (parsed.confidence === 'low') return null;
    // Idempotent: skip if already at this slug
    if (normalizeParent(d.modality) === normalizeParent(parsed.slug)) return null;
    return {
      id: d.id,
      asset: d.asset_name ?? '(unnamed)',
      from: d.modality ?? '(empty)',
      to: parsed.slug,
      reason: parsed.reason,
      confidence: parsed.confidence,
    };
  } catch (err) {
    console.error(`  Claude error on deal ${d.id}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Run Claude classification with bounded concurrency to avoid rate limits. */
async function runClaudeBatch(deals: DealRow[], concurrency = 5): Promise<ClaudeProposal[]> {
  const out: ClaudeProposal[] = [];
  let cursor = 0;
  let completed = 0;
  const total = deals.length;

  async function worker() {
    while (cursor < deals.length) {
      const idx = cursor++;
      const d = deals[idx];
      const result = await classifyWithClaude(d);
      if (result) out.push(result);
      completed += 1;
      if (completed % 25 === 0 || completed === total) {
        console.log(`  Claude progress: ${completed} / ${total} (${out.length} proposals so far)`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

async function main() {
  console.log(
    `Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'} | Pass: ${WITH_CLAUDE ? 'rules + Claude' : 'rules only'}${LIMIT ? ` | Limit: ${LIMIT}` : ''}`,
  );
  console.log('Fetching eligible deals from Supabase...');

  // Filter to the same real-deal subset the backtest corpus uses (see
  // scripts/expand-backtest-corpus.ts). This excludes synthetic placeholders
  // whose asset_name/description is generic and produces FP matches.
  const query = supabase
    .from('deals')
    .select('id, asset_name, asset_description, mechanism_of_action, indication_specific, indication_category, modality, is_synthetic, verified, upfront_usd')
    .eq('is_synthetic', false)
    .eq('verified', true)
    .gt('upfront_usd', 0);

  if (LIMIT) query.limit(LIMIT);

  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error('No data returned');

  console.log(`Fetched ${data.length} deal rows.`);

  // Filter to eligible coarse parents
  const eligible = (data as DealRow[]).filter((d) => ELIGIBLE_PARENTS.has(normalizeParent(d.modality)));
  console.log(`Eligible for non-ADC retag: ${eligible.length} deals (parent class in eligible set).`);

  const proposals: { id: string; asset: string; from: string; to: string; rule: string }[] = [];
  const slugCounts = new Map<string, number>();
  // Map of dealId → proposal index, so Claude can override the rule pick.
  const dealIdToIdx = new Map<string, number>();

  for (const d of eligible) {
    const match = classify(d);
    if (!match) continue;
    // Skip if already at this slug (idempotent)
    if (normalizeParent(d.modality) === normalizeParent(match.slug)) continue;
    const idx = proposals.length;
    proposals.push({
      id: d.id,
      asset: d.asset_name ?? '(unnamed)',
      from: d.modality ?? '(empty)',
      to: match.slug,
      rule: match.label,
    });
    dealIdToIdx.set(d.id, idx);
    slugCounts.set(match.slug, (slugCounts.get(match.slug) ?? 0) + 1);
  }

  if (WITH_CLAUDE) {
    console.log(`\nRunning Claude Haiku 4.5 on ${eligible.length} eligible deals (concurrency 5)...`);
    const claudeStart = Date.now();
    const claudeProposals = await runClaudeBatch(eligible, 5);
    const elapsedSec = ((Date.now() - claudeStart) / 1000).toFixed(1);
    console.log(`Claude pass complete in ${elapsedSec}s — ${claudeProposals.length} proposals.`);

    for (const cp of claudeProposals) {
      const existingIdx = dealIdToIdx.get(cp.id);
      const proposal = {
        id: cp.id,
        asset: cp.asset,
        from: cp.from,
        to: cp.to,
        rule: `Claude/${cp.confidence}: ${cp.reason}`,
      };
      if (existingIdx !== undefined) {
        // Claude overrides the rule pick (more context-aware).
        const prevSlug = proposals[existingIdx].to;
        if (prevSlug !== cp.to) {
          slugCounts.set(prevSlug, Math.max(0, (slugCounts.get(prevSlug) ?? 0) - 1));
          slugCounts.set(cp.to, (slugCounts.get(cp.to) ?? 0) + 1);
        }
        proposals[existingIdx] = proposal;
      } else {
        const idx = proposals.length;
        proposals.push(proposal);
        dealIdToIdx.set(cp.id, idx);
        slugCounts.set(cp.to, (slugCounts.get(cp.to) ?? 0) + 1);
      }
    }
  }

  console.log(`\n=== Proposals: ${proposals.length} deals would be retagged ===`);
  if (proposals.length === 0) {
    console.log('No matches. Exiting.');
    return;
  }

  console.log('\nBreakdown by target slug:');
  const sorted = Array.from(slugCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of sorted) {
    console.log(`  ${slug.padEnd(24)} ${count}`);
  }

  console.log('\nSample proposals (first 40):');
  for (const p of proposals.slice(0, 40)) {
    console.log(`  [${p.rule}] ${p.asset.slice(0, 50).padEnd(52)} ${p.from.padEnd(20)} -> ${p.to}`);
  }

  const residualRate = 1 - proposals.length / eligible.length;
  console.log(`\nResidual rate: ${(residualRate * 100).toFixed(1)}% of eligible deals stayed on their coarse parent slug.`);

  if (!APPLY) {
    console.log('\nDry-run only — no changes made. Re-run with --apply to write.');
    return;
  }

  console.log('\nApplying changes...');
  let ok = 0;
  let fail = 0;
  // Batch-update — Supabase doesn't support array-of-updates so do per-row.
  // At 300+ deals this takes a few seconds; acceptable for a one-shot.
  for (const p of proposals) {
    const { error: updateError } = await supabase
      .from('deals')
      .update({ modality: p.to })
      .eq('id', p.id);
    if (updateError) {
      console.error(`  FAIL ${p.id}: ${updateError.message}`);
      fail += 1;
    } else {
      ok += 1;
    }
  }

  console.log(`\nApplied: ${ok} / ${proposals.length} updates succeeded. Failures: ${fail}.`);
  console.log('Next step: re-run `npx tsx scripts/run-engine-backtest.ts` to measure R20 delta,');
  console.log('then append the round-number entry to docs/calibration-iteration-log.md.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
