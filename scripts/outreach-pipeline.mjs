#!/usr/bin/env node

/**
 * Outreach Pipeline
 *
 * 1. Reads CSV of contacts
 * 2. Looks up each company's lead program via ClinicalTrials.gov API
 * 3. Maps to Benchmarker modality/TA/phase enums
 * 4. Calls the local admin outreach-report API for share link generation
 * 5. Verifies emails via DNS MX lookup
 * 6. Outputs enriched CSV
 */

import fs from 'fs';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INPUT_CSV = '/Users/issakildani/Desktop/ambrosia_400_corrected.csv';
const OUTPUT_CSV = '/Users/issakildani/Desktop/ambrosia_400_enriched.csv';
const BASE_URL = 'https://solidus.ambrosiaventures.co';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  // Load from .env.local
  const envFile = fs.readFileSync('/Users/issakildani/ambrosia-benchmarker/.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^(\w+)=["']?(.+?)["']?$/);
    if (match) process.env[match[1]] = match[2];
  }
}
const AUTH_TOKEN = process.env.CRON_SECRET;

// ClinicalTrials.gov API
const CT_API = 'https://clinicaltrials.gov/api/v2/studies';

// Throttle: 150ms between CT.gov calls, 100ms between admin API calls
const CT_DELAY = 150;
const API_DELAY = 100;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Modality mapping: ClinicalTrials.gov intervention types → our enums
// ---------------------------------------------------------------------------

const MODALITY_KEYWORDS = {
  // Exact modality matches
  'antibody drug conjugate': 'adc', 'adc': 'adc',
  'antibody-drug conjugate': 'adc',
  'bispecific': 'bispecific', 'bispecific antibody': 'bispecific',
  't-cell engager': 'tCellEngager', 't cell engager': 'tCellEngager',
  'car-t': 'carT_heme', 'car t': 'carT_heme', 'chimeric antigen receptor': 'carT_heme',
  'cell therapy': 'cellTherapy', 'cell-based': 'cellTherapy',
  'gene therapy': 'geneTherapy', 'gene transfer': 'geneTherapy', 'aav': 'geneTherapy',
  'mrna': 'mrna', 'messenger rna': 'mrna',
  'rnai': 'rnai', 'sirna': 'rnai', 'small interfering': 'rnai',
  'antisense': 'aso', 'antisense oligonucleotide': 'aso',
  'oligonucleotide': 'oligonucleotide',
  'protac': 'protac', 'protein degrader': 'protac', 'molecular glue': 'molecularGlue',
  'peptide': 'peptide',
  'vaccine': 'therapeuticVaccine',
  'radiopharmaceutical': 'radiopharmaceutical', 'radioligand': 'radiopharmaceutical',
  'oncolytic virus': 'oncolyticVirus', 'oncolytic': 'oncolyticVirus',
  'monoclonal antibody': 'mab', 'antibody': 'mab',
  'glp-1': 'glp1Agonist', 'glp1': 'glp1Agonist', 'semaglutide': 'glp1Agonist',
  'dual incretin': 'dualIncretin', 'gip/glp': 'dualIncretin',
  'sglt2': 'sglt2Inhibitor',
  'jak inhibitor': 'jakInhibitor', 'janus kinase': 'jakInhibitor',
  'stem cell': 'stemCell',
  'psychedelic': 'psychedelic', 'psilocybin': 'psychedelic', 'mdma': 'psychedelic',
  'small molecule': 'smallMolecule',
};

