/**
 * Tier 2 Outreach: Personalized share links + worldclass emails
 * for 422 contacts across 3 client types.
 *
 * For each contact:
 * 1. Claude classifies them into a client type (Founder, Investor, M&A)
 * 2. Claude identifies their company's lead program
 * 3. Calculation engine generates deal benchmarks
 * 4. Personalized share link created in Supabase
 * 5. Worldclass email generated (no pricing, hands-off)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   SHARE_OWNER_USER_ID=... npx tsx scripts/tier2-outreach.ts
 */

import { readFileSync, writeFileSync } from 'fs';
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
const BASE_URL = 'https://solidus.ambrosiaventures.co';
const BATCH_DELAY_MS = 400;

interface Contact {
  'First Name': string;
  'Last Name': string;
  Title: string;
  'Company Name': string;
  Email: string;
  Keywords: string;
  '# Employees': string;
  Industry: string;
}

interface ProfileResult {
  clientType: 'founder' | 'investor' | 'mna';
  therapeuticArea: TherapeuticArea;
  modality: Modality;
  indication: Indication;
  phase: Phase;
  dealType: DealType;
  companyContext: string;
}

const VALID_TAS: TherapeuticArea[] = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
];

/* ─── Claude: classify + profile ───────────────────────────────────── */

async function classifyAndProfile(c: Contact): Promise<ProfileResult | null> {
  const prompt = `You are a biopharma industry expert. Given this professional, determine:
1. Their client type
2. Their company's most likely lead program

Person: ${c['First Name']} ${c['Last Name']}, ${c.Title} at ${c['Company Name']}
Company size: ${c['# Employees']} employees
Industry: ${c.Industry}
Keywords: ${(c.Keywords || '').slice(0, 500)}

CLIENT TYPES:
- "founder": Founder, CEO, President, CSO, CBO at clinical-stage biotech (<500 employees). They would buy advisory mandates or deal reports.
- "investor": Works at VC, PE, family office, fund, or investment firm. They need deal intelligence for diligence.
- "mna": Works in BD, Licensing, Corporate Dev, S&E, Alliance Management, or M&A at mid-large pharma/biotech (>200 employees). They evaluate and execute deals.

If unsure, default to "mna" for BD/licensing roles, "founder" for C-suite at small companies.

Return ONLY a JSON object:
{
  "clientType": "founder" | "investor" | "mna",
  "therapeuticArea": one of: ${VALID_TAS.join(', ')},
  "modality": e.g. "smallMolecule", "adc", "mab", "bispecific", "carT_heme", "geneTherapy", "rnai", "peptide",
  "indication": e.g. "lung_nsclc", "breast_her2", "alzheimers", "obesity", "rheumatoid_arthritis",
  "phase": "discovery" | "preclinical" | "phase1" | "phase2" | "phase3" | "approved",
  "dealType": "licensing" | "acquisition" | "codevelopment" | "option" | "collaboration",
  "companyContext": "One sentence about what this company does that's relevant to deal intelligence"
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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const result = JSON.parse(match[0]) as ProfileResult;
    if (!VALID_TAS.includes(result.therapeuticArea)) result.therapeuticArea = 'oncology';
    return result;
  } catch { return null; }
}

/* ─── Share link ───────────────────────────────────────────────────── */

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function createShareLink(
  input: CalculationInput,
  result: Record<string, unknown>,
  labels: { phase: string; modality: string; indication: string },
  company: string,
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
        labels: { ...labels, company },
        is_public: true,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    if (!resp.ok) { console.error(`  Share error: ${resp.status}`); return null; }
    return `${BASE_URL}/share/${token}`;
  } catch { return null; }
}

/* ─── Email generation ─────────────────────────────────────────────── */

async function generateEmail(
  c: Contact,
  profile: ProfileResult,
  shareUrl: string,
  upfrontRange: string,
): Promise<{ subject: string; body: string }> {
  const clientPrompts: Record<string, string> = {
    founder: `They are a founder/executive at a clinical-stage biotech. They need to know what their asset is worth before engaging partners. They would benefit from deal benchmarking intelligence and potentially advisory services for out-licensing or M&A. Don't sell advisory — just deliver intelligence they can't get elsewhere. The share link shows deal benchmarks for their exact therapeutic area.`,
    investor: `They work at a life sciences investment firm. They need deal intelligence for portfolio company diligence, valuation benchmarking, and competitive landscape analysis. The share link shows deal benchmarks relevant to their investment thesis.`,
    mna: `They work in BD/Licensing/Corporate Dev at a pharma or large biotech. They evaluate and structure deals professionally. They need independent benchmarking data to validate internal models, screen partners, and build deal committee presentations. The share link shows benchmarks for their therapeutic focus.`,
  };

  const prompt = `Write a cold outreach email from Issa at Ambrosia Ventures.

RECIPIENT:
- Name: ${c['First Name']} ${c['Last Name']}
- Title: ${c.Title}
- Company: ${c['Company Name']}
- ${profile.companyContext}
- Client type: ${profile.clientType}
- ${clientPrompts[profile.clientType]}

DATA POINT: ${upfrontRange} upfront range for ${profile.phase} ${profile.modality} deals in ${profile.therapeuticArea}

PERSONALIZED LINK: ${shareUrl}

RULES:
1. Subject line: max 50 chars, no emojis, no clickbait. Reference their company or space.
2. Email body: 4-6 short sentences. First-person from "Issa".
3. NEVER mention pricing, fees, advisory costs, or dollar amounts for our services.
4. Include the personalized link naturally — frame it as proprietary intelligence we built for their space.
5. Reference a SPECIFIC insight about their company or therapeutic area — not generic.
6. End with just "Issa" as sign-off. NO offers to "walk through it", "chat", "schedule a call", or meet. Just deliver value and leave.
7. Do NOT use "excited", "thrilled", "happy to", "feel free", "let me know".
8. Tone: peer-to-peer, authoritative, concise. A fellow dealmaker sharing proprietary data.
9. Make them feel like they discovered something that gives them an edge.

Return ONLY: {"subject": "...", "body": "..."}
Body uses \\n for line breaks. End with just "Issa".`;

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

    if (!response.ok) return fallback(c, profile, shareUrl);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback(c, profile, shareUrl);
    return JSON.parse(match[0]);
  } catch { return fallback(c, profile, shareUrl); }
}

function fallback(c: Contact, p: ProfileResult, url: string) {
  return {
    subject: `${p.therapeuticArea} deal benchmarks for ${c['Company Name']}`,
    body: `${c['First Name']},\n\nWe built a deal analysis specific to ${p.therapeuticArea} — upfront ranges, comparable transactions, and partner intelligence from 1,600+ verified deals.\n\nPut this together for your space: ${url}\n\nIssa`,
  };
}

function escapeCSV(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/* ─── Main ─────────────────────────────────────────────────────────── */

async function main() {
  const raw = readFileSync('/Users/issakildani/Downloads/apollo-contacts-tier 2.csv', 'utf-8');
  // Simple CSV parser (no dependency needed)
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const contacts: Contact[] = [];
  for (let li = 1; li < lines.length; li++) {
    const vals: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[li]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { vals.push(current); current = ''; continue; }
      current += ch;
    }
    vals.push(current);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    contacts.push(row as unknown as Contact);
  }

  console.log(`\nLoaded ${contacts.length} contacts.\n${'═'.repeat(60)}`);

  const csvRows: string[] = ['First Name,Last Name,Email,Title,Company,Website,Lists,Client Type,Subject Line,Email Body'];
  let processed = 0, errors = 0;

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    if (!c.Email || !c['Last Name']) { errors++; continue; }

    process.stdout.write(`[${i + 1}/${contacts.length}] ${c['First Name']} ${c['Last Name']} @ ${c['Company Name']}...`);

    // 1. Classify + profile
    const profile = await classifyAndProfile(c);
    if (!profile) { console.log(' ✗ profile failed'); errors++; continue; }

    // 2. Calculate
    const input: CalculationInput = {
      therapeuticArea: profile.therapeuticArea,
      phase: profile.phase,
      dealType: profile.dealType,
      modality: profile.modality,
      indication: profile.indication,
      territory: 'global',
      biomarker: 'unselected',
      lineOfTherapy: '2L',
      treatmentApproach: 'symptomatic',
      combinationPotential: 'some',
      competitivePosition: 'racing',
      dataQuality: 'promising',
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    };

    let calcResult;
    try { calcResult = calculateDealTerms(input); } catch { console.log(' ✗ calc failed'); errors++; continue; }

    const labels = calcResult.labels as { phase: string; modality: string; indication: string };
    const upfrontRange = `${formatCurrency(calcResult.terms.upfront.low)}–${formatCurrency(calcResult.terms.upfront.high)}`;

    // 3. Share link
    const shareUrl = await createShareLink(input, calcResult as unknown as Record<string, unknown>, labels, c['Company Name']);
    if (!shareUrl) { console.log(' ✗ share failed'); errors++; continue; }

    // 4. Email
    const email = await generateEmail(c, profile, shareUrl, upfrontRange);

    csvRows.push([
      escapeCSV(c['First Name']),
      escapeCSV(c['Last Name']),
      escapeCSV(c.Email),
      escapeCSV(c.Title),
      escapeCSV(c['Company Name']),
      escapeCSV(shareUrl),
      'April 2026 Tier 2',
      profile.clientType,
      escapeCSV(email.subject),
      escapeCSV(email.body),
    ].join(','));

    processed++;
    console.log(` ✓ ${profile.clientType} | "${email.subject}"`);
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  const outPath = '/Users/issakildani/Desktop/tier2_outreach_ready.csv';
  writeFileSync(outPath, csvRows.join('\n'));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Done! ${processed} processed, ${errors} errors`);
  console.log(`CSV: ${outPath}`);
}

main().catch(console.error);
