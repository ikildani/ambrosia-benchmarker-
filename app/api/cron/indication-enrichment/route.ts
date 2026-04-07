import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  indicationOptions,
  neurologyIndicationOptions,
  immunologyIndicationOptions,
  metabolicIndicationOptions,
  cardiovascularIndicationOptions,
  infectiousDiseaseIndicationOptions,
  ophthalmologyIndicationOptions,
  womensHealthIndicationOptions,
  rareDiseaseIndicationOptions,
  hematologyIndicationOptions,
  dermatologyIndicationOptions,
  gastroenterologyIndicationOptions,
} from '@/lib/calculations';

export const maxDuration = 120; // 2 min — API calls are lightweight
export const dynamic = 'force-dynamic';

// ─── TYPES ──────────────────────────────────────────────

interface IndicationSuggestion {
  condition: string;
  trialCount: number;
  exampleCompanies: string[];
}

interface TAScanResult {
  ta: string;
  label: string;
  suggestions: IndicationSuggestion[];
  searchTerms: string[];
  errors: string[];
}

// ─── TA CONFIGURATION ───────────────────────────────────
// Maps each TA to its ClinicalTrials.gov search terms and
// the existing indication option arrays for comparison.

interface TAConfig {
  key: string;
  label: string;
  searchTerms: string[];
  getExistingIndications: () => string[];
}

/** Extract all indication labels from a grouped options array */
function extractLabels(
  options: { group: string; options: { value: string; label: string }[] }[]
): string[] {
  return options.flatMap((g) => g.options.map((o) => o.label.toLowerCase()));
}

/** Extract all indication values from a grouped options array */
function extractValues(
  options: { group: string; options: { value: string; label: string }[] }[]
): string[] {
  return options.flatMap((g) => g.options.map((o) => o.value.toLowerCase()));
}