// TA mapping from condition keywords
const TA_KEYWORDS = {
  'cancer': 'oncology', 'tumor': 'oncology', 'carcinoma': 'oncology', 'melanoma': 'oncology',
  'lymphoma': 'oncology', 'leukemia': 'hematology', 'myeloma': 'oncology', 'sarcoma': 'oncology',
  'glioblastoma': 'oncology', 'glioma': 'oncology', 'neuroblastoma': 'oncology',
  'lung': 'oncology', 'breast': 'oncology', 'prostate': 'oncology', 'colorectal': 'oncology',
  'pancreatic': 'oncology', 'ovarian': 'oncology', 'hepatocellular': 'oncology',
  'alzheimer': 'neurology', 'parkinson': 'neurology', 'epilepsy': 'neurology',
  'multiple sclerosis': 'neurology', 'als': 'neurology', 'amyotrophic': 'neurology',
  'huntington': 'neurology', 'migraine': 'neurology', 'neuropath': 'neurology',
  'stroke': 'neurology', 'dementia': 'neurology', 'neurodegenerat': 'neurology',
  'depression': 'neurology', 'schizophrenia': 'neurology', 'anxiety': 'neurology',
  'bipolar': 'neurology', 'ptsd': 'neurology', 'autism': 'neurology',
  'rheumatoid': 'immunology', 'lupus': 'immunology', 'psoriasis': 'dermatology',
  'crohn': 'gastroenterology', 'colitis': 'gastroenterology', 'ibd': 'gastroenterology',
  'atopic dermatitis': 'dermatology', 'eczema': 'dermatology', 'alopecia': 'dermatology',
  'asthma': 'immunology', 'copd': 'immunology',
  'fibrosis': 'immunology', 'autoimmune': 'immunology', 'inflammation': 'immunology',
  'diabetes': 'metabolic', 'obesity': 'metabolic', 'nash': 'metabolic', 'nafld': 'metabolic',
  'metabolic': 'metabolic', 'weight': 'metabolic',
  'heart failure': 'cardiovascular', 'cardiac': 'cardiovascular', 'hypertension': 'cardiovascular',
  'atherosclerosis': 'cardiovascular', 'thrombosis': 'hematology',
  'hiv': 'infectiousDisease', 'hepatitis': 'infectiousDisease', 'influenza': 'infectiousDisease',
  'covid': 'infectiousDisease', 'bacterial': 'infectiousDisease', 'infection': 'infectiousDisease',
  'antimicrobial': 'infectiousDisease', 'antiviral': 'infectiousDisease',
  'macular degeneration': 'ophthalmology', 'retinal': 'ophthalmology', 'glaucoma': 'ophthalmology',
  'optic': 'ophthalmology', 'uveitis': 'ophthalmology', 'eye': 'ophthalmology',
  'rare': 'rareDisease', 'orphan': 'rareDisease', 'duchenne': 'rareDisease',
  'sickle cell': 'hematology', 'hemophilia': 'hematology', 'thalassemia': 'hematology',
  'anemia': 'hematology',
  'endometriosis': 'immunology', 'fertility': 'immunology',
  'kidney': 'immunology', 'renal': 'immunology', 'nephro': 'immunology',
};

// Phase mapping from ClinicalTrials.gov
const PHASE_MAP = {
  'EARLY_PHASE1': 'phase1',
  'PHASE1': 'phase1',
  'PHASE2': 'phase2',
  'PHASE3': 'phase3',
  'PHASE4': 'approved',
  'NA': 'preclinical',
};

// ---------------------------------------------------------------------------
// ClinicalTrials.gov lookup
// ---------------------------------------------------------------------------

