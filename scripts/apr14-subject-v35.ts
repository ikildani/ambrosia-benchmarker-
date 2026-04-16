/**
 * v3.5 subject-only rewrite. Distributes 4 patterns across 100 contacts
 * to break the "{Asset} — ${X} median TDV" template trap.
 *
 * Patterns (rotated by num % 4):
 *   0 = provocative claim     ("Furmonertinib priced too low")
 *   1 = curiosity gap         ("What Allist paid for furmonertinib")
 *   2 = name-led personal     ("Matthew, your furmonertinib comp")
 *   3 = specific-detail       ("ArriVent's PACC moat → $698M")
 *
 * Reads:  /tmp/apr14-outreach/final_v3.jsonl + final_v2.jsonl (fallback)
 * Writes: /tmp/apr14-outreach/final_v35.jsonl (full record + new subject)
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const DELAY_MS = 200;

interface Rec {
  num: number;
  first_name: string;
  last_name: string | null;
  email_address: string;
  email_status: string;
  company: string;
  title: string;
  segment: string;
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

const PATTERN_SPECS = [
  // 0 — provocative claim
  {
    name: 'provocative',
    instruction: `PATTERN: provocative claim. Make a sharp opinion-stated claim about the asset, valuation, or market position. ≤ 6 words.
EXAMPLES:
  "Furmonertinib priced too low"
  "$21.5B is the new ERT ceiling"
  "Off-the-shelf doesn't price like Denali yet"
  "ADCs are mispriced in HER2-low"
  "Spinraza set the ASO floor"`,
  },
  // 1 — curiosity gap
  {
    name: 'curiosity',
    instruction: `PATTERN: curiosity gap. Tease an answer without giving it. Use partial info or a question. ≤ 6 words.
EXAMPLES:
  "What Allist paid for furmonertinib"
  "Where committee will push back"
  "Before your next pharma meeting"
  "The number Vertex will counter with"
  "What we found in the comp set"`,
  },
  // 2 — name-led personal
  {
    name: 'name-led',
    instruction: `PATTERN: name-led personal. Open with the recipient's first name + ONE concrete reference. ≤ 7 words.
EXAMPLES:
  "Matthew, your furmonertinib comp"
  "Joshua, the BioMarin number for committee"
  "Nick, where Kenai sits in buyer set"
  "Christa, the deucrictibant ceiling"`,
  },
  // 3 — specific-detail
  {
    name: 'specific-detail',
    instruction: `PATTERN: specific-detail with arrow or colon. Pair a structural detail with a number using → or :. ≤ 6 words.
EXAMPLES:
  "ArriVent PACC moat → $698M upfront"
  "Allist co-dev → $1.9B TDV"
  "PACC selectivity: $698M ceiling"
  "Off-the-shelf manufacturing → $928M"`,
  },
];

async function regenSubject(r: Rec, patternIdx: number): Promise<string> {
  const spec = PATTERN_SPECS[patternIdx];
  const taLabel = r.lead_ta || 'oncology';

  const prompt = `Write ONE worldclass cold email subject line for outreach to a senior biopharma executive.

CONTEXT:
- Recipient: ${r.first_name} ${r.last_name || ''}, ${r.title} at ${r.company}
- Segment: ${r.segment}
- Lead asset: ${r.lead_asset}
- Lead program: ${r.lead_indication || ''} ${r.lead_phase || ''} ${r.lead_modality || ''} ${taLabel}
- Specific insight: ${r.program_insight}
- Numbers from comp set: upfront ${r.upfront_range}, median total deal value ${r.total_deal_value}

${spec.instruction}

HARD RULES:
1. Subject must follow the pattern above EXACTLY. Do not deviate.
2. Length must match the pattern's word limit.
3. Never use these jargon terms: "median TDV", "deal benchmarks", "comp set" (unless pattern is name-led #2 which allows "comp"), "rNPV"
4. Never use these LLM puffery words: "exciting", "transform", "unlock", "premium", "robust", "comprehensive", "best-in-class", "valuable", "leverage"
5. No emojis, no exclamation marks, no clickbait.
6. Reference the asset, partner, indication, or recipient SPECIFICALLY — not generic biotech terms.
7. The subject must reward someone who knows the space. An informed reader should think "they know our deal."

Return ONLY the subject line as plain text. No quotes. No prefix. No explanation.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) throw new Error(`http ${resp.status}`);
  const data = await resp.json();
  const text = (data.content?.[0]?.text || '').trim();
  // Strip surrounding quotes if present
  return text.replace(/^["'`]|["'`]$/g, '').trim();
}

const SUBJECT_BANNED = /\b(median TDV|TDV|rNPV|exciting|transform|unlock|premium acquisition|robust|comprehensive|best.in.class|leverage|synergies)\b/i;

function validateSubject(s: string, firstName: string, patternIdx: number): { ok: boolean; reason?: string } {
  const wc = s.split(/\s+/).filter(Boolean).length;
  const max = patternIdx === 2 ? 7 : 6;
  if (wc > max) return { ok: false, reason: `${wc}w > ${max}` };
  if (wc < 3) return { ok: false, reason: 'too short' };
  if (SUBJECT_BANNED.test(s)) return { ok: false, reason: 'banned' };
  if (/[!?]$/.test(s)) return { ok: false, reason: 'punctuation' };
  if (/^["']|["']$/.test(s)) return { ok: false, reason: 'quoted' };
  if (patternIdx === 2 && !s.toLowerCase().startsWith(firstName.toLowerCase())) {
    return { ok: false, reason: 'name-led missing name' };
  }
  return { ok: true };
}

async function main() {
  // Merge v3 (preferred) + v2 (fallback) for full record set
  const v3Lines = readFileSync('/tmp/apr14-outreach/final_v3.jsonl', 'utf-8').split('\n').filter(Boolean);
  const v2Lines = readFileSync('/tmp/apr14-outreach/final_v2.jsonl', 'utf-8').split('\n').filter(Boolean);
  const v3Map = new Map<number, Rec>();
  const v2Map = new Map<number, Rec>();
  for (const l of v3Lines) { const r = JSON.parse(l) as Rec; v3Map.set(r.num, r); }
  for (const l of v2Lines) { const r = JSON.parse(l) as Rec; v2Map.set(r.num, r); }

  const merged: Rec[] = [];
  for (let n = 1; n <= 100; n++) {
    const r = v3Map.get(n) || v2Map.get(n);
    if (r) merged.push(r);
  }

  const outPath = '/tmp/apr14-outreach/final_v35.jsonl';
  const done = new Set<number>();
  if (existsSync(outPath)) {
    for (const ln of readFileSync(outPath, 'utf-8').split('\n').filter(Boolean)) {
      done.add(JSON.parse(ln).num);
    }
  }

  console.log(`v3.5 subject rewrite: ${merged.length} contacts (${done.size} already done)\n${'═'.repeat(70)}`);
  let ok = 0, fail = 0;
  const patternCounts: Record<string, number> = { provocative: 0, curiosity: 0, 'name-led': 0, 'specific-detail': 0 };

  for (let i = 0; i < merged.length; i++) {
    const r = merged[i];
    if (done.has(r.num)) { ok++; continue; }
    const patternIdx = (r.num - 1) % 4;
    const patternName = PATTERN_SPECS[patternIdx].name;
    process.stdout.write(`[${i+1}/${merged.length}] #${r.num} ${r.first_name} (${patternName})...`);

    let subject: string | null = null;
    let lastReason = '';
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const cand = await regenSubject(r, patternIdx);
        const v = validateSubject(cand, r.first_name, patternIdx);
        if (v.ok) { subject = cand; break; }
        lastReason = v.reason || 'unknown';
        if (attempt < 4) process.stdout.write(` (${lastReason})`);
      } catch (e) {
        lastReason = (e as Error).message.slice(0, 50);
        if (attempt < 4) await new Promise(rs => setTimeout(rs, 800));
      }
    }
    if (!subject) {
      console.log(` ✗ ${lastReason} → keeping old: "${r.subject}"`);
      subject = r.subject || '';
      fail++;
    }

    const out = { ...r, subject, subject_pattern: patternName, status: r.status + '_subj35' };
    appendFileSync(outPath, JSON.stringify(out) + '\n');
    patternCounts[patternName]++;
    ok++;
    console.log(` ✓ "${subject}"`);
    await new Promise(rs => setTimeout(rs, DELAY_MS));
  }

  console.log(`\n${'═'.repeat(70)}\nDone: ${ok} ok, ${fail} fallback to old\nPattern distribution: ${JSON.stringify(patternCounts)}\nOutput: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
