#!/usr/bin/env node

/**
 * Email Finder Pipeline
 *
 * For contacts without emails:
 * 1. Infer likely company domains from company name
 * 2. Validate domains via DNS A/MX records
 * 3. Generate candidate emails using common biotech patterns
 * 4. Verify emails via MX record (domain-level)
 * 5. For verified emails, run ClinicalTrials.gov lookup + share link generation
 */

import fs from 'fs';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INPUT_CSV = '/Users/issakildani/Desktop/ambrosia_400_enriched.csv';
const OUTPUT_CSV = '/Users/issakildani/Desktop/ambrosia_400_final.csv';
const BASE_URL = 'https://solidus.ambrosiaventures.co';

// Load env
const envFile = fs.readFileSync('/Users/issakildani/ambrosia-benchmarker/.env.local', 'utf8');
for (const line of envFile.split('\n')) {
  const match = line.match(/^(\w+)=["']?(.+?)["']?$/);
  if (match) process.env[match[1]] = match[2];
}
const AUTH_TOKEN = process.env.CRON_SECRET;

const CT_API = 'https://clinicaltrials.gov/api/v2/studies';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Domain inference from company names
// ---------------------------------------------------------------------------

function generateDomainCandidates(company) {
  // Clean company name
  const clean = company
    .replace(/[,.'""()]/g, '')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);

  // Remove common suffixes for base name
  const suffixes = ['inc', 'llc', 'ltd', 'corp', 'corporation', 'co', 'company', 'group', 'holdings'];
  const meaningful = words.filter(w => !suffixes.includes(w.toLowerCase()));

  const base = meaningful.map(w => w.toLowerCase()).join('');
  const baseDash = meaningful.map(w => w.toLowerCase()).join('-');
  const baseFirst = meaningful[0]?.toLowerCase() || '';

  // Common biotech domain patterns
  const candidates = new Set();

  // Direct: companyname.com
  candidates.add(`${base}.com`);
  candidates.add(`${baseDash}.com`);

  // With common biotech TLDs
  candidates.add(`${base}.bio`);
  candidates.add(`${baseDash}.bio`);
  candidates.add(`${base}.io`);

  // Remove "therapeutics", "pharma", etc. for shorter domains
  const shortWords = meaningful.filter(w =>
    !['therapeutics', 'pharmaceutical', 'pharmaceuticals', 'biopharma', 'biopharmaceuticals',
      'biosciences', 'biotech', 'biotechnologies', 'sciences', 'medicines', 'health',
      'therapies', 'labs', 'laboratories'].includes(w.toLowerCase())
  );

  if (shortWords.length > 0 && shortWords.length < meaningful.length) {
    const shortBase = shortWords.map(w => w.toLowerCase()).join('');
    const shortDash = shortWords.map(w => w.toLowerCase()).join('-');
    candidates.add(`${shortBase}.com`);
    candidates.add(`${shortDash}.com`);
    candidates.add(`${shortBase}.bio`);
    candidates.add(`${shortBase}bio.com`);
    candidates.add(`${shortBase}tx.com`);
    candidates.add(`${shortBase}therapeutics.com`);
    candidates.add(`${shortBase}pharma.com`);
    candidates.add(`${shortBase}medicines.com`);
  }

  // Common patterns with suffixes
  candidates.add(`${baseFirst}bio.com`);
  candidates.add(`${baseFirst}tx.com`);
  candidates.add(`${baseFirst}therapeutics.com`);
  candidates.add(`${baseFirst}pharma.com`);

  // Handle "Bio" in name — sometimes domain omits it
  if (clean.toLowerCase().includes('bio')) {
    const noBio = base.replace('bio', '');
    if (noBio.length > 2) {
      candidates.add(`${noBio}.com`);
      candidates.add(`${noBio}bio.com`);
    }
  }

  return [...candidates].filter(d => d.length > 4);
}

// ---------------------------------------------------------------------------
// Domain validation via DNS
// ---------------------------------------------------------------------------

async function validateDomain(domain) {
  try {
    // Check MX records first (means they can receive email)
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) return { valid: true, hasMx: true };
  } catch {}

  try {
    // Fallback: check if domain resolves at all
    await resolve4(domain);
    return { valid: true, hasMx: false };
  } catch {}

  return { valid: false, hasMx: false };
}

// ---------------------------------------------------------------------------
// Email pattern generation
// ---------------------------------------------------------------------------

function generateEmailCandidates(firstName, lastName, domain) {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const fi = f[0] || '';

  return [
    `${f}@${domain}`,              // john@company.com (most common in biotech)
    `${f}.${l}@${domain}`,         // john.doe@company.com
    `${f}${l}@${domain}`,          // johndoe@company.com
    `${fi}${l}@${domain}`,         // jdoe@company.com
    `${f}_${l}@${domain}`,         // john_doe@company.com
    `${fi}.${l}@${domain}`,        // j.doe@company.com
    `${l}@${domain}`,              // doe@company.com (sometimes for small teams)
  ];
}

// ---------------------------------------------------------------------------
// SMTP-level email verification (connect + RCPT TO check)
// ---------------------------------------------------------------------------

import net from 'net';

async function smtpVerify(email, mxHost) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ valid: false, reason: 'timeout' });
    }, 8000);

    const socket = net.createConnection(25, mxHost);
    let step = 0;
    let response = '';

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve({ valid: false, reason: 'connection_error' });
    });

    socket.on('data', (data) => {
      response = data.toString();

      if (step === 0 && response.startsWith('220')) {
        // Server greeting → send HELO
        socket.write('HELO ambrosiaventures.co\r\n');
        step = 1;
      } else if (step === 1 && response.startsWith('250')) {
        // HELO accepted → send MAIL FROM
        socket.write('MAIL FROM:<verify@ambrosiaventures.co>\r\n');
        step = 2;
      } else if (step === 2 && response.startsWith('250')) {
        // MAIL FROM accepted → send RCPT TO (the actual check)
        socket.write(`RCPT TO:<${email}>\r\n`);
        step = 3;
      } else if (step === 3) {
        clearTimeout(timeout);
        socket.write('QUIT\r\n');
        socket.destroy();

        if (response.startsWith('250') || response.startsWith('251')) {
          resolve({ valid: true, reason: 'smtp_accepted' });
        } else if (response.startsWith('550') || response.startsWith('551') || response.startsWith('553')) {
          resolve({ valid: false, reason: 'smtp_rejected' });
        } else {
          // 452, 421, etc. — inconclusive, treat as possible
          resolve({ valid: true, reason: 'smtp_inconclusive' });
        }
      } else {
        // Unexpected response
        clearTimeout(timeout);
        socket.destroy();
        resolve({ valid: false, reason: `unexpected: ${response.slice(0, 30)}` });
      }
    });

    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// ---------------------------------------------------------------------------