const TA_CONFIGS: TAConfig[] = [
  {
    key: 'oncology',
    label: 'Oncology',
    searchTerms: [
      'solid tumor', 'KRAS G12D', 'Claudin 18.2', 'DLL3', 'EGFR exon 20',
      'HER2-low breast cancer', 'FGFR2', 'CDK2', 'PRMT5', 'WRN synthase',
      'bispecific T-cell engager solid tumor', 'claudin 6',
      'TROP2 ADC', 'Nectin-4', 'ROR1', 'GPC3 hepatocellular',
    ],
    getExistingIndications: () => extractLabels(indicationOptions).concat(extractValues(indicationOptions)),
  },
  {
    key: 'neurology',
    label: 'Neurology',
    searchTerms: [
      'TDP-43 proteinopathy', 'LRRK2 Parkinson', 'tau aggregation',
      'TREM2 Alzheimer', 'alpha-synuclein', 'GBA1 Parkinson',
      'NMDA receptor encephalitis', 'C9orf72 ALS', 'RIPK1 neurodegeneration',
      'Nav1.7 pain', 'CGRP cluster headache', 'orexin narcolepsy',
    ],
    getExistingIndications: () => extractLabels(neurologyIndicationOptions).concat(extractValues(neurologyIndicationOptions)),
  },
  {
    key: 'immunology',
    label: 'Immunology',
    searchTerms: [
      'TL1A inhibitor', 'anti-TL1A', 'CAR-T lupus', 'CAR-T autoimmune',
      'FcRn antagonist', 'complement C5a', 'TSLP inhibitor',
      'Bruton tyrosine kinase autoimmune', 'OX40L antibody',
      'IL-13 atopic', 'CD19 CAR-T systemic sclerosis', 'RIPK1 inflammation',
    ],
    getExistingIndications: () => extractLabels(immunologyIndicationOptions).concat(extractValues(immunologyIndicationOptions)),
  },
  {
    key: 'metabolic',
    label: 'Metabolic',
    searchTerms: [
      'triple agonist GLP-1 GIP glucagon', 'oral GLP-1',
      'amylin analog obesity', 'activin receptor obesity',
      'GIPR antagonist', 'FGF21 analog', 'DGAT2 inhibitor',
      'PNPLA3 NASH', 'THR-beta agonist liver', 'APOC3 inhibitor',
      'ketohexokinase inhibitor', 'GLP-1 MASH',
    ],
    getExistingIndications: () => extractLabels(metabolicIndicationOptions).concat(extractValues(metabolicIndicationOptions)),
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular',
    searchTerms: [
      'PCSK9 siRNA', 'factor XI inhibitor', 'Lp(a) antisense',
      'aldosterone synthase inhibitor', 'soluble guanylate cyclase',
      'myosin inhibitor cardiomyopathy', 'SGLT2 heart failure',
      'angiotensin receptor neprilysin', 'NLRP3 inflammasome cardiac',
    ],
    getExistingIndications: () => extractLabels(cardiovascularIndicationOptions).concat(extractValues(cardiovascularIndicationOptions)),
  },
  {
    key: 'infectiousDisease',
    label: 'Infectious Disease',
    searchTerms: [
      'broadly neutralizing antibody HIV', 'capsid inhibitor HIV',
      'mRNA influenza vaccine', 'RSV monoclonal antibody',
      'pan-coronavirus vaccine', 'antibiotic resistant gram-negative',
      'phage therapy', 'norovirus vaccine', 'HBV functional cure',
    ],
    getExistingIndications: () => extractLabels(infectiousDiseaseIndicationOptions).concat(extractValues(infectiousDiseaseIndicationOptions)),
  },
  {
    key: 'ophthalmology',
    label: 'Ophthalmology',
    searchTerms: [
      'geographic atrophy complement', 'gene therapy retinitis pigmentosa',
      'anti-VEGF bispecific eye', 'optogenetics blindness',
      'RPE65 gene therapy', 'RPGR gene therapy',
      'port delivery system aflibercept', 'RHO gene editing retina',
    ],
    getExistingIndications: () => extractLabels(ophthalmologyIndicationOptions).concat(extractValues(ophthalmologyIndicationOptions)),
  },
  {
    key: 'womensHealth',
    label: "Women's Health",
    searchTerms: [
      'GnRH antagonist endometriosis', 'oral GnRH uterine fibroid',
      'neurokinin 3 receptor hot flash', 'progesterone receptor modulator',
      'oxytocin antagonist preterm labor', 'PCOS insulin sensitizer',
    ],
    getExistingIndications: () => extractLabels(womensHealthIndicationOptions).concat(extractValues(womensHealthIndicationOptions)),
  },
  {
    key: 'rareDisease',
    label: 'Rare Disease',
    searchTerms: [
      'AAV gene therapy rare', 'base editing sickle cell',
      'CRISPR in vivo liver', 'enzyme replacement therapy',
      'mRNA therapy rare metabolic', 'substrate reduction therapy',
      'exon skipping DMD', 'antisense oligonucleotide rare',
    ],
    getExistingIndications: () => extractLabels(rareDiseaseIndicationOptions).concat(extractValues(rareDiseaseIndicationOptions)),
  },
  {
    key: 'hematology',
    label: 'Hematology',
    searchTerms: [
      'gene therapy hemophilia', 'fitusiran hemophilia',
      'emicizumab-like bispecific', 'pyruvate kinase activator',
      'complement inhibitor PNH', 'hepcidin mimetic',
      'anti-CD47 MDS', 'luspatercept anemia',
    ],
    getExistingIndications: () => extractLabels(hematologyIndicationOptions).concat(extractValues(hematologyIndicationOptions)),
  },
  {
    key: 'dermatology',
    label: 'Dermatology',
    searchTerms: [
      'IL-31 receptor pruritus', 'JAK inhibitor alopecia',
      'OX40 antibody atopic dermatitis', 'IL-13 antibody atopic',
      'TYK2 inhibitor psoriasis', 'IL-36 receptor antibody',
      'microbiome atopic dermatitis', 'topical JAK inhibitor vitiligo',
    ],
    getExistingIndications: () => extractLabels(dermatologyIndicationOptions).concat(extractValues(dermatologyIndicationOptions)),
  },
  {
    key: 'gastroenterology',
    label: 'Gastroenterology',
    searchTerms: [
      'anti-TL1A Crohn', 'oral integrin inhibitor IBD',
      'S1P receptor modulator ulcerative colitis',
      'vedolizumab subcutaneous', 'fecal microbiota transplant C. diff',
      'IL-23 inhibitor IBD', 'ozanimod ulcerative colitis',
    ],
    getExistingIndications: () => extractLabels(gastroenterologyIndicationOptions).concat(extractValues(gastroenterologyIndicationOptions)),
  },
];

