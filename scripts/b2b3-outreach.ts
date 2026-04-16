/**
 * Apr 14 Weekly Outreach Orchestrator — 100 contacts
 *
 * Pipeline per contact:
 *   1. Read enriched Apollo data (email + company description + keywords)
 *   2. Claude classifies lead program {therapeuticArea, modality, indication, phase, dealType}
 *   3. calculateDealTerms() runs the engine
 *   4. Supabase REST POST creates a share token (90-day expiry)
 *   5. Claude composes a subject + body tailored to (segment × entry_point)
 *   6. Append result to /tmp/apr14-b2b3/final.jsonl
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/apr14-outreach.ts [--limit N] [--start I]
 */

import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs';
import {
  calculateDealTerms,
  formatCurrency,
  type CalculationInput,
  type Phase,
  type DealType,
  type Modality,
  type Indication,
  type TherapeuticArea,
} from '../lib/calculations';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHARE_OWNER_ID = process.env.SHARE_OWNER_USER_ID || '';
const BASE_URL = 'https://calculator.ambrosiaventures.co';
const BATCH_DELAY_MS = 350;

const args = process.argv.slice(2);
const argLimit = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1], 10) : null;
})();
const argStart = (() => {
  const i = args.indexOf('--start');
  return i >= 0 ? parseInt(args[i + 1], 10) : 0;
})();

interface SrcContact {
  num: number;
  first_name: string;
  company: string;
  title: string;
  segment: 'BD Executive' | 'Licensing/Alliances' | 'Corp Dev' | 'Founder/CEO';
  entry_point: string;
  intent: string;
  priority: 'A' | 'B' | 'C';
  apollo_id: string;
}

interface ApolloRecord {
  apollo_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  email_status: string;
  linkedin_url: string | null;
  seniority: string | null;
  company_name: string | null;
  company_domain: string | null;
  company_description: string | null;
  company_keywords: string[] | null;
  company_ticker: string | null;
}

interface LeadProgram {
  therapeuticArea: TherapeuticArea;
  modality: Modality;
  indication: Indication;
  phase: Phase;
  dealType: DealType;
  leadAssetName: string;
  programInsight: string;
}

const VALID_TAS: TherapeuticArea[] = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
];

function entryPointKey(ep: string): 'pro' | 'report' | 'advisory' {
  if (ep.toLowerCase().includes('pro')) return 'pro';
  if (ep.toLowerCase().includes('report')) return 'report';
  return 'advisory';
}

/* ─── Claude: classify lead program ───────────────────────────────── */

