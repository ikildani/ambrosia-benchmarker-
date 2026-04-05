/**
 * Outreach Contact Creator
 *
 * For each enriched contact:
 * 1. Uses Claude to determine company's lead program (TA, modality, indication, phase)
 * 2. Runs the deal calculation engine
 * 3. Creates a personalized share link in Supabase
 * 4. Creates the contact in Apollo with the share URL
 *
 * Usage:
 *   npx tsx scripts/outreach-contact-creator.ts
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY — for company program lookup
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — for share link creation
 *   APOLLO_API_KEY — for contact creation
 *
 * Input: /tmp/apollo_400_enriched.json
 * Output: /tmp/apollo_outreach_results.json
 */

import { readFileSync, writeFileSync } from 'fs';
import {
  calculateDealTerms,
  type CalculationInput,
  type Phase,
  type DealType,
  type Modality,
  type Indication,
  type TherapeuticArea,
} from '../lib/calculations';

/* ─── Config ───────────────────────────────────────────────────────── */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY!;
const BASE_URL = 'https://calculator.ambrosiaventures.co';

// Your user ID (Issa) for share link ownership
const SHARE_OWNER_ID = process.env.SHARE_OWNER_USER_ID || '';
const SHARE_OWNER_EMAIL = 'issa@ambrosiaventures.co';

// Start index (skip already-created contacts)
const START_INDEX = parseInt(process.env.START_INDEX || '51', 10);

const BATCH_DELAY_MS = 500; // Delay between contacts to avoid rate limits

/* ─── Types ────────────────────────────────────────────────────────── */

interface EnrichedContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  organization_name: string;
}

interface CompanyProfile {
  therapeuticArea: TherapeuticArea;
  modality: Modality;
  indication: Indication;
  phase: Phase;
  dealType: DealType;
  rationale: string;
}

interface OutreachResult {
  contact: EnrichedContact;
  profile: CompanyProfile | null;
  shareUrl: string | null;
  apolloContactId: string | null;
  error: string | null;
}

/* ─── Company Profile Lookup via Claude ────────────────────────────── */

const VALID_TAS: TherapeuticArea[] = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
];

