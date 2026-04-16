/**
 * Rewrite-only pass: regenerate subject + body for all 100 contacts
 * in /tmp/apr14-outreach/final.jsonl using the corrected voice
 * (no engine/backtest/calibration/corpus jargon).
 *
 * Reads: /tmp/apr14-outreach/final.jsonl
 * Writes: /tmp/apr14-outreach/final_v2.jsonl
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const DELAY_MS = 350;

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

const SEGMENT_VOICE: Record<Rec['segment'], string> = {
  'BD Executive':
    'Senior BD at a biotech in active partnering mode. Speak as a peer dealmaker. They live inside comp sets and counterparty playbooks.',
  'Licensing/Alliances':
    'Runs alliance/licensing for a partnered biotech. Manages live pharma relationships. Needs counterparty intel + comparable-deal benchmarks for renegotiation cycles.',
  'Corp Dev':
    'Evaluates inbound/outbound deals for a serial acquirer. Builds deal committee decks. Needs benchmarks they can defend in a valuation conversation.',
  'Founder/CEO':
    'Founder/CEO. Wants to know what their lead asset is worth before the next pharma conversation. Buys intelligence and advisory, not software.',
};

function entryKey(ep: string): 'pro' | 'report' | 'advisory' {
  if (ep.toLowerCase().includes('pro')) return 'pro';
  if (ep.toLowerCase().includes('report')) return 'report';
  return 'advisory';
}

const CTA: Record<'pro' | 'report' | 'advisory', string> = {
  pro: 'Close by inviting them to a free 7-day Pro trial — frame it as "your partner pipeline pre-loaded on the platform" or similar. ONE sentence.',
  report: 'Close by pointing them to the Q1 2026 Benchmarks Report ($499) — full deal comp universe for their evaluation slate. ONE sentence.',
  advisory: 'Close by offering a 15-minute working session — walk through deal-readiness or counterparty positioning. NO pricing. ONE sentence.',
};

async function regen(r: Rec): Promise<{ subject: string; body: string }> {
  const ep = entryKey(r.entry_point);
  const ta = r.lead_ta || 'oncology';
  const program = `${r.lead_asset} (${r.lead_indication || 'lead asset'} · ${r.lead_phase || 'clinical-stage'} · ${r.lead_modality || 'platform'})`;

  const prompt = `Write a cold outreach email from Issa Kildani (Founder, Ambrosia Ventures) to a senior biopharma executive.

RECIPIENT
- ${r.first_name} ${r.last_name || ''}, ${r.title} at ${r.company}
- Segment: ${r.segment}
- Lead program: ${program}
- Specific insight to reference (paraphrase once, don't quote verbatim): ${r.program_insight}

SEGMENT CONTEXT
${SEGMENT_VOICE[r.segment]}

DEAL BENCHMARK (already on the platform, in the share link)
- Upfront range: ${r.upfront_range}
- Total deal value (median): ${r.total_deal_value}
- Therapeutic area: ${ta}

PERSONALIZED PLATFORM LINK (the comp set + counterparty view we built for this asset):
${r.share_url}

CTA: ${CTA[ep]}

VOICE: institutional, peer-to-peer, dense with specifics. A fellow dealmaker handing over proprietary work. Issa Kildani writes like a senior banker who reads ten pipeline updates a day.

HARD RULES — VIOLATING ANY OF THESE IS A FAIL:
1. Subject line: ≤ 7 words. No emoji, no exclamation, no clickbait. Reference their company, asset, or a specific number.
2. Body: 4 sentences, max 5. Tight. Each sentence carries weight.
3. First sentence MUST be a specific insight about THEIR program or its comp landscape. Not us. Not our methodology. Not "I came across".
4. NEVER mention any of these words or concepts: backtest, engine, calibrated, calibration, corpus, hit rate, accuracy band, ±35%, Round 29, 1,067 deals, our model, our valuation engine. Methodology is invisible. The platform delivers the answer.
5. Frame the share link as proprietary work we built FOR THEIR ASSET — "comp set we put together for ${r.lead_asset}" or "the deal benchmark we built for your ${r.lead_phase || ''} ${r.lead_modality || ''} program" — never "what our engine/model/system put on it".
6. Include the actual upfront range and TDV numbers — those ARE the value.
7. Reference their specific program insight once, paraphrased — proves we did the homework.
8. Close with the CTA per instruction. Sign off "— Issa".
9. BANNED phrases: excited, thrilled, happy to, feel free, let me know, hope this finds you, just wanted to, quick question, circling back, world-class, exciting, leverage, synergies, touch base.
10. No "we ran your program through X" or "we modeled" framing. Use: "we put together", "we built", "the comp set we have on", "what we're tracking on".

Return ONLY: {"subject": "...", "body": "..."}
Body uses \\n for line breaks between sentences if needed (usually one paragraph is fine).`;

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
    const t = await resp.text();
    throw new Error(`http ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const text = data.content?.[0]?.text || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no json in response');
  return JSON.parse(m[0]);
}

const BANNED_RE = /\b(backtest|calibrat|corpus|hit rate|accuracy band|round 29|1,?067 deals?|our (model|engine)|valuation engine|excited|thrilled|happy to|feel free|hope this finds|just wanted to|circling back|world.?class|leverage|synergies|touch base)\b/i;

async function main() {
  const lines = readFileSync('/tmp/apr14-outreach/final.jsonl', 'utf-8').split('\n').filter(Boolean);
  const records: Rec[] = lines.map(l => JSON.parse(l));
  const outPath = '/tmp/apr14-outreach/final_v2.jsonl';
  const done = new Set<number>();
  if (existsSync(outPath)) {
    for (const ln of readFileSync(outPath, 'utf-8').split('\n').filter(Boolean)) {
      done.add(JSON.parse(ln).num);
    }
  }

  console.log(`Rewriting ${records.length} emails (${done.size} already done)\n${'═'.repeat(70)}`);
  let ok = 0, redo = 0, fail = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (done.has(r.num)) { ok++; continue; }

    process.stdout.write(`[${i+1}/${records.length}] #${r.num} ${r.first_name} @ ${r.company}...`);

    let attempts = 0;
    let result: { subject: string; body: string } | null = null;
    while (attempts < 3) {
      attempts++;
      try {
        const cand = await regen(r);
        const combined = `${cand.subject}\n${cand.body}`;
        if (BANNED_RE.test(combined)) {
          if (attempts < 3) { redo++; process.stdout.write(' (banned-redo)'); continue; }
        }
        result = cand;
        break;
      } catch (e) {
        if (attempts >= 3) { console.log(` ✗ ${(e as Error).message.slice(0, 80)}`); fail++; break; }
        await new Promise(rs => setTimeout(rs, 1000));
      }
    }

    if (!result) continue;

    const out = { ...r, subject: result.subject, body: result.body, status: r.status === 'ok_retry' ? 'ok_retry_v2' : 'ok_v2' };
    appendFileSync(outPath, JSON.stringify(out) + '\n');
    ok++;
    console.log(` ✓ "${result.subject}"`);
    await new Promise(rs => setTimeout(rs, DELAY_MS));
  }

  console.log(`\n${'═'.repeat(70)}\nDone: ${ok} ok, ${redo} banned-redos, ${fail} fail\nOutput: ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