// ClinicalTrials.gov lookup (reused from outreach-pipeline.mjs)
// ---------------------------------------------------------------------------

const PHASE_MAP = { 'EARLY_PHASE1': 'phase1', 'PHASE1': 'phase1', 'PHASE2': 'phase2', 'PHASE3': 'phase3', 'PHASE4': 'approved', 'NA': 'preclinical' };

const MODALITY_KEYWORDS = {
  'antibody drug conjugate': 'adc', 'adc': 'adc', 'antibody-drug conjugate': 'adc',
  'bispecific': 'bispecific', 'car-t': 'carT_heme', 'car t': 'carT_heme',
  'cell therapy': 'cellTherapy', 'gene therapy': 'geneTherapy', 'aav': 'geneTherapy',
  'mrna': 'mrna', 'rnai': 'rnai', 'sirna': 'rnai', 'antisense': 'aso',
  'protac': 'protac', 'molecular glue': 'molecularGlue', 'peptide': 'peptide',
  'vaccine': 'therapeuticVaccine', 'radiopharmaceutical': 'radiopharmaceutical',
  'radioligand': 'radiopharmaceutical', 'oncolytic': 'oncolyticVirus',
  'monoclonal antibody': 'mab', 'antibody': 'mab', 'glp-1': 'glp1Agonist',
  'jak inhibitor': 'jakInhibitor', 'stem cell': 'stemCell',
  'small molecule': 'smallMolecule',
};

const TA_KEYWORDS = {
  'cancer': 'oncology', 'tumor': 'oncology', 'carcinoma': 'oncology', 'melanoma': 'oncology',
  'lymphoma': 'oncology', 'leukemia': 'hematology', 'myeloma': 'oncology',
  'alzheimer': 'neurology', 'parkinson': 'neurology', 'epilepsy': 'neurology',
  'multiple sclerosis': 'neurology', 'als': 'neurology', 'depression': 'neurology',
  'rheumatoid': 'immunology', 'lupus': 'immunology', 'psoriasis': 'dermatology',
  'crohn': 'gastroenterology', 'colitis': 'gastroenterology', 'asthma': 'immunology',
  'fibrosis': 'immunology', 'autoimmune': 'immunology', 'diabetes': 'metabolic',
  'obesity': 'metabolic', 'heart failure': 'cardiovascular', 'hiv': 'infectiousDisease',
  'infection': 'infectiousDisease', 'macular degeneration': 'ophthalmology',
  'rare': 'rareDisease', 'sickle cell': 'hematology', 'anemia': 'hematology',
};

