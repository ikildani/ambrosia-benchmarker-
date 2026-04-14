/**
 * Retag ADC (antibody-drug conjugate) sub-classes on the production corpus.
 *
 * Companion to scripts/retag-non-adc-modalities.ts. Same rule + Claude
 * pipeline, scoped to the 5 target-specific ADC sub-slugs R20 ships:
 *   adc_her2, adc_trop2, adc_claudin18_2, adc_nectin4, adc_folr1
 *
 * Eligible parent: only deals currently tagged at the coarse "adc" /
 * "antibody_drug_conjugate" / "antibodyDrugConjugate" level.
 *
 * Usage:
 *   npx tsx scripts/retag-adc-modalities.ts                   # dry-run, rules only
 *   npx tsx scripts/retag-adc-modalities.ts --with-claude     # dry-run, rules + Claude
 *   npx tsx scripts/retag-adc-modalities.ts --with-claude --apply
 *   npx tsx scripts/retag-adc-modalities.ts --limit=50
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
}

function normalizeParent(m: string | null | undefined): string {
  if (!m) return '';
  return m.toLowerCase().replace(/[_\-\s]/g, '');
}

const ELIGIBLE_PARENTS = new Set([
  'adc',
  'antibodydrugconjugate',
  'adcs',
]);

interface Rule {
  slug: string;
  label: string;
  pattern: RegExp;
}

// Target-specific ADC identifiers. Asset names (DXd, MMAE, vedotin, deruxtecan
// suffixes) and target mentions (HER2, TROP2, CLDN18.2, NECTIN4, FOLR1) give
// cleaner high-precision signals than non-ADC cases because the target is
// typically disclosed explicitly.
const RULES: Rule[] = [
  {
    slug: 'adc_her2',
    label: 'HER2 ADC',
    pattern: /\bher[- ]?2\b.*(adc|conjugate|dxd|mmae|vedotin|deruxtecan|trastuzumab)|\b(enhertu|kadcyla|t-dxd|trastuzumab deruxtecan|trastuzumab emtansine|ds-8201)\b/i,
  },
  {
    slug: 'adc_trop2',
    label: 'TROP2 ADC',
    pattern: /\btrop[- ]?2\b.*(adc|conjugate|dxd|mmae|vedotin|deruxtecan)|\b(trodelvy|sacituzumab|dato[- ]?dxd|datopotamab)\b/i,
  },
  {
    slug: 'adc_claudin18_2',
    label: 'CLDN18.2 ADC',
    pattern: /\b(claudin[- ]?18\.?2|cldn18\.?2|clnd18\.?2)\b.*(adc|conjugate)|\bzolbetuximab\b/i,
  },
  {
    slug: 'adc_nectin4',
    label: 'Nectin-4 ADC',
    pattern: /\bnectin[- ]?4\b.*(adc|conjugate)|\b(padcev|enfortumab)\b/i,
  },
  {
    slug: 'adc_folr1',
    label: 'FOLR1 ADC',
    pattern: /\b(folr1|folate receptor alpha)\b.*(adc|conjugate)|\b(elahere|mirvetuximab)\b/i,
  },
];

function classify(d: DealRow): { slug: string; label: string } | null {
  const haystack = [d.asset_name, d.mechanism_of_action].filter(Boolean).join(' | ');
  if (!haystack) return null;
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return { slug: rule.slug, label: rule.label };
  }
  return null;
}

const CLAUDE_SLUG_ENUM = [
  'adc_her2',
  'adc_trop2',
  'adc_claudin18_2',
  'adc_nectin4',
  'adc_folr1',
  'none',
] as const;

const ClaudeClassification = z.object({
  slug: z.enum(CLAUDE_SLUG_ENUM),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
});

const CLAUDE_SYSTEM_PROMPT = `You classify pharmaceutical/biotech licensing deals into target-specific ADC (antibody-drug conjugate) sub-classes.

Pick exactly one slug from this list, or "none" if no target-specific ADC sub-class fits.

Sub-class definitions:

- adc_her2: HER2-targeted ADC. Examples: Enhertu (T-DXd / trastuzumab deruxtecan, Daiichi Sankyo/AstraZeneca DS-8201), Kadcyla (trastuzumab emtansine / T-DM1), disitamab vedotin. Indications: HER2+ breast, gastric, NSCLC.
- adc_trop2: TROP2-targeted ADC. Examples: Trodelvy (sacituzumab govitecan, Gilead), Dato-DXd (datopotamab deruxtecan, AstraZeneca/Daiichi). Indications: TNBC, HR+ breast, NSCLC.
- adc_claudin18_2: Claudin-18.2 (CLDN18.2) targeted ADC. Emerging target in gastric/pancreatic. Note: zolbetuximab itself is NOT an ADC (naked antibody) — only classify explicit ADC assets targeting CLDN18.2.
- adc_nectin4: Nectin-4 targeted ADC. Example: Padcev (enfortumab vedotin, Astellas/Seagen). Indication: urothelial carcinoma.
- adc_folr1: Folate receptor alpha (FOLR1) targeted ADC. Example: Elahere (mirvetuximab soravtansine, ImmunoGen). Indication: ovarian cancer.

Rules:
- Only classify deals whose modality is already ADC. If the asset is a naked antibody, bispecific, small molecule, or other non-ADC modality, return "none".
- Confidence "high" only when the asset name OR mechanism_of_action explicitly identifies both ADC format AND the target antigen.
- "Confidence" is about how sure you are the asset is THIS target-specific ADC, not about pricing.
- Return "none" for ADCs targeting antigens outside the 5 slugs above (e.g., BCMA ADC, CD19 ADC, B7-H3 ADC, MSLN ADC — these are handled in a future round).
- Reason: cite the field that drove the decision (≤ 200 chars ideally, but longer is acceptable).`;

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
    if (parsed.confidence === 'low') return null;
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
  console.log('Fetching ADC deals from Supabase (verified, non-synthetic, upfront > 0)...');

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

  const eligible = (data as DealRow[]).filter((d) => ELIGIBLE_PARENTS.has(normalizeParent(d.modality)));
  console.log(`Eligible for ADC retag (currently tagged coarse-ADC): ${eligible.length} deals.`);

  if (eligible.length === 0) {
    console.log('\nNo deals tagged as plain ADC in the verified corpus — nothing to retag. Exiting.');
    return;
  }

  const proposals: { id: string; asset: string; from: string; to: string; rule: string }[] = [];
  const slugCounts = new Map<string, number>();
  const dealIdToIdx = new Map<string, number>();

  for (const d of eligible) {
    const match = classify(d);
    if (!match) continue;
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
    console.log(`\nRunning Claude Haiku 4.5 on ${eligible.length} eligible ADC deals (concurrency 5)...`);
    const start = Date.now();
    const claudeProposals = await runClaudeBatch(eligible, 5);
    console.log(`Claude pass complete in ${((Date.now() - start) / 1000).toFixed(1)}s — ${claudeProposals.length} proposals.`);

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
  console.log(`\nResidual rate: ${(residualRate * 100).toFixed(1)}% of eligible ADCs stayed on coarse "adc" slug.`);

  if (!APPLY) {
    console.log('\nDry-run only — no changes made. Re-run with --apply to write.');
    return;
  }

  console.log('\nApplying changes...');
  let ok = 0;
  let fail = 0;
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
  console.log('Next step: re-run `npx tsx scripts/run-deal-backtest.ts` and log ADC-activation delta.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
