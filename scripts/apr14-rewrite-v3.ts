/**
 * v3 rewrite: tight worldclass voice.
 * - 4 sentences max, ≤ 18 words each
 * - Line breaks between sentences
 * - "I" not "we"
 * - Opens with "FirstName —"
 * - No em-dash chains, no LLM prose, plain CTA
 *
 * Reads:  /tmp/apr14-outreach/final_v2.jsonl
 * Writes: /tmp/apr14-outreach/final_v3.jsonl
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const DELAY_MS = 250;

interface Rec {
  num: number;
  first_name: string;
  last_name: string | null;
  email_address: string;
  email_status: string;
  company: string;
  title: string;
  segment: 'BD Executive' | 'Licensing/Alliances' | 'Corp Dev' | 'Founder/CEO';
  entry_point: string;
  priority: string;
  lead_asset: string;
  lead_indication?: string;
  lead_phase?: string;
  lead_modality?: string;
  lead_ta?: string;
  program_insight: string;
  upfront_range: string;
  total_deal_value: string;
  share_url: string;
  subject?: string;
  body?: string;
  status: string;
}

function entryKey(ep: string): 'pro' | 'report' | 'advisory' {
  if (ep.toLowerCase().includes('pro')) return 'pro';
  if (ep.toLowerCase().includes('report')) return 'report';
  return 'advisory';
}

const CTA_LINE: Record<'pro' | 'report' | 'advisory', string> = {
  pro:
    'Open Pro for a week if you want your partner pipeline pre-loaded against it.\n\nOR\n\nPro is open for 7 days — partner pipeline pre-loaded against the comp set.',
  report:
    'Full comp universe is in the Q1 2026 Benchmarks Report ($499) if you need it for the slate.\n\nOR\n\nFull comp universe is in the Q1 Benchmarks Report ($499).',
  advisory:
    '15 minutes if useful — I can walk through where you sit against the buyer set.\n\nOR\n\nIf useful, 15 minutes to walk through deal-readiness on the asset.',
};

const FEW_SHOT_EXAMPLE_PRO = `EXAMPLE for a BD Executive on Pro entry point (this is the BAR — emulate this exact density and rhythm):

Subject: ArriVent furmonertinib — $1.9B median TDV

Matthew —

The Allist co-development is the cleanest structural model in oncology partnering this year. I built the furmonertinib comp set against it: $286M–$698M upfront, $1.9B median TDV.

Counterparty view + full benchmark: https://solidus.ambrosiaventures.co/share/VD6VuISG8Jrd

Open Pro for a week if you want your partner pipeline pre-loaded against it.

— Issa`;

const FEW_SHOT_EXAMPLE_REPORT = `EXAMPLE for a Corp Dev on Report entry point:

Subject: BioMarin ERT acquisition comps

Joshua —

The lysosomal ERT acquisition set has held a $13.4B–$21.5B upfront band across the last cycle. I pulled the comp universe for your portfolio against it: $19.3B median TDV.

Numbers your committee can defend: https://solidus.ambrosiaventures.co/share/QCehNOtHoyeP

Full comp universe is in the Q1 2026 Benchmarks Report ($499).

— Issa`;

const FEW_SHOT_EXAMPLE_ADVISORY = `EXAMPLE for a Founder/CEO on Advisory entry point:

Subject: Kenai Phase 1 — $928M median TDV

Nick —

Off-the-shelf iPSC manufacturing is the Denali playbook applied to neurology, and that's the right anchor for pricing this. I built the cell therapy comp set: $73M–$296M upfront, $928M median TDV.

Where Kenai sits in the buyer set: https://solidus.ambrosiaventures.co/share/rbwx0tYttXQw

15 minutes if useful — I can walk through where you sit against the buyer set.

— Issa`;

function exampleFor(ep: 'pro' | 'report' | 'advisory'): string {
  if (ep === 'pro') return FEW_SHOT_EXAMPLE_PRO;
  if (ep === 'report') return FEW_SHOT_EXAMPLE_REPORT;
  return FEW_SHOT_EXAMPLE_ADVISORY;
}

const SEGMENT_HOOK_GUIDE: Record<Rec['segment'], string> = {
  'BD Executive':
    'Hook on a structural detail of THEIR specific deal/program (partner choice, IP angle, indication selection). They live inside this — flatter the choice, do not generic-praise the company.',
  'Licensing/Alliances':
    'Hook on the dynamics of an existing pharma relationship or upcoming renegotiation cycle. They manage live partners — reference the active relationship.',
  'Corp Dev':
    'Hook on a comparable transaction or buyer-side dynamic in their TA. They build deal committee decks — speak in committee-defensible facts.',
  'Founder/CEO':
    'Hook on a strategic positioning insight — what makes their asset different, who the most likely buyer is, what the manufacturing/IP edge means for pricing. Pre-partnering posture.',
};

async function regen(r: Rec): Promise<{ subject: string; body: string }> {
  const ep = entryKey(r.entry_point);
  const ta = r.lead_ta || 'oncology';

  const prompt = `You are writing a cold outreach email from Issa Kildani (Founder, Ambrosia Ventures) to a senior biopharma executive. Issa is a peer dealmaker — institutional, terse, dense with specifics. Treat this email as if every extra word costs you the reply.

RECIPIENT
- ${r.first_name} ${r.last_name || ''}, ${r.title} at ${r.company}
- Segment: ${r.segment}
- Lead program: ${r.lead_asset} (${r.lead_indication || ''} · ${r.lead_phase || ''} · ${r.lead_modality || ''} · ${ta})
- Specific program insight (paraphrase ONCE, naturally — never quote verbatim): ${r.program_insight}

NUMBERS (already on the platform, in the share link)
- Upfront range: ${r.upfront_range}
- Total deal value (median): ${r.total_deal_value}

PERSONALIZED PLATFORM LINK: ${r.share_url}

SEGMENT HOOK GUIDE: ${SEGMENT_HOOK_GUIDE[r.segment]}

${exampleFor(ep)}

═══ HARD STRUCTURAL RULES ═══
Match the example above EXACTLY in structure, density, and rhythm. Specifically:

1. Subject: ≤ 7 words. Pattern: "{Company or Asset} — {one specific number or label}". No emojis.
2. Body: 4 short sentences MAX, each ≤ 18 words. Line breaks BETWEEN every sentence (blank line). Each sentence stands alone — no chained clauses.
3. Open with: "${r.first_name} —" on its own line, then a blank line, then sentence one.
4. Sentence 1 (the hook): ONE specific structural insight per the segment hook guide. Reference the program/partner/indication by name. No "puts it in", "sits in", "where economics run".
5. Sentence 2 (the deliver): "I built [the comp set / a benchmark] for [asset]: $X–$Y upfront, $Z median TDV." Use the exact numbers above. Use "I" not "we".
6. Then a SEPARATE LINE with the link, formatted as "Counterparty view + full benchmark: ${r.share_url}" or "Where [Company] sits in the buyer set: ${r.share_url}" or "Numbers your committee can defend: ${r.share_url}".
7. Sentence 4 (the CTA): match the example for ${ep} entry point. Plain language. No "Activate", "Start", "Unlock", "Discover".
8. Sign off: "— Issa" on its own line. NOTHING after.

═══ BANNED ENTIRELY ═══
- Em-dash chains (more than ONE "—" per sentence)
- "we" / "our" — use "I" / "the platform" instead
- "puts it in", "sits in", "narrow peer group", "where X run wide", "skews toward", "consistently command", "materially higher", "narrow peer group", "in current cycles", "deal corridor", "active in this space"
- "backtest", "engine", "calibrated", "corpus", "hit rate", "Round 29", "1,067 deals", "our model"
- "Activate", "Start a free", "Unlock", "Discover", "Get access", "Click below", "Looking forward"
- "excited", "thrilled", "happy to", "feel free", "let me know", "hope this finds", "circling back", "world-class", "leverage", "synergies", "touch base"
- Methodology talk of any kind
- Multi-paragraph dense prose
- More than ONE em-dash per sentence
- Words like "robust", "comprehensive", "best-in-class", "premium", "valuable"

═══ VOICE CHECK ═══
A senior banker reads ten pipeline updates a day. They will scroll past anything that looks like marketing copy. Write so that even the laziest skim conveys: (1) you know their deal, (2) here are the numbers, (3) here's the link, (4) here's the ask.

Return ONLY: {"subject": "...", "body": "..."}
Body uses \\n for line breaks. Use TWO \\n (blank line) between sentences.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`http ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  }
  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no json');
  return JSON.parse(m[0]);
}

const BANNED_RE = /\b(backtest|calibrat|corpus|hit rate|round 29|1,?067 deals?|our (model|engine)|valuation engine|excited|thrilled|happy to|feel free|hope this finds|just wanted to|circling back|world.?class|leverage|synergies|touch base|puts it in|sits in|narrow peer group|skews toward|consistently command|materially higher|deal corridor|activate a|start a free|unlock|robust|comprehensive|best.in.class|looking forward|Issa Kildani|Ambrosia Ventures)\b/i;

function validate(cand: { subject: string; body: string }, firstName: string): { ok: boolean; reason?: string } {
  if (BANNED_RE.test(cand.subject + '\n' + cand.body)) {
    return { ok: false, reason: 'banned phrase' };
  }
  // Subject ≤ 7 words
  const sw = cand.subject.trim().split(/\s+/).length;
  if (sw > 8) return { ok: false, reason: `subject ${sw} words` };
  // Must open with "FirstName —" or "FirstName,"
  if (!new RegExp(`^${firstName}\\s*[—,]`).test(cand.body.trim())) {
    return { ok: false, reason: 'missing first-name open' };
  }
  // Count "we" / "our" — at most 0
  if (/\b(we|our)\b/i.test(cand.body)) return { ok: false, reason: 'uses we/our' };
  // Body word count ≤ 130
  const bw = cand.body.split(/\s+/).filter(Boolean).length;
  if (bw > 140) return { ok: false, reason: `body ${bw} words` };
  // Must end with "— Issa" exactly (allow trailing whitespace)
  if (!/—\s*Issa\s*$/.test(cand.body.trim())) return { ok: false, reason: 'missing — Issa close' };
  // No line should have more than ONE em-dash
  const lines = cand.body.split('\n');
  for (const ln of lines) {
    const dashes = (ln.match(/—/g) || []).length;
    if (dashes > 1) return { ok: false, reason: 'multi em-dash line' };
  }
  return { ok: true };
}

async function main() {
  const lines = readFileSync('/tmp/apr14-outreach/final_v2.jsonl', 'utf-8').split('\n').filter(Boolean);
  const records: Rec[] = lines.map(l => JSON.parse(l));
  const outPath = '/tmp/apr14-outreach/final_v3.jsonl';
  const done = new Set<number>();
  if (existsSync(outPath)) {
    for (const ln of readFileSync(outPath, 'utf-8').split('\n').filter(Boolean)) {
      done.add(JSON.parse(ln).num);
    }
  }

  console.log(`v3 rewrite: ${records.length} emails, ${done.size} already done\n${'═'.repeat(70)}`);
  let ok = 0, redo = 0, fail = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (done.has(r.num)) { ok++; continue; }
    process.stdout.write(`[${i+1}/${records.length}] #${r.num} ${r.first_name} @ ${r.company}...`);

    let result: { subject: string; body: string } | null = null;
    let lastReason = '';
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const cand = await regen(r);
        const v = validate(cand, r.first_name);
        if (v.ok) { result = cand; break; }
        lastReason = v.reason || 'unknown';
        if (attempt < 4) { redo++; process.stdout.write(` (redo:${lastReason})`); }
      } catch (e) {
        lastReason = (e as Error).message.slice(0, 60);
        if (attempt < 4) { process.stdout.write(` (err:${lastReason})`); await new Promise(rs => setTimeout(rs, 1000)); }
      }
    }
    if (!result) { console.log(` ✗ ${lastReason}`); fail++; continue; }

    const out = { ...r, subject: result.subject, body: result.body, status: r.status === 'ok_retry' || r.status === 'ok_retry_v2' ? 'ok_retry_v3' : 'ok_v3' };
    appendFileSync(outPath, JSON.stringify(out) + '\n');
    ok++;
    console.log(` ✓ "${result.subject}"`);
    await new Promise(rs => setTimeout(rs, DELAY_MS));
  }

  console.log(`\n${'═'.repeat(70)}\nDone: ${ok} ok, ${redo} redos, ${fail} failed\nOutput: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