async function lookupCompanyTrials(companyName) {
  const searchName = companyName.replace(/\b(Inc|LLC|Ltd|Corp|Therapeutics|Pharma|Biopharma|Biopharmaceuticals|Biosciences|Bio|Medicines|Pharmaceuticals)\b\.?/gi, '').trim();
  const params = new URLSearchParams({
    'query.spons': searchName, 'pageSize': '5', 'sort': 'LastUpdatePostDate:desc',
    'fields': 'NCTId,BriefTitle,Condition,InterventionName,InterventionType,Phase,OverallStatus',
    'format': 'json',
  });

  try {
    const res = await fetch(`${CT_API}?${params}`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.studies || data.studies.length === 0) return null;

    const ranked = data.studies
      .filter(s => ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION', 'NOT_YET_RECRUITING', 'COMPLETED'].includes(s.protocolSection?.statusModule?.overallStatus))
      .map(s => {
        const phases = s.protocolSection?.designModule?.phases || [];
        const conditions = s.protocolSection?.conditionsModule?.conditions || [];
        const interventions = s.protocolSection?.armsInterventionsModule?.interventions || [];
        const title = s.protocolSection?.identificationModule?.briefTitle || '';
        let bestPhase = 'preclinical';
        for (const p of phases) { if (PHASE_MAP[p] && phaseRank(PHASE_MAP[p]) > phaseRank(bestPhase)) bestPhase = PHASE_MAP[p]; }
        const interventionNames = interventions.map(i => (i.name || '').toLowerCase());
        const interventionTypes = interventions.map(i => (i.type || '').toLowerCase());
        return { conditions, interventionNames, interventionTypes, title, bestPhase };
      })
      .sort((a, b) => phaseRank(b.bestPhase) - phaseRank(a.bestPhase));

    return ranked[0] || null;
  } catch { return null; }
}

function phaseRank(p) { return { preclinical: 0, phase1: 1, phase1_2: 2, phase2: 3, phase2_3: 4, phase3: 5, nda_filed: 6, approved: 7 }[p] ?? 0; }

function inferModality(names, types, title) {
  const allText = [...names, ...types, title.toLowerCase()].join(' ');
  for (const [kw, mod] of Object.entries(MODALITY_KEYWORDS)) { if (allText.includes(kw)) return mod; }
  if (types.includes('biological')) return 'mab';
  if (types.includes('drug')) return 'smallMolecule';
  return 'smallMolecule';
}

function inferTA(conditions) {
  const all = conditions.map(c => c.toLowerCase()).join(' ');
  for (const [kw, ta] of Object.entries(TA_KEYWORDS)) { if (all.includes(kw)) return ta; }
  return 'oncology';
}

function inferIndication(conditions) {
  return conditions[0]?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'solid_tumor';
}

async function generateShareLink(therapeuticArea, modality, phase, indication, recipientName, recipientCompany) {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/outreach-report`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ therapeuticArea, modality, phase, indication, territory: 'global', dealType: 'licensing', recipientName, recipientCompany }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.shareUrl || '';
  } catch { return ''; }
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return { headers, rows: lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => row[h.trim()] = (values[i] || '').trim());
    return row;
  })};
}

function parseCSVLine(line) {
  const result = []; let current = '', inQ = false;
  for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { result.push(current); current = ''; } else current += ch; }
  result.push(current); return result;
}

function escapeCSV(val) {
  if (!val) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Email Finder Pipeline ===\n');

  const csvText = fs.readFileSync(INPUT_CSV, 'utf8');
  const { headers, rows } = parseCSV(csvText);
  console.log(`Loaded ${rows.length} total contacts`);

  const noEmailRows = [];
  const hasEmailRows = [];

  for (const row of rows) {
    if (row['Email Verified'] === 'no_email') {
      noEmailRows.push(row);
    } else {
      hasEmailRows.push(row);
    }
  }
  console.log(`Already have email: ${hasEmailRows.length}`);
  console.log(`Need to find email: ${noEmailRows.length}\n`);

  let found = 0;
  let domainFound = 0;
  let notFound = 0;
  const domainCache = new Map(); // cache domain validation results
  const mxCache = new Map(); // cache MX records per domain

  for (let i = 0; i < noEmailRows.length; i++) {
    const row = noEmailRows[i];
    const firstName = row['First Name'] || '';
    const lastName = row['Last Name'] || '';
    const company = row['Company'] || '';
    const name = `${firstName} ${lastName}`.trim();

    process.stdout.write(`[${i + 1}/${noEmailRows.length}] ${company.padEnd(35)} `);

    // 1. Generate domain candidates
    const domainCandidates = generateDomainCandidates(company);

    // 2. Find a valid domain with MX records
    let validDomain = null;
    let mxHost = null;

    for (const domain of domainCandidates) {
      if (domainCache.has(domain)) {
        const cached = domainCache.get(domain);
        if (cached.valid && cached.hasMx) { validDomain = domain; break; }
        continue;
      }

      const result = await validateDomain(domain);
      domainCache.set(domain, result);

      if (result.valid && result.hasMx) {
        validDomain = domain;
        domainFound++;
        break;
      }
    }

    if (!validDomain) {
      notFound++;
      process.stdout.write('✗ no domain found\n');
      continue;
    }

    // 3. Get MX host for SMTP verification
    try {
      const mxRecords = await resolveMx(validDomain);
      mxHost = mxRecords.sort((a, b) => a.priority - b.priority)[0]?.exchange;
    } catch {}

    // 4. Generate email candidates and verify
    const emailCandidates = generateEmailCandidates(firstName, lastName, validDomain);
    let bestEmail = null;
    let verifyReason = 'mx_valid'; // default — domain has MX so emails are deliverable at domain level

    if (mxHost) {
      // Try SMTP verification for the most likely pattern
      for (const candidate of emailCandidates.slice(0, 3)) { // Only try top 3 patterns
        await sleep(200);
        const smtpResult = await smtpVerify(candidate, mxHost);
        if (smtpResult.valid) {
          bestEmail = candidate;
          verifyReason = smtpResult.reason;
          break;
        }
      }
    }

    // If SMTP didn't work, fall back to most common pattern with valid MX
    if (!bestEmail) {
      bestEmail = emailCandidates[0]; // first@domain.com (most common biotech pattern)
      verifyReason = 'mx_valid_pattern_inferred';
    }

    // 5. Look up trials + generate share link
    await sleep(150);
    const trial = await lookupCompanyTrials(company);

    let therapeuticArea, modality, phase, indication, leadProgram;
    if (trial) {
      phase = trial.bestPhase;
      modality = inferModality(trial.interventionNames, trial.interventionTypes, trial.title);
      therapeuticArea = inferTA(trial.conditions);
      indication = inferIndication(trial.conditions);
      leadProgram = trial.title.slice(0, 120);
    } else {
      therapeuticArea = inferTA([company.toLowerCase()]);
      modality = 'smallMolecule';
      phase = 'phase2';
      indication = 'solid_tumor';
      leadProgram = 'Lead program (inferred)';
    }

    await sleep(100);
    const shareUrl = await generateShareLink(therapeuticArea, modality, phase, indication, name, company);

    found++;
    process.stdout.write(`✓ ${bestEmail} (${verifyReason}) → ${validDomain}\n`);

    // Update the row
    row['Email'] = bestEmail;
    row['Email Verified'] = verifyReason;
    row['Lead Program'] = leadProgram;
    row['Therapeutic Area'] = therapeuticArea;
    row['Modality'] = modality;
    row['Phase'] = phase;
    row['Indication'] = indication;
    row['Share Link'] = shareUrl;
    row['Pipeline Status'] = trial ? 'ct_gov_match' : 'inferred';
  }

  // Combine all rows and write output
  const allRows = [...hasEmailRows, ...noEmailRows];
  const outputHeaders = [
    'First Name', 'Last Name', 'Email', 'Title', 'Company',
    'Email Verified', 'Lead Program', 'Therapeutic Area', 'Modality',
    'Phase', 'Indication', 'Share Link', 'Pipeline Status',
  ];

  const csvLines = [
    outputHeaders.join(','),
    ...allRows.map(r => outputHeaders.map(h => escapeCSV(r[h])).join(',')),
  ];

  fs.writeFileSync(OUTPUT_CSV, csvLines.join('\n'), 'utf8');

  console.log('\n=== Email Finder Complete ===');
  console.log(`Emails found:      ${found}`);
  console.log(`Domains found:     ${domainFound}`);
  console.log(`No domain found:   ${notFound}`);
  console.log(`Total with email:  ${hasEmailRows.length + found} / ${rows.length}`);
  console.log(`Output saved:      ${OUTPUT_CSV}`);
}

main().catch(err => { console.error('\nFatal error:', err); process.exit(1); });
