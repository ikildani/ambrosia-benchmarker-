/**
 * Recalculate deal terms for all B2+B3 outreach contacts against the
 * new R67 + R68 engine. Updates:
 *   - /tmp/apr14-b2b3/final_recalc.jsonl (new numbers + updated body)
 *   - Supabase shared_calculations rows (so share links show new data)
 *
 * Source: /tmp/apr14-b2b3/final.jsonl (original orchestrator run with
 * old-engine params — we keep the lead program params, swap in new math).
 */

import { readFileSync, appendFileSync, existsSync } from 'fs';
import {
  calculateDealTerms,
  formatCurrency,
  type CalculationInput,
} from '../lib/calculations';

const SUPA_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OUT = '/tmp/apr14-b2b3/final_recalc.jsonl';

interface RecBody {
  num: number;
  first_name: string;
  last_name?: string | null;
  email_address?: string;
  company: string;
  title: string;
  segment: string;
  entry_point: string;
  priority?: string;
  lead_asset: string;
  lead_indication?: string;
  lead_phase?: string;
  lead_modality?: string;
  lead_ta?: string;
  program_insight?: string;
  upfront_range: string;
  total_deal_value: string;
  share_url?: string;
  subject?: string;
  body?: string;
  status?: string;
}

// Mirror the b2b3-outreach.ts orchestrator defaults so the CalculationInput
// matches what produced the original share links.
function buildInput(rec: RecBody): CalculationInput | null {
  const { lead_ta, lead_phase, lead_modality, lead_indication } = rec;
  if (!lead_ta || !lead_phase || !lead_modality || !lead_indication) return null;

  const strongPhases = ['phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'];
  return {
    therapeuticArea: lead_ta as CalculationInput['therapeuticArea'],
    phase: lead_phase as CalculationInput['phase'],
    dealType: 'licensing',  // orchestrator default
    modality: lead_modality as CalculationInput['modality'],
    indication: lead_indication as CalculationInput['indication'],
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '1L',
    treatmentApproach: 'diseaseModifying',
    combinationPotential: 'some',
    competitivePosition: 'firstInClass',
    dataQuality: strongPhases.includes(lead_phase) ? 'strongPhase2' : 'promising',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  };
}

function replaceNumbersInBody(body: string, oldUpfront: string, oldTDV: string, newUpfront: string, newTDV: string): string {
  if (!body) return body;
  let updated = body;
  // Replace exact matches of the range strings if present
  if (oldUpfront && oldUpfront !== newUpfront) {
    updated = updated.split(oldUpfront).join(newUpfront);
  }
  // Replace simpler "median" and "upfront" number patterns that may differ in formatting
  if (oldTDV && oldTDV !== newTDV) {
    updated = updated.split(oldTDV).join(newTDV);
  }
  return updated;
}

async function updateSupabase(shareUrl: string | undefined, result: unknown, inputs: CalculationInput): Promise<boolean> {
  if (!shareUrl || !SUPA_URL || !SUPA_KEY) return false;
  const token = shareUrl.split('/').pop();
  if (!token) return false;
  try {
    const resp = await fetch(`${SUPA_URL}/rest/v1/shared_calculations?share_token=eq.${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ inputs, results: result }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function main() {
  const lines = readFileSync('/tmp/apr14-b2b3/final.jsonl', 'utf-8').split('\n').filter(Boolean);
  const recs: RecBody[] = lines.map(l => JSON.parse(l));
  console.log(`Recalculating ${recs.length} records against R67+R68 engine...`);

  // Skip already-processed records on restart
  const done = new Set<number>();
  if (existsSync(OUT)) {
    for (const ln of readFileSync(OUT, 'utf-8').split('\n').filter(Boolean)) {
      done.add(JSON.parse(ln).num);
    }
  }

  let ok = 0, skipErr = 0, supaOk = 0;
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (done.has(r.num)) continue;
    const input = buildInput(r);
    if (!input) { skipErr++; continue; }

    let newUpfrontRange: string;
    let newTDV: string;
    let calcResult: any;
    try {
      calcResult = calculateDealTerms(input);
      newUpfrontRange = `${formatCurrency(calcResult.terms.upfront.low)}–${formatCurrency(calcResult.terms.upfront.high)}`;
      newTDV = formatCurrency(calcResult.terms.totalDealValue.median);
    } catch (e) {
      console.log(`  ✗ #${r.num}: ${(e as Error).message.slice(0, 60)}`);
      skipErr++;
      continue;
    }

    const oldUpfront = r.upfront_range;
    const oldTDV = r.total_deal_value;
    const newBody = replaceNumbersInBody(r.body || '', oldUpfront, oldTDV, newUpfrontRange, newTDV);

    // Update Supabase share row
    const supaUpdated = await updateSupabase(r.share_url, calcResult, input);
    if (supaUpdated) supaOk++;

    const out = {
      ...r,
      upfront_range: newUpfrontRange,
      total_deal_value: newTDV,
      upfront_range_old: oldUpfront,
      total_deal_value_old: oldTDV,
      body: newBody,
      recalc_engine: 'R67+R68',
    };
    appendFileSync(OUT, JSON.stringify(out) + '\n');
    ok++;
    if (ok % 20 === 0) {
      console.log(`  [${ok}/${recs.length}] ${r.first_name} @ ${r.company}: ${oldUpfront} → ${newUpfrontRange}, TDV ${oldTDV} → ${newTDV} (supa=${supaUpdated ? '✓' : '—'})`);
    }
  }

  console.log(`\nDone: ${ok} recalculated, ${skipErr} skipped, ${supaOk} Supabase rows updated.`);
  console.log(`Output: ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
