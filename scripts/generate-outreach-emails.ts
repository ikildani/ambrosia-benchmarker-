/**
 * Generate personalized outreach emails for each contact.
 *
 * Uses Claude Haiku to craft unique subject lines and email bodies
 * tailored to each contact's role, company, and therapeutic area.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npx tsx scripts/generate-outreach-emails.ts
 *
 * Input:  /tmp/apollo_outreach_results.json
 * Output: /Users/issakildani/Desktop/apollo_import_with_emails.csv
 */

import { readFileSync, writeFileSync } from 'fs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const BATCH_DELAY_MS = 300;

interface OutreachResult {
  contact: {
    first_name: string;
    last_name: string;
    email: string;
    title: string;
    organization_name: string;
  };
  profile: {
    therapeuticArea: string;
    modality: string;
    indication: string;
    phase: string;
    dealType: string;
    rationale: string;
  } | null;
  shareUrl: string | null;
}

const TA_DISPLAY: Record<string, string> = {
  oncology: 'oncology',
  neurology: 'neurology & CNS',
  immunology: 'immunology & autoimmune',
  metabolic: 'metabolic & obesity',
  cardiovascular: 'cardiovascular',
  infectiousDisease: 'infectious disease',
  ophthalmology: 'ophthalmology',
  womensHealth: "women's health",
  rareDisease: 'rare disease',
  hematology: 'hematology',
  dermatology: 'dermatology',
  gastroenterology: 'gastroenterology',
};

const MODALITY_DISPLAY: Record<string, string> = {
  smallMolecule: 'small molecule',
  adc: 'ADC',
  mab: 'antibody',
  bispecific: 'bispecific antibody',
  carT_heme: 'CAR-T',
  carT_solid: 'CAR-T (solid tumor)',
  geneTherapy: 'gene therapy',
  cellTherapy: 'cell therapy',
  rnai: 'RNAi',
  mrna: 'mRNA',
  peptide: 'peptide',
  oligonucleotide: 'oligonucleotide',
  protac: 'PROTAC',
  radiopharmaceutical: 'radiopharmaceutical',
  oncolyticVirus: 'oncolytic virus',
  therapeuticVaccine: 'therapeutic vaccine',
};

const PHASE_DISPLAY: Record<string, string> = {
  discovery: 'discovery-stage',
  preclinical: 'preclinical',
  phase1: 'Phase 1',
  phase1_2: 'Phase 1/2',
  phase2: 'Phase 2',
  phase2_3: 'Phase 2/3',
  phase3: 'Phase 3',
  nda_filed: 'NDA-stage',
  approved: 'approved',
};