async function classifyProgram(c: SrcContact, a: ApolloRecord): Promise<LeadProgram | null> {
  const prompt = `You are a biopharma BD analyst. Classify the most likely lead clinical program for the company below.

COMPANY: ${a.company_name || c.company}
DESCRIPTION: ${a.company_description || ''}
KEYWORDS: ${(a.company_keywords || []).slice(0, 20).join(', ')}
TICKER: ${a.company_ticker || 'private'}
EXEC SIGNAL: ${c.intent}

Return ONLY a JSON object with these exact fields. Use the lowercased camelCase enum values exactly.

{
  "therapeuticArea": one of: ${VALID_TAS.join(', ')},
  "modality": one of: smallMolecule, mab, adc, bispecific, tCellEngager, carT_heme, carT_solid, cellTherapy, geneTherapy, radiopharmaceutical, mrna, rnai, protac, molecularGlue, peptide, therapeuticVaccine, oncolyticVirus, glp1Agonist, dualIncretin, antiViral, vaccinePreventive, enzymeReplacement, geneTherapyRare, btki, il17Inhibitor, il13Inhibitor, fcrnAntagonist, complementInhibitor, jakInhibitor, antiTl1a, gnrhAntagonist, neuroactiveSteroid, antiVegf, geneTherapyOcular, oligonucleotide, aso, carT_autoimmune, carTreg,
  "indication": short slug e.g. "lung_nsclc", "breast_her2", "alzheimers", "obesity", "rheumatoidArthritis", "heredAngioedema", "myeloma", "dmd", "pku", "sickleCell", "ckdMetabolic", "ibd_broad",
  "phase": one of: discovery, preclinical, phase1, phase1_2, phase2, phase2_3, phase3, nda_filed, approved,
  "dealType": one of: licensing, acquisition, codevelopment, option, collaboration,
  "leadAssetName": the actual drug code/name if found in description, or "lead asset" if unknown,
  "programInsight": ONE sentence (max 22 words) calling out something specific and verifiable about this program — partner, mechanism, recent readout, regulatory milestone — that proves we did our homework.
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const result = JSON.parse(match[0]) as LeadProgram;
    if (!VALID_TAS.includes(result.therapeuticArea)) result.therapeuticArea = 'oncology';
    return result;
  } catch (e) {
    console.error('  classify err:', (e as Error).message);
    return null;
  }
}

/* ─── Share link via Supabase REST ────────────────────────────────── */

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function createShareLink(
  input: CalculationInput,
  result: Record<string, unknown>,
  labels: { phase: string; modality: string; indication: string },
  company: string,
  recipient: string,
): Promise<string | null> {
  const token = generateToken();
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/shared_calculations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        share_token: token,
        user_id: SHARE_OWNER_ID || null,
        email: 'issa@ambrosiaventures.co',
        inputs: input,
        results: result,
        labels: { ...labels, company, recipient },
        is_public: true,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`  share http ${resp.status}: ${txt.slice(0, 200)}`);
      return null;
    }
    return `${BASE_URL}/share/${token}`;
  } catch (e) {
    console.error('  share err:', (e as Error).message);
    return null;
  }
}

/* ─── Email generation: segment × entry-point archetypes ──────────── */

const SEGMENT_VOICE: Record<SrcContact['segment'], string> = {
  'BD Executive':
    'Recipient is a VP/SVP/Director of Business Development at a biotech actively in deal-making mode. They live inside rNPV and counterparty playbooks. Speak as a peer dealmaker.',
  'Licensing/Alliances':
    'Recipient runs alliance/licensing for an existing pharma-partnered biotech. They manage 1+ active partner relationships and need counterparty intelligence + deal benchmarks for renegotiation cycles.',
  'Corp Dev':
    'Recipient evaluates inbound/outbound deals for a serial acquirer or specialty pharma. They build deal committee decks. They need rNPV + Monte Carlo + comparable-deal benchmarks to defend valuations.',
  'Founder/CEO':
    'Recipient is a founder/CEO. They need to know what their lead asset is worth before the next pharma conversation. They will not buy software — they buy intelligence and advisory.',
};

const ENTRY_CTA: Record<'pro' | 'report' | 'advisory', string> = {
  pro: 'Close by inviting them to a free 7-day Pro trial — frame it as "your partner pipeline pre-loaded".',
  report: 'Close by pointing them to the Q1 2026 Benchmarks Report ($499) — full deal comps for their evaluation slate.',
  advisory: 'Close by offering a 15-minute working session — walk through the deal-readiness framework before their first pharma conversation. No pricing mentioned.',
};

const ENGINE_CALIBRATION_LINE =
  'Our backtest engine just hit Round 29 — calibrated against a 1,067-deal corpus, oncology hit rate now ~20% within ±35% (up from 6.9% in February).';

async function generateEmail(
  c: SrcContact,
  a: ApolloRecord,
  p: LeadProgram,
  shareUrl: string,
  upfrontRange: string,
  totalDealValue: string,
): Promise<{ subject: string; body: string }> {
  const ep = entryPointKey(c.entry_point);
  const taLabel = p.therapeuticArea.replace(/([A-Z])/g, ' $1').toLowerCase().trim();

  const prompt = `Write a cold outreach email from Issa Kildani (Founder, Ambrosia Ventures) to a senior biopharma professional.

RECIPIENT:
- ${c.first_name} ${a.last_name || ''}, ${c.title} at ${a.company_name || c.company}
- Segment: ${c.segment}
- Lead program: ${p.leadAssetName} (${p.indication}, ${p.phase}, ${p.modality})
- Specific insight to reference: ${p.programInsight}

SEGMENT CONTEXT:
${SEGMENT_VOICE[c.segment]}

CALIBRATED DATA POINT TO INCLUDE NATURALLY:
${ENGINE_CALIBRATION_LINE}

DEAL BENCHMARK FOR THEIR PROGRAM (we already ran the engine on it):
- Upfront range: ${upfrontRange}
- Total deal value (median): ${totalDealValue}
- TA: ${taLabel}, Phase: ${p.phase}, Modality: ${p.modality}

PERSONALIZED SHARE LINK (already generated, contains the full rNPV + counterparty view): ${shareUrl}

CTA INSTRUCTION: ${ENTRY_CTA[ep]}

RULES:
1. Subject: ≤ 7 words, no emoji, no exclamation. Reference their company OR lead asset OR a specific number. Examples: "ArriVent furmonertinib — comp set we ran" or "${a.company_name || c.company} rNPV at ${p.phase}".
2. Body: 4–6 short sentences, no preamble. First sentence MUST be a specific fact/number — never "I hope this finds you well" or "I came across".
3. Reference their actual lead asset and the program insight verbatim or paraphrased once.
4. Embed the share link as a natural sentence — "Here's what our engine put on it: ${shareUrl}" or similar.
5. Slip in the calibration line ONCE without making it sound like marketing — frame it as why the number is defensible.
6. Close with the CTA per the instruction above. Sign off "— Issa".
7. NEVER use: excited, thrilled, happy to, feel free, let me know, hope this finds you, just wanted to, quick question, circling back.
8. Tone: institutional, peer-to-peer, dense with specifics. A fellow dealmaker handing over proprietary work.

Return ONLY: {"subject": "...", "body": "..."}
Body uses \\n for line breaks.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) return fallback(c, a, p, shareUrl, upfrontRange);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback(c, a, p, shareUrl, upfrontRange);
    return JSON.parse(match[0]);
  } catch {
    return fallback(c, a, p, shareUrl, upfrontRange);
  }
}

