/**
 * Flagged-row rescue from the verifier's own notes. Under the old rules a
 * real deal was flagged for a date gap, a per-program total or a vague asset
 * name; the note usually states the deal exists and often states the
 * corrected figure. This pass reads ONLY the stored note (no web search) with
 * Opus and promotes rows whose note is unambiguous, writing the corrections
 * the note contains. Anything else is left flagged for the web retry.
 *
 *   npx tsx scripts/reclassify-flagged-from-notes.ts                 # dry run on --limit rows, prints the diff
 *   npx tsx scripts/reclassify-flagged-from-notes.ts --limit 500 --apply
 *
 * Skips: auto-flagged outliers, "TA auto-classified" notes (not a verification),
 * notes that say no evidence / does not exist / fabricated.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { appendVerificationNote } from '../lib/ingestion/deal-verifier';

interface Args { apply: boolean; limit: number; parallel: number }
function parseArgs(argv: string[]): Args {
  const a: Args = { apply: false, limit: 40, parallel: 4 };
  for (let i = 0; i < argv.length; i++) { const t = argv[i]; if (t === '--apply') a.apply = true; else if (t === '--limit') a.limit = Number(argv[++i]); else if (t === '--parallel') a.parallel = Number(argv[++i]) || 4; }
  return a;
}

interface Row { id: string; licensor_name: string; licensee_name: string; asset_name: string | null; upfront_usd: number | null; total_deal_value_usd: number | null; milestones_total_usd: number | null; announced_date: string | null; phase_at_signing: string | null; verification_notes: string; confidence_score: number | null }
interface Verdict { promote: boolean; confidence: number; reason: string; corrected_upfront: number | null; corrected_value: number | null; corrected_milestones: number | null; corrected_date: string | null; corrected_phase: string | null; corrected_asset_name: string | null }

const SKIP = /auto-flagged|auto-classified|no evidence|does not exist|not exist|fabricat|could not find|cannot find|no record/i;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 60_000 });
  const { data, error } = await sb.from('deals')
    .select('id, licensor_name, licensee_name, asset_name, upfront_usd, total_deal_value_usd, milestones_total_usd, announced_date, phase_at_signing, verification_notes, confidence_score')
    .eq('verification_status', 'flagged').eq('is_synthetic', false).not('is_canonical', 'is', false)
    .not('verification_notes', 'is', null)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(args.limit * 2);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Row[]).filter(r => !SKIP.test(r.verification_notes)).slice(0, args.limit);
  console.log(`${rows.length} candidate flagged rows (notes not auto/negative); apply=${args.apply}`);

  let promoted = 0, kept = 0, failed = 0; const samples: string[] = [];
  let i = 0;
  const worker = async () => {
    while (i < rows.length) {
      const r = rows[i++];
      try {
        const res = await anthropic.messages.create({
          model: 'claude-opus-4-6', max_tokens: 400,
          system: 'You re-read a biopharma deal verifier note and decide whether the deal should now count as verified. Return ONLY valid JSON.',
          messages: [{ role: 'user', content: `Database record: ${JSON.stringify({ licensor: r.licensor_name, licensee: r.licensee_name, asset: r.asset_name, upfront_usd: r.upfront_usd, total_usd: r.total_deal_value_usd, milestones_usd: r.milestones_total_usd, announced: r.announced_date, phase: r.phase_at_signing })}

Verifier note written earlier from a web search: """${r.verification_notes.slice(0, 1500)}"""

Current rule: a deal is VERIFIED when the note confirms it exists between these two companies and the money is settled (upfront within 15% of the web figure, or the note states the correct upfront). A wrong announced date (any gap), a per-program vs aggregate total, a vague or wrong asset name, imprecise indication wording or a wrong stage are CORRECTIONS, not grounds to stay flagged. Stay flagged when the note says the companies differ, the money is disputed by more than 30% with no primary source, or the note is not about verification.

Respond with JSON: { "promote": boolean, "confidence": number (0-100), "reason": string, "corrected_upfront": number | null (USD), "corrected_value": number | null (USD, whole deal), "corrected_milestones": number | null (USD), "corrected_date": "YYYY-MM-DD" | null, "corrected_phase": "discovery"|"preclinical"|"phase_1"|"phase_2"|"phase_3"|"approved"|null, "corrected_asset_name": string | null }
Only fill a corrected_* field when the note states that figure.` }],
        });
        const tc = res.content[0]; const m = tc.type === 'text' ? tc.text.match(/\{[\s\S]*\}/) : null;
        if (!m) { failed++; continue; }
        const v = JSON.parse(m[0]) as Verdict;
        if (!v.promote || v.confidence < 80) { kept++; if (samples.length < 6) samples.push(`KEEP  ${r.licensor_name} → ${r.licensee_name}: ${v.reason.slice(0, 100)}`); continue; }
        promoted++;
        const patch: Record<string, unknown> = {
          verification_status: 'verified', verified: true, confidence_score: Math.max(r.confidence_score ?? 0, v.confidence),
          verification_notes: appendVerificationNote(r.verification_notes, `re-read under Sep 2026 rules (note only): promoted, ${v.confidence}%: ${v.reason.slice(0, 200)}`),
          updated_at: new Date().toISOString(),
        };
        if (v.corrected_upfront && v.corrected_upfront > 0) patch.upfront_usd = v.corrected_upfront;
        if (v.corrected_value && v.corrected_value > 0) patch.total_deal_value_usd = v.corrected_value;
        if (v.corrected_milestones && v.corrected_milestones > 0) patch.milestones_total_usd = v.corrected_milestones;
        if (v.corrected_date && /^\d{4}-\d{2}-\d{2}$/.test(v.corrected_date) && v.corrected_date >= '2015-01-01') patch.announced_date = v.corrected_date;
        if (v.corrected_phase && ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'].includes(v.corrected_phase)) patch.phase_at_signing = v.corrected_phase;
        if (v.corrected_asset_name && v.corrected_asset_name.trim().length >= 3) patch.asset_name = v.corrected_asset_name.trim().slice(0, 200);
        if (samples.length < 12) samples.push(`PROMOTE ${r.licensor_name} → ${r.licensee_name} (${r.phase_at_signing}, $${Math.round((r.total_deal_value_usd ?? 0) / 1e6)}M): ${v.reason.slice(0, 90)}${Object.keys(patch).filter(k => k.startsWith('corrected') || ['upfront_usd', 'total_deal_value_usd', 'announced_date', 'phase_at_signing', 'asset_name'].includes(k)).length ? ' [corrections]' : ''}`);
        if (args.apply) { const { error: uErr } = await sb.from('deals').update(patch).eq('id', r.id); if (uErr) { failed++; console.error(r.id, uErr.message); } }
      } catch (e) { failed++; console.error(r.id, e instanceof Error ? e.message : e); }
    }
  };
  await Promise.all(Array.from({ length: args.parallel }, worker));
  console.log(`promoted ${promoted}, kept flagged ${kept}, failed ${failed}${args.apply ? ' (written)' : ' (dry run, nothing written)'}`);
  for (const s of samples) console.log('  ' + s);
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