async function lookupCompanyTrials(companyName) {
  // Clean company name for search
  const searchName = companyName
    .replace(/\b(Inc|LLC|Ltd|Corp|Therapeutics|Pharma|Biopharma|Biopharmaceuticals|Biosciences|Bio|Medicines|Pharmaceuticals)\b\.?/gi, '')
    .trim();

  const params = new URLSearchParams({
    'query.spons': searchName,
    'pageSize': '10',
    'sort': 'LastUpdatePostDate:desc',
    'fields': 'NCTId,BriefTitle,Condition,InterventionName,InterventionType,Phase,OverallStatus,StartDate',
    'format': 'json',
  });

  try {
    const res = await fetch(`${CT_API}?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (!data.studies || data.studies.length === 0) return null;

    // Find the most advanced active trial
    const ranked = data.studies
      .filter(s => {
        const status = s.protocolSection?.statusModule?.overallStatus;
        return ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION', 'NOT_YET_RECRUITING', 'COMPLETED'].includes(status);
      })
      .map(s => {
        const phases = s.protocolSection?.designModule?.phases || [];
        const conditions = s.protocolSection?.conditionsModule?.conditions || [];
        const interventions = s.protocolSection?.armsInterventionsModule?.interventions || [];
        const title = s.protocolSection?.identificationModule?.briefTitle || '';

        // Get most advanced phase
        let bestPhase = 'preclinical';
        for (const p of phases) {
          if (PHASE_MAP[p] && phaseRank(PHASE_MAP[p]) > phaseRank(bestPhase)) {
            bestPhase = PHASE_MAP[p];
          }
        }

        // Get intervention info
        const interventionNames = interventions.map(i => (i.name || '').toLowerCase());
        const interventionTypes = interventions.map(i => (i.type || '').toLowerCase());

        return { phases, conditions, interventions, interventionNames, interventionTypes, title, bestPhase };
      })
      .sort((a, b) => phaseRank(b.bestPhase) - phaseRank(a.bestPhase));

    if (ranked.length === 0) return null;
    return ranked[0]; // Most advanced trial
  } catch {
    return null;
  }
}

function phaseRank(phase) {
  const ranks = { preclinical: 0, phase1: 1, phase1_2: 2, phase2: 3, phase2_3: 4, phase3: 5, nda_filed: 6, approved: 7 };
  return ranks[phase] ?? 0;
}

function inferModality(interventionNames, interventionTypes, title) {
  const allText = [...interventionNames, ...interventionTypes, title.toLowerCase()].join(' ');

  // Check specific modalities first (more specific → less specific)
  for (const [keyword, modality] of Object.entries(MODALITY_KEYWORDS)) {
    if (allText.includes(keyword)) return modality;
  }

  // Fallback based on intervention type
  if (interventionTypes.includes('biological')) return 'mab';
  if (interventionTypes.includes('drug')) return 'smallMolecule';
  if (interventionTypes.includes('genetic')) return 'geneTherapy';

  return 'smallMolecule'; // Default
}

function inferTA(conditions) {
  const allConditions = conditions.map(c => c.toLowerCase()).join(' ');

  for (const [keyword, ta] of Object.entries(TA_KEYWORDS)) {
    if (allConditions.includes(keyword)) return ta;
  }

  return 'oncology'; // Default (most common)
}

function inferIndication(conditions, ta) {
  const condStr = conditions.map(c => c.toLowerCase()).join(' ');

  // Map common conditions to our indication enum values
  const indicationMap = {
    oncology: {
      'non-small cell lung': 'lung_nsclc', 'nsclc': 'lung_nsclc', 'lung': 'lung_nsclc',
      'breast': 'breast', 'triple negative': 'breast_tnbc',
      'colorectal': 'colorectal', 'colon': 'colorectal',
      'pancreatic': 'pancreatic', 'ovarian': 'ovarian',
      'melanoma': 'melanoma', 'prostate': 'prostate',
      'glioblastoma': 'glioblastoma', 'liver': 'hcc', 'hepatocellular': 'hcc',
      'head and neck': 'head_neck', 'gastric': 'gastric', 'stomach': 'gastric',
      'bladder': 'bladder', 'urothelial': 'bladder',
      'renal cell': 'renal', 'kidney': 'renal',
      'lymphoma': 'dlbcl', 'leukemia': 'aml', 'myeloma': 'multiple_myeloma',
      'solid tumor': 'solid_tumor', 'advanced solid': 'solid_tumor',
    },
    neurology: {
      'alzheimer': 'alzheimers', 'parkinson': 'parkinsons', 'epilepsy': 'epilepsy',
      'als': 'als', 'amyotrophic': 'als', 'huntington': 'huntingtons',
      'multiple sclerosis': 'multiple_sclerosis', 'migraine': 'migraine',
      'depression': 'depression', 'schizophrenia': 'schizophrenia',
      'pain': 'neuropathic_pain', 'neuropath': 'neuropathic_pain',
    },
  };

  const taMap = indicationMap[ta] || {};
  for (const [keyword, indication] of Object.entries(taMap)) {
    if (condStr.includes(keyword)) return indication;
  }

  return conditions[0]?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'solid_tumor';
}

// ---------------------------------------------------------------------------
// Email verification via MX record
// ---------------------------------------------------------------------------

async function verifyEmail(email) {
  if (!email || !email.includes('@')) return { valid: false, reason: 'missing_email' };

  const domain = email.split('@')[1];
  try {
    const records = await resolveMx(domain);
    if (records && records.length > 0) {
      return { valid: true, reason: 'mx_valid' };
    }
    return { valid: false, reason: 'no_mx_records' };
  } catch (err) {
    return { valid: false, reason: `dns_error: ${err.code}` };
  }
}

// ---------------------------------------------------------------------------
// Generate share link via admin API
// ---------------------------------------------------------------------------

async function generateShareLink(therapeuticArea, modality, phase, indication, recipientName, recipientCompany) {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/outreach-report`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        therapeuticArea,
        modality,
        phase,
        indication,
        territory: 'global',
        dealType: 'licensing',
        recipientName,
        recipientCompany,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      return { shareUrl: '', error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }

    const data = await res.json();
    return { shareUrl: data.shareUrl || '', error: null };
  } catch (err) {
    return { shareUrl: '', error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => row[h.trim()] = (values[i] || '').trim());
    return row;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function escapeCSV(val) {
  if (!val) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Ambrosia Outreach Pipeline ===');
  console.log(`Input:  ${INPUT_CSV}`);
  console.log(`Output: ${OUTPUT_CSV}\n`);

  const csvText = fs.readFileSync(INPUT_CSV, 'utf8');
  const rows = parseCSV(csvText);
  console.log(`Loaded ${rows.length} contacts\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let noEmailCount = 0;
  let emailInvalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = `${row['First Name']} ${row['Last Name']}`.trim();
    const company = row['Company'] || '';
    const email = row['Email'] || '';
    const title = row['Title'] || '';

    process.stdout.write(`[${i + 1}/${rows.length}] ${company.padEnd(35)} `);

    // Skip if no email
    if (!email) {
      noEmailCount++;
      process.stdout.write('⊘ no email\n');
      results.push({
        ...row,
        'Email Verified': 'no_email',
        'Lead Program': '',
        'Therapeutic Area': '',
        'Modality': '',
        'Phase': '',
        'Indication': '',
        'Share Link': '',
        'Pipeline Status': 'skipped_no_email',
      });
      continue;
    }

    // 1. Verify email
    const emailResult = await verifyEmail(email);
    if (!emailResult.valid) {
      emailInvalidCount++;
      process.stdout.write(`✗ email invalid (${emailResult.reason})\n`);
      results.push({
        ...row,
        'Email Verified': emailResult.reason,
        'Lead Program': '',
        'Therapeutic Area': '',
        'Modality': '',
        'Phase': '',
        'Indication': '',
        'Share Link': '',
        'Pipeline Status': 'skipped_invalid_email',
      });
      continue;
    }

    // 2. Look up trials on ClinicalTrials.gov
    await sleep(CT_DELAY);
    const trial = await lookupCompanyTrials(company);

    let therapeuticArea, modality, phase, indication, leadProgram;

    if (trial) {
      phase = trial.bestPhase;
      modality = inferModality(trial.interventionNames, trial.interventionTypes, trial.title);
      therapeuticArea = inferTA(trial.conditions);
      indication = inferIndication(trial.conditions, therapeuticArea);
      leadProgram = trial.title.slice(0, 120);
    } else {
      // Fallback: use company name clues
      const compLower = company.toLowerCase();
      therapeuticArea = inferTA([compLower]);
      modality = 'smallMolecule';
      phase = 'phase2'; // Default to most common deal stage
      indication = 'solid_tumor';
      leadProgram = 'Lead program (inferred)';
    }

    // 3. Generate share link
    await sleep(API_DELAY);
    const shareResult = await generateShareLink(therapeuticArea, modality, phase, indication, name, company);

    if (shareResult.error) {
      failCount++;
      process.stdout.write(`✗ share failed: ${shareResult.error.slice(0, 50)}\n`);
      results.push({
        ...row,
        'Email Verified': 'valid',
        'Lead Program': leadProgram,
        'Therapeutic Area': therapeuticArea,
        'Modality': modality,
        'Phase': phase,
        'Indication': indication,
        'Share Link': '',
        'Pipeline Status': `error: ${shareResult.error.slice(0, 80)}`,
      });
      continue;
    }

    successCount++;
    process.stdout.write(`✓ ${phase} ${modality} → ${shareResult.shareUrl.split('/').pop()}\n`);

    results.push({
      ...row,
      'Email Verified': 'valid',
      'Lead Program': leadProgram,
      'Therapeutic Area': therapeuticArea,
      'Modality': modality,
      'Phase': phase,
      'Indication': indication,
      'Share Link': shareResult.shareUrl,
      'Pipeline Status': trial ? 'ct_gov_match' : 'inferred',
    });
  }

  // Write output CSV
  const outputHeaders = [
    'First Name', 'Last Name', 'Email', 'Title', 'Company',
    'Email Verified', 'Lead Program', 'Therapeutic Area', 'Modality',
    'Phase', 'Indication', 'Share Link', 'Pipeline Status',
  ];

  const csvLines = [
    outputHeaders.join(','),
    ...results.map(r => outputHeaders.map(h => escapeCSV(r[h])).join(',')),
  ];

  fs.writeFileSync(OUTPUT_CSV, csvLines.join('\n'), 'utf8');

  console.log('\n=== Pipeline Complete ===');
  console.log(`Total contacts:    ${rows.length}`);
  console.log(`Share links OK:    ${successCount}`);
  console.log(`Share link errors: ${failCount}`);
  console.log(`No email:          ${noEmailCount}`);
  console.log(`Invalid email:     ${emailInvalidCount}`);
  console.log(`Output saved:      ${OUTPUT_CSV}`);
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