function fallback(c: SrcContact, a: ApolloRecord, p: LeadProgram, url: string, upfront: string) {
  const ep = entryPointKey(c.entry_point);
  const cta =
    ep === 'pro'
      ? 'Free 7-day Pro trial if useful — your pipeline pre-loaded.'
      : ep === 'report'
        ? 'Full comp set is in the Q1 2026 Benchmarks Report ($499).'
        : '15-minute working session if useful — deal-readiness framework before the first pharma call.';
  return {
    subject: `${a.company_name || c.company} ${p.leadAssetName} — comp set`,
    body: `${c.first_name},\n\n${p.programInsight}\n\nWe ran ${p.leadAssetName} through our deal engine — upfront range ${upfront} for ${p.phase} ${p.modality} in ${p.therapeuticArea}. Calibrated against a 1,067-deal corpus.\n\nFull view (rNPV + counterparty premiums): ${url}\n\n${cta}\n\n— Issa`,
  };
}

/* ─── Main ────────────────────────────────────────────────────────── */

function loadApolloMap(): Map<string, ApolloRecord> {
  const lines = readFileSync('/tmp/apr14-b2b3/apollo_results.jsonl', 'utf-8')
    .split('\n').filter(Boolean);
  const m = new Map<string, ApolloRecord>();
  for (const ln of lines) {
    const r = JSON.parse(ln) as ApolloRecord;
    m.set(r.apollo_id, r);
  }
  return m;
}

function loadDoneIds(outPath: string): Set<number> {
  if (!existsSync(outPath)) return new Set();
  const lines = readFileSync(outPath, 'utf-8').split('\n').filter(Boolean);
  return new Set(lines.map(l => JSON.parse(l).num as number));
}

async function main() {
  const contacts: SrcContact[] = JSON.parse(readFileSync('/tmp/apr14-b2b3/contacts.json', 'utf-8'));
  const apollo = loadApolloMap();
  const outPath = '/tmp/apr14-b2b3/final.jsonl';
  const done = loadDoneIds(outPath);

  let slice = contacts.slice(argStart);
  if (argLimit) slice = slice.slice(0, argLimit);

  console.log(`\nProcessing ${slice.length} contacts (start=${argStart}, limit=${argLimit ?? 'all'}, already-done=${done.size})\n${'═'.repeat(70)}`);

  let ok = 0, errs = 0, skipped = 0;

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (done.has(c.num)) { skipped++; continue; }
    const a = apollo.get(c.apollo_id);
    if (!a || !a.email) {
      console.log(`[${i+1}/${slice.length}] #${c.num} ${c.first_name} @ ${c.company} ✗ no apollo email`);
      errs++;
      continue;
    }

    process.stdout.write(`[${i+1}/${slice.length}] #${c.num} ${c.first_name} @ ${c.company}...`);

    const p = await classifyProgram(c, a);
    if (!p) { console.log(' ✗ classify'); errs++; continue; }

    const ci: CalculationInput = {
      therapeuticArea: p.therapeuticArea,
      phase: p.phase,
      dealType: p.dealType,
      modality: p.modality,
      indication: p.indication,
      territory: 'global',
      biomarker: 'unselected',
      lineOfTherapy: '1L',
      treatmentApproach: 'diseaseModifying',
      combinationPotential: 'some',
      competitivePosition: 'firstInClass',
      dataQuality: ['phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'].includes(p.phase) ? 'strongPhase2' : 'promising',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    };

    let calc;
    try { calc = calculateDealTerms(ci); } catch (e) {
      console.log(` ✗ calc: ${(e as Error).message.slice(0, 60)}`); errs++; continue;
    }

    const labels = calc.labels as { phase: string; modality: string; indication: string };
    const upfrontRange = `${formatCurrency(calc.terms.upfront.low)}–${formatCurrency(calc.terms.upfront.high)}`;
    const totalDealValue = formatCurrency(calc.terms.totalDealValue.median);

    const shareUrl = await createShareLink(
      ci, calc as unknown as Record<string, unknown>, labels,
      a.company_name || c.company,
      `${c.first_name} ${a.last_name || ''}`.trim(),
    );
    if (!shareUrl) { console.log(' ✗ share'); errs++; continue; }

    const email = await generateEmail(c, a, p, shareUrl, upfrontRange, totalDealValue);

    const out = {
      num: c.num,
      first_name: c.first_name,
      last_name: a.last_name,
      email_address: a.email,
      email_status: a.email_status,
      company: a.company_name || c.company,
      title: c.title,
      segment: c.segment,
      entry_point: c.entry_point,
      priority: c.priority,
      lead_asset: p.leadAssetName,
      lead_indication: p.indication,
      lead_phase: p.phase,
      lead_modality: p.modality,
      lead_ta: p.therapeuticArea,
      program_insight: p.programInsight,
      upfront_range: upfrontRange,
      total_deal_value: totalDealValue,
      share_url: shareUrl,
      subject: email.subject,
      body: email.body,
      status: 'ok',
    };
    appendFileSync(outPath, JSON.stringify(out) + '\n');
    ok++;
    console.log(` ✓ ${p.leadAssetName} | "${email.subject}"`);
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`\n${'═'.repeat(70)}\nDone: ${ok} ok, ${errs} errors, ${skipped} skipped\nOutput: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