async function generateEmail(r: OutreachResult): Promise<{ subject: string; body: string }> {
  const c = r.contact;
  const p = r.profile!;
  const ta = TA_DISPLAY[p.therapeuticArea] || p.therapeuticArea;
  const modality = MODALITY_DISPLAY[p.modality] || p.modality;
  const phase = PHASE_DISPLAY[p.phase] || p.phase;
  const shareUrl = r.shareUrl || 'https://calculator.ambrosiaventures.co/report';

  const isFounder = /founder|ceo|president|chief executive/i.test(c.title);
  const isBD = /business development|licensing|bd|alliance|partnerships/i.test(c.title);
  const isSE = /search.*eval|s&e|m&a|transaction|investment|portfolio/i.test(c.title);

  let roleContext = '';
  if (isFounder) {
    roleContext = 'They are a founder/CEO — likely evaluating partnerships or preparing for out-licensing. Speak to knowing what their asset is worth before engaging partners.';
  } else if (isBD) {
    roleContext = 'They work in BD/Licensing — likely running deal analyses, benchmarking term sheets, or screening partners. Speak to saving time on deal intelligence.';
  } else if (isSE) {
    roleContext = 'They work in Search & Evaluation or M&A — likely evaluating targets and running comparables. Speak to independent deal benchmarking data.';
  } else {
    roleContext = 'Speak to data-driven deal intelligence that saves time and strengthens their negotiating position.';
  }

  const prompt = `You are writing a cold outreach email for Ambrosia Ventures, a biopharma deal intelligence platform.

RECIPIENT:
- Name: ${c.first_name} ${c.last_name}
- Title: ${c.title}
- Company: ${c.organization_name}
- Their space: ${ta}, ${modality}, ${phase}
- ${roleContext}

RULES:
1. Subject line: max 50 chars, no emojis, no "Re:", no clickbait. Reference their specific space or company name.
2. Email body: 3-5 short sentences max. First-person from "Issa" at Ambrosia Ventures.
3. NEVER mention pricing, cost, or dollar amounts.
4. Include this exact personalized link naturally: ${shareUrl}
5. The link shows a personalized deal analysis for their therapeutic area — frame it as something we built specifically for them.
6. End the email by simply signing off with just "Issa" on its own line. NO offers to "walk through it", NO "happy to chat", NO "let me know if you want to discuss", NO calls/meetings. Just deliver the link and let them explore it themselves.
7. Tone: peer-to-peer, authoritative, concise. Like a fellow BD professional sharing genuinely useful intelligence — not a salesperson. You are giving them something valuable, not asking for anything.
8. Do NOT use "I hope this finds you well" or any generic opener.
9. Do NOT use the word "excited", "thrilled", "happy to", "feel free", "let me know", or "walk through".
10. Do NOT offer a call, meeting, demo, or conversation. This is purely a value-drop — share the intel and leave.
11. The email should make them feel like they discovered something proprietary that gives them an edge.

Return ONLY a JSON object with exactly two fields:
{"subject": "...", "body": "..."}

The body should use \\n for line breaks. End with just "Issa" as the sign-off. Do not include any other signature block.`;

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

    if (!response.ok) {
      console.error(`  Claude error: ${response.status}`);
      return fallbackEmail(c, ta, shareUrl);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackEmail(c, ta, shareUrl);

    const result = JSON.parse(jsonMatch[0]);
    return {
      subject: result.subject || fallbackEmail(c, ta, shareUrl).subject,
      body: result.body || fallbackEmail(c, ta, shareUrl).body,
    };
  } catch {
    return fallbackEmail(c, ta, shareUrl);
  }
}

function fallbackEmail(
  c: { first_name: string; organization_name: string },
  ta: string,
  shareUrl: string,
): { subject: string; body: string } {
  return {
    subject: `${ta} deal benchmarks for ${c.organization_name}`,
    body: `${c.first_name},\n\nWe pulled together deal benchmarking data specific to ${ta} — upfront ranges, milestone structures, comparable transactions, and partner intelligence from 2,500+ verified deals.\n\nBuilt this for your space: ${shareUrl}\n\nIssa`,
  };
}

function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function main() {
  const results: OutreachResult[] = JSON.parse(
    readFileSync('/tmp/apollo_outreach_results.json', 'utf-8')
  );

  const valid = results.filter(r => r.profile && r.shareUrl && r.contact.last_name);
  console.log(`Generating emails for ${valid.length} contacts...\n`);

  const rows: string[] = [];
  rows.push('First Name,Last Name,Email,Title,Company,Website,Lists,Subject Line,Email Body');

  let count = 0;
  for (const r of valid) {
    count++;
    const c = r.contact;
    process.stdout.write(`[${count}/${valid.length}] ${c.first_name} ${c.last_name} @ ${c.organization_name}...`);

    const email = await generateEmail(r);

    rows.push([
      escapeCSV(c.first_name),
      escapeCSV(c.last_name),
      escapeCSV(c.email),
      escapeCSV(c.title),
      escapeCSV(c.organization_name),
      escapeCSV(r.shareUrl || ''),
      'April 2026 Outreach',
      escapeCSV(email.subject),
      escapeCSV(email.body),
    ].join(','));

    console.log(` ✓ "${email.subject}"`);

    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }

  const outputPath = '/Users/issakildani/Desktop/apollo_import_with_emails.csv';
  writeFileSync(outputPath, rows.join('\n'));

  // Also save JSON for programmatic use
  const jsonResults = valid.map((r, i) => ({
    ...r,
    email_subject: rows[i + 1]?.split(',').slice(-2, -1)[0] || '',
    email_body: rows[i + 1]?.split(',').slice(-1)[0] || '',
  }));
  writeFileSync('/tmp/apollo_outreach_with_emails.json', JSON.stringify(jsonResults, null, 2));

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Done! ${count} personalized emails generated.`);
  console.log(`CSV: ${outputPath}`);
  console.log(`JSON: /tmp/apollo_outreach_with_emails.json`);
}

main().catch(console.error);