async function getCompanyProfile(contact: EnrichedContact): Promise<CompanyProfile | null> {
  const prompt = `You are a biopharma industry expert. Given this person and company, determine their most likely lead drug program.

Person: ${contact.first_name} ${contact.last_name}, ${contact.title} at ${contact.organization_name}

Return a JSON object with these exact fields (no markdown, no explanation, just JSON):
{
  "therapeuticArea": one of: ${VALID_TAS.join(', ')},
  "modality": the drug modality (e.g., "smallMolecule", "adc", "mab", "bispecific", "carT_heme", "geneTherapy", "rnai", "peptide", "mrna"),
  "indication": the most likely indication key (e.g., "lung_nsclc", "breast_her2", "alzheimers", "obesity", "rheumatoid_arthritis"),
  "phase": one of: "discovery", "preclinical", "phase1", "phase1_2", "phase2", "phase2_3", "phase3", "nda_filed", "approved",
  "dealType": one of: "licensing", "acquisition", "codevelopment", "option", "collaboration",
  "rationale": one sentence explaining why
}

If you cannot determine the company's pipeline, use the most common profile for their therapeutic area. Always return valid JSON.`;

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

    if (!response.ok) {
      console.error(`  Claude API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const profile = JSON.parse(jsonMatch[0]) as CompanyProfile;

    // Validate TA
    if (!VALID_TAS.includes(profile.therapeuticArea)) {
      profile.therapeuticArea = 'oncology';
    }

    return profile;
  } catch (err) {
    console.error(`  Claude lookup failed: ${err}`);
    return null;
  }
}

/* ─── Calculation ──────────────────────────────────────────────────── */

function runCalculation(profile: CompanyProfile) {
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

  try {
    const result = calculateDealTerms(input);
    return { input, result };
  } catch {
    return null;
  }
}

/* ─── Share Link Creation (direct Supabase insert) ─────────────────── */

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function createShareLink(
  input: CalculationInput,
  result: Record<string, unknown>,
  labels: { phase: string; modality: string; indication: string },
  recipientCompany: string,
): Promise<string | null> {
  const shareToken = generateToken();

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shared_calculations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        share_token: shareToken,
        user_id: SHARE_OWNER_ID || null,
        email: SHARE_OWNER_EMAIL,
        inputs: input,
        results: result,
        labels: { ...labels, company: recipientCompany },
        is_public: true,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`  Supabase share insert error: ${response.status} ${body}`);
      return null;
    }

    return `${BASE_URL}/share/${shareToken}`;
  } catch (err) {
    console.error(`  Share link creation failed: ${err}`);
    return null;
  }
}

/* ─── Apollo Contact Creation ──────────────────────────────────────── */

async function createApolloContact(
  contact: EnrichedContact,
  shareUrl: string,
  profile: CompanyProfile,
): Promise<string | null> {
  try {
    const response = await fetch('https://api.apollo.io/api/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        title: contact.title,
        organization_name: contact.organization_name,
        label_names: ['April 2026 Outreach'],
        // Store personalized share link + profile in custom fields
        typed_custom_fields: {
          // If you have custom fields set up in Apollo, use their IDs here
        },
        // Add share link to contact's note
        present_raw_address: '', // placeholder
        website_url: shareUrl,
        run_dedupe: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`  Apollo create error: ${response.status} ${body}`);
      return null;
    }

    const data = await response.json();
    return data.contact?.id || null;
  } catch (err) {
    console.error(`  Apollo contact creation failed: ${err}`);
    return null;
  }
}

/* ─── Main ─────────────────────────────────────────────────────────── */

async function main() {
  // Load contacts
  const contacts: EnrichedContact[] = JSON.parse(
    readFileSync('/tmp/apollo_400_enriched.json', 'utf-8')
  );

  console.log(`\nLoaded ${contacts.length} contacts. Starting from index ${START_INDEX}.\n`);
  console.log('═'.repeat(70));

  const results: OutreachResult[] = [];
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = START_INDEX; i < contacts.length; i++) {
    const contact = contacts[i];
    const progress = `[${i + 1}/${contacts.length}]`;

    if (!contact.last_name || !contact.email) {
      console.log(`${progress} SKIP: ${contact.first_name} — missing last_name or email`);
      skipped++;
      continue;
    }

    console.log(`${progress} ${contact.first_name} ${contact.last_name} | ${contact.title} @ ${contact.organization_name}`);

    // 1. Get company profile via Claude
    console.log('  → Looking up lead program...');
    const profile = await getCompanyProfile(contact);

    if (!profile) {
      console.log('  ✗ Could not determine company profile, skipping');
      results.push({ contact, profile: null, shareUrl: null, apolloContactId: null, error: 'profile_lookup_failed' });
      errors++;
      continue;
    }

    console.log(`  → ${profile.therapeuticArea} | ${profile.modality} | ${profile.indication} | ${profile.phase}`);
    console.log(`  → Rationale: ${profile.rationale}`);

    // 2. Run calculation
    console.log('  → Running deal calculation...');
    const calc = runCalculation(profile);

    if (!calc) {
      console.log('  ✗ Calculation failed, skipping');
      results.push({ contact, profile, shareUrl: null, apolloContactId: null, error: 'calculation_failed' });
      errors++;
      continue;
    }

    const labels = calc.result.labels as { phase: string; modality: string; indication: string };

    // 3. Create personalized share link
    console.log('  → Creating personalized share link...');
    const shareUrl = await createShareLink(
      calc.input,
      calc.result as unknown as Record<string, unknown>,
      labels,
      contact.organization_name,
    );

    if (!shareUrl) {
      console.log('  ✗ Share link creation failed, creating contact without link');
    } else {
      console.log(`  → ${shareUrl}`);
    }

    // 4. Record result (Apollo contacts created separately via MCP)
    console.log(`  ✓ Ready: ${shareUrl || 'no link'}`);
    created++;

    results.push({
      contact,
      profile,
      shareUrl,
      apolloContactId: null,
      error: null,
    });

    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }

  // Save results
  writeFileSync('/tmp/apollo_outreach_results.json', JSON.stringify(results, null, 2));

  // Save CSV for reference
  const csvHeader = 'first_name,last_name,email,title,organization,therapeutic_area,modality,indication,phase,share_url';
  const csvRows = results
    .filter(r => r.profile)
    .map(r => [
      r.contact.first_name, r.contact.last_name, r.contact.email,
      `"${r.contact.title}"`, `"${r.contact.organization_name}"`,
      r.profile!.therapeuticArea, r.profile!.modality, r.profile!.indication, r.profile!.phase,
      r.shareUrl || '',
    ].join(','));
  writeFileSync('/tmp/apollo_outreach_contacts.csv', [csvHeader, ...csvRows].join('\n'));

  console.log('\n' + '═'.repeat(70));
  console.log(`\nDone!`);
  console.log(`  Created:  ${created}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${results.length}`);
  console.log(`\nResults saved to /tmp/apollo_outreach_results.json`);
  console.log(`CSV saved to /tmp/apollo_outreach_contacts.csv`);
}

main().catch(console.error);
