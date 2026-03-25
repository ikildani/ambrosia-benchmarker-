/**
 * Topic rotation engine for daily SEO blog generation.
 * Enumerates TA x DealType x Modality x Phase combos and avoids duplicates
 * by querying seo_content_log for already-generated topic_keys.
 */

import { type TherapeuticArea, type Phase, type DealType, type Modality } from '@/lib/calculations';
import { type SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TopicCandidate {
  topicKey: string;           // e.g., "oncology:licensing:adc:phase2"
  therapeuticArea: TherapeuticArea;
  dealType: DealType;
  modality: Modality;
  phase: Phase;
  title: string;              // Suggested blog title
  targetKeyword: string;
}

// ── Priority-ordered dimension arrays ────────────────────────────────────────

const TAS: { key: TherapeuticArea; label: string }[] = [
  { key: 'oncology', label: 'Oncology' },
  { key: 'neurology', label: 'Neurology' },
  { key: 'immunology', label: 'Immunology' },
  { key: 'metabolic', label: 'Metabolic' },
  { key: 'cardiovascular', label: 'Cardiovascular' },
  { key: 'rareDisease', label: 'Rare Disease' },
  { key: 'hematology', label: 'Hematology' },
  { key: 'infectiousDisease', label: 'Infectious Disease' },
  { key: 'ophthalmology', label: 'Ophthalmology' },
  { key: 'dermatology', label: 'Dermatology' },
  { key: 'gastroenterology', label: 'Gastroenterology' },
  { key: 'womensHealth', label: "Women's Health" },
];

const DEAL_TYPES: { key: DealType; label: string }[] = [
  { key: 'licensing', label: 'Licensing' },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'codevelopment', label: 'Co-Development' },
  { key: 'option', label: 'Option' },
  { key: 'collaboration', label: 'Collaboration' },
];

const MODALITIES: { key: Modality; label: string }[] = [
  { key: 'adc', label: 'ADC' },
  { key: 'bispecific', label: 'Bispecific Antibody' },
  { key: 'smallMolecule', label: 'Small Molecule' },
  { key: 'mab', label: 'Monoclonal Antibody' },
  { key: 'geneTherapy', label: 'Gene Therapy' },
  { key: 'cellTherapy', label: 'Cell Therapy' },
  { key: 'rnai', label: 'RNAi' },
  { key: 'mrna', label: 'mRNA' },
  { key: 'protac', label: 'PROTAC' },
  { key: 'carT_heme', label: 'CAR-T (Hematologic)' },
  { key: 'peptide', label: 'Peptide' },
  { key: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
  { key: 'aso', label: 'ASO' },
  { key: 'glp1Agonist', label: 'GLP-1 Agonist' },
  { key: 'antiVegf', label: 'Anti-VEGF' },
];

const PHASES: { key: Phase; label: string }[] = [
  { key: 'phase2', label: 'Phase 2' },
  { key: 'phase3', label: 'Phase 3' },
  { key: 'preclinical', label: 'Preclinical' },
  { key: 'phase1', label: 'Phase 1' },
  { key: 'approved', label: 'Approved' },
];

// ── Title generation ─────────────────────────────────────────────────────────

const TITLE_TEMPLATES = [
  (m: string, ta: string, dt: string, p: string) =>
    `${m} ${ta} ${dt} Deals: ${p} Benchmarks & Deal Structure Analysis`,
  (m: string, ta: string, dt: string, _p: string) =>
    `${ta} ${dt} Trends 2026: ${m} Deal Economics`,
  (m: string, ta: string, _dt: string, p: string) =>
    `How ${p} ${m} ${ta} Deals Are Structured in 2026`,
  (m: string, ta: string, dt: string, p: string) =>
    `${p} ${m} ${ta} ${dt}: Upfront Payments, Milestones & Royalties`,
  (m: string, ta: string, dt: string, _p: string) =>
    `${ta} ${m} ${dt} Deal Terms: What the Data Shows`,
];

function generateTitle(
  modalityLabel: string,
  taLabel: string,
  dealTypeLabel: string,
  phaseLabel: string,
  index: number,
): string {
  const template = TITLE_TEMPLATES[index % TITLE_TEMPLATES.length];
  return template(modalityLabel, taLabel, dealTypeLabel, phaseLabel);
}

function generateTargetKeyword(
  modalityLabel: string,
  taLabel: string,
  dealTypeLabel: string,
  phaseLabel: string,
): string {
  return `${modalityLabel} ${taLabel} ${dealTypeLabel} ${phaseLabel} deal terms`.toLowerCase();
}

// ── Main function ────────────────────────────────────────────────────────────

/**
 * Returns the next un-generated topic candidate, or null if all combos exhausted.
 * Priority order: high-volume TAs first, then phases (phase2 > phase3 > preclinical),
 * then modalities, then deal types.
 */
export async function getNextTopic(
  supabase: SupabaseClient,
): Promise<TopicCandidate | null> {
  // 1. Generate all valid combos in priority order
  const candidates: TopicCandidate[] = [];
  let comboIndex = 0;

  for (const ta of TAS) {
    for (const phase of PHASES) {
      for (const modality of MODALITIES) {
        for (const dealType of DEAL_TYPES) {
          const topicKey = `${ta.key}:${dealType.key}:${modality.key}:${phase.key}`;
          candidates.push({
            topicKey,
            therapeuticArea: ta.key,
            dealType: dealType.key,
            modality: modality.key,
            phase: phase.key,
            title: generateTitle(modality.label, ta.label, dealType.label, phase.label, comboIndex),
            targetKeyword: generateTargetKeyword(modality.label, ta.label, dealType.label, phase.label),
          });
          comboIndex++;
        }
      }
    }
  }

  // 2. Query seo_content_log for already-generated topic_keys
  const { data: existingLogs, error } = await supabase
    .from('seo_content_log')
    .select('topic_key')
    .eq('content_type', 'blog_post');

  if (error) {
    console.error('[topic-rotation] Failed to query seo_content_log:', error.message);
    // Fall back to returning the first candidate if we can't check history
    return candidates[0] || null;
  }

  const usedKeys = new Set((existingLogs || []).map((row) => row.topic_key));

  // 3. Filter out already-generated, return first remaining
  for (const candidate of candidates) {
    if (!usedKeys.has(candidate.topicKey)) {
      return candidate;
    }
  }

  // 4. All combos exhausted
  return null;
}