// ─── CLINICALTRIALS.GOV API ─────────────────────────────

const CT_API_BASE = 'https://clinicaltrials.gov/api/v2/studies';
const MIN_TRIAL_THRESHOLD = 3; // Need 3+ Phase 2+ trials to suggest

interface CTStudy {
  protocolSection?: {
    identificationModule?: {
      briefTitle?: string;
      officialTitle?: string;
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: {
        name?: string;
      };
      collaborators?: { name?: string }[];
    };
    conditionsModule?: {
      conditions?: string[];
    };
  };
}

interface CTResponse {
  totalCount?: number;
  studies?: CTStudy[];
}

async function searchTrials(searchTerm: string): Promise<{
  totalCount: number;
  companies: string[];
  conditions: string[];
}> {
  const params = new URLSearchParams({
    'query.cond': searchTerm,
    'filter.phase': 'PHASE2,PHASE3',
    countTotal: 'true',
    pageSize: '10', // Grab a few to extract companies + conditions
    'fields': 'ProtocolSection.IdentificationModule.BriefTitle,ProtocolSection.SponsorCollaboratorsModule,ProtocolSection.ConditionsModule',
  });

  try {
    const res = await fetch(`${CT_API_BASE}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { totalCount: 0, companies: [], conditions: [] };
    }

    const data: CTResponse = await res.json();
    const totalCount = data.totalCount ?? 0;

    const companies = new Set<string>();
    const conditions = new Set<string>();

    for (const study of data.studies ?? []) {
      const sponsor = study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name;
      if (sponsor) companies.add(sponsor);

      for (const collab of study.protocolSection?.sponsorCollaboratorsModule?.collaborators ?? []) {
        if (collab.name) companies.add(collab.name);
      }

      for (const cond of study.protocolSection?.conditionsModule?.conditions ?? []) {
        conditions.add(cond);
      }
    }

    return {
      totalCount,
      companies: Array.from(companies).slice(0, 5),
      conditions: Array.from(conditions).slice(0, 10),
    };
  } catch (err) {
    console.error(`[IndicationEnrichment] Error searching "${searchTerm}":`, err);
    return { totalCount: 0, companies: [], conditions: [] };
  }
}

// ─── MATCHING LOGIC ─────────────────────────────────────

function isAlreadyKnown(searchTerm: string, existingIndications: string[]): boolean {
  const termLower = searchTerm.toLowerCase();

  // Check if the search term or any significant substring matches existing indications
  for (const existing of existingIndications) {
    const existingLower = existing.toLowerCase();
    // Direct containment either way
    if (existingLower.includes(termLower) || termLower.includes(existingLower)) {
      return true;
    }

    // Check key words (3+ char) overlap — if >60% of words match, consider it known
    const termWords = termLower.split(/\s+/).filter((w) => w.length >= 3);
    const existingWords = existingLower.split(/[\s/()]+/).filter((w) => w.length >= 3);
    if (termWords.length > 0) {
      const matchCount = termWords.filter((tw) =>
        existingWords.some((ew) => ew.includes(tw) || tw.includes(ew))
      ).length;
      if (matchCount / termWords.length > 0.6) return true;
    }
  }

  return false;
}

// ─── SCAN LOGIC ─────────────────────────────────────────

async function scanTA(config: TAConfig): Promise<TAScanResult> {
  const existingIndications = config.getExistingIndications();
  const suggestions: IndicationSuggestion[] = [];
  const errors: string[] = [];

  for (const term of config.searchTerms) {
    try {
      const result = await searchTrials(term);

      if (result.totalCount >= MIN_TRIAL_THRESHOLD) {
        // Check if this is genuinely new
        if (!isAlreadyKnown(term, existingIndications)) {
          suggestions.push({
            condition: term,
            trialCount: result.totalCount,
            exampleCompanies: result.companies,
          });
        }
      }

      // Rate-limit: ClinicalTrials.gov asks for max 3 req/sec
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      errors.push(`${term}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  // Sort by trial count descending
  suggestions.sort((a, b) => b.trialCount - a.trialCount);

  return {
    ta: config.key,
    label: config.label,
    suggestions,
    searchTerms: config.searchTerms,
    errors,
  };
}

// ─── SLACK NOTIFICATION ─────────────────────────────────

async function sendSlackNotification(results: TAScanResult[]): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const allSuggestions = results.flatMap((r) => r.suggestions);
  const tasWithSuggestions = results.filter((r) => r.suggestions.length > 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (allSuggestions.length === 0) {
    // Still send a brief "nothing new" notification
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Indication Enrichment Scan — ${dateStr}: No new indications found`,
        attachments: [{
          color: '#64748b',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: `Indication Enrichment Scan — ${dateStr}` } },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: No new indications detected across ${results.length} therapeutic areas.\nSearched ${results.reduce((s, r) => s + r.searchTerms.length, 0)} emerging targets.${totalErrors > 0 ? `\n:warning: ${totalErrors} API errors` : ''}`,
              },
            },
          ],
        }],
      }),
    });
    return;
  }

  // Build the rich notification
  const taBlocks: string[] = [];
  for (const result of tasWithSuggestions) {
    const lines = result.suggestions.map((s) => {
      const companies = s.exampleCompanies.length > 0
        ? ` (${s.exampleCompanies.slice(0, 3).join(', ')})`
        : '';
      return `  • *${s.condition}* — ${s.trialCount} Phase 2+ trials${companies}`;
    });
    taBlocks.push(`*${result.label}:*\n${lines.join('\n')}`);
  }

  const bodyText = taBlocks.join('\n\n');

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Indication Enrichment: ${allSuggestions.length} potential new indications found`,
      attachments: [{
        color: '#8b5cf6',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🔬 Indication Enrichment Scan — ${dateStr}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Found *${allSuggestions.length}* potential new indications across *${tasWithSuggestions.length}* therapeutic areas:`,
            },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: bodyText },
          },
          {
            type: 'context',
            elements: [{
              type: 'mrkdwn',
              text: `${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET | Threshold: ${MIN_TRIAL_THRESHOLD}+ Phase 2+ trials | ${results.reduce((s, r) => s + r.searchTerms.length, 0)} search terms scanned${totalErrors > 0 ? ` | ${totalErrors} errors` : ''}`,
            }],
          },
        ],
      }],
    }),
  });
}

// ─── ROUTE HANDLER ──────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth: require CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[IndicationEnrichment] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    // Scan all 12 TAs sequentially (rate-limited API)
    const results: TAScanResult[] = [];

    for (const config of TA_CONFIGS) {
      const result = await scanTA(config);
      results.push(result);
    }

    // Send Slack notification
    await sendSlackNotification(results);

    const totalSuggestions = results.reduce((s, r) => s + r.suggestions.length, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      durationMs,
      totalSuggestions,
      totalErrors,
      tasScanned: results.length,
      results: results.map((r) => ({
        ta: r.ta,
        label: r.label,
        suggestions: r.suggestions,
        searchTermsCount: r.searchTerms.length,
        errors: r.errors,
      })),
    });
  } catch (error) {
    console.error('[IndicationEnrichment] Fatal error:', error);
    return NextResponse.json(
      { error: 'Indication enrichment scan failed', details: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
