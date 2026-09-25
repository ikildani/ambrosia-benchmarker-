/**
 * Prompt, schema and vocabulary for the asset classification pass.
 *
 * Pure module: no I/O, no SDK, so the prompt text, the JSON schema handed to
 * the API's structured-output mode and the zod validator that gates every
 * write can be unit tested together (__tests__/lib/radar-classify.test.ts).
 *
 * Vocabulary sources (never redeclared here):
 *   therapeutic_area     lib/radar/vocab.ts RADAR_TA_OPTIONS
 *   modality             lib/radar/vocab.ts RADAR_MODALITY_OPTIONS
 *   indication_category  the set inferIndicationFromConditions emits
 *                        (lib/ingestion/clinical-trials.ts); asset-universe
 *                        deriveTA maps each to a therapeutic_area
 *   target_class         ChEMBL protein-class families (migration 112 CHECK)
 *
 * The system prompt is static so it can be served from the prompt cache;
 * anything per-request goes in the user message.
 */

import { z } from 'zod';
import { RADAR_MODALITY_OPTIONS, RADAR_TA_OPTIONS } from '@/lib/radar/vocab';

// ═══════════════════════════════════════════════════════════════════════
// VOCABULARIES
// ═══════════════════════════════════════════════════════════════════════

export const THERAPEUTIC_AREAS = RADAR_TA_OPTIONS.map(o => o.value) as [string, ...string[]];
export const MODALITIES = RADAR_MODALITY_OPTIONS.map(o => o.value) as [string, ...string[]];

/**
 * Exactly the categories lib/ingestion/clinical-trials.ts
 * inferIndicationFromConditions returns (in its check order). 'hematological'
 * is malignant (AML, myeloma, lymphoma); 'hematology' is non-malignant
 * (hemophilia, sickle cell, anemia). 'vaccine' is a prophylactic program;
 * both it and 'infectious' map to therapeutic_area infectious_disease.
 */
export const INDICATION_CATEGORIES = [
  'solid_tumor',
  'hematological',
  'cns',
  'autoimmune',
  'dermatology',
  'rare_disease',
  'infectious',
  'vaccine',
  'cardiovascular',
  'metabolic',
  'ophthalmology',
  'respiratory',
  'renal',
  'gastroenterology',
  'hematology',
  'womens_health',
  'musculoskeletal',
  'pain',
] as const;

export const TARGET_CLASSES = [
  'enzyme',
  'gpcr',
  'ion_channel',
  'transporter',
  'kinase',
  'nuclear_receptor',
  'cytokine',
  'antigen',
  'unknown',
] as const;

export type IndicationCategory = (typeof INDICATION_CATEGORIES)[number];
export type TargetClass = (typeof TARGET_CLASSES)[number];

/** Which input field decided the classification. */
export const EVIDENCE_SOURCES = [
  'asset_name',
  'aliases',
  'conditions',
  'brief_summary',
  'intervention_description',
  'drug_master',
  'prior_knowledge',
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export const INDICATION_SPECIFIC_MAX = 60;
export const MOA_SHORT_MAX = 80;
export const TARGET_MAX = 40;
export const PROMPT_VERSION = 'classify-v1';

// ═══════════════════════════════════════════════════════════════════════
// INPUT SHAPE (what the model sees per asset)
// ═══════════════════════════════════════════════════════════════════════

export interface ClassificationTrialInput {
  nct_id: string;
  title: string | null;
  conditions: string[];
  brief_summary: string | null;
}

export interface ClassificationInterventionInput {
  nct_id: string;
  name: string;
  other_names: string[];
  description: string | null;
}

export interface ClassificationDrugMasterInput {
  preferred_name: string;
  modality: string | null;
  target: string | null;
  mechanism: string | null;
  confidence: number;
}

export interface ClassificationInput {
  asset_id: string;
  asset_name: string;
  aliases: string[];
  company_name: string;
  /** Existing indications_all values (from the CT.gov heuristic). */
  indications_all: string[];
  /** Existing heuristic values, shown so the model can confirm or correct. */
  current: {
    therapeutic_area: string | null;
    modality: string | null;
    indication_category: string | null;
    indication_specific: string | null;
  };
  drug_master: ClassificationDrugMasterInput | null;
  trials: ClassificationTrialInput[];
  interventions: ClassificationInterventionInput[];
}

// ═══════════════════════════════════════════════════════════════════════
// OUTPUT SCHEMA (zod = the gate; JSON schema = the API format)
// ═══════════════════════════════════════════════════════════════════════

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform(v => (v === '' ? null : v));

export const ClassificationItemSchema = z.object({
  asset_id: z.string().min(1),
  therapeutic_area: z.enum(THERAPEUTIC_AREAS).nullable(),
  indication_category: z.enum(INDICATION_CATEGORIES).nullable(),
  indication_specific: nullableTrimmed(INDICATION_SPECIFIC_MAX),
  modality: z.enum(MODALITIES).nullable(),
  target: nullableTrimmed(TARGET_MAX),
  target_class: z.enum(TARGET_CLASSES).nullable(),
  moa_short: nullableTrimmed(MOA_SHORT_MAX),
  confidence: z.number().int().min(0).max(100),
  evidence: z.enum(EVIDENCE_SOURCES),
  /** One short clause the reviewer can read ("summary names anti-PD-1 antibody"). */
  rationale: z.string().trim().max(160),
});

export const ClassificationResponseSchema = z.object({
  results: z.array(ClassificationItemSchema),
});

export type ClassificationItem = z.infer<typeof ClassificationItemSchema>;
export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>;

/**
 * JSON schema for `output_config.format` ({ type: 'json_schema' }). Built
 * from the same vocab arrays as the zod schema so the two cannot drift; the
 * test suite asserts the enum lists are identical. Length limits are enforced
 * by zod (structured outputs only guarantee shape and enums).
 */
export function buildOutputJsonSchema(): Record<string, unknown> {
  // The structured-output validator rejects `enum` alongside a type union
  // ("Enum value 'oncology' does not match declared type ['string','null']"),
  // so nullable enums are expressed as anyOf.
  const nullableString = { type: ['string', 'null'] };
  const nullableEnum = (values: readonly string[]) => ({ anyOf: [{ type: 'string', enum: [...values] }, { type: 'null' }] });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'asset_id', 'therapeutic_area', 'indication_category', 'indication_specific',
            'modality', 'target', 'target_class', 'moa_short', 'confidence', 'evidence', 'rationale',
          ],
          properties: {
            asset_id: { type: 'string' },
            therapeutic_area: nullableEnum(THERAPEUTIC_AREAS),
            indication_category: nullableEnum(INDICATION_CATEGORIES),
            indication_specific: nullableString,
            modality: nullableEnum(MODALITIES),
            target: nullableString,
            target_class: nullableEnum(TARGET_CLASSES),
            moa_short: nullableString,
            // No minimum/maximum: the structured-output validator rejects range
            // keywords on integers ("For 'integer' type, properties maximum,
            // minimum are not supported"); zod enforces 0-100 after the call.
            confidence: { type: 'integer' },
            evidence: { type: 'string', enum: [...EVIDENCE_SOURCES] },
            rationale: { type: 'string' },
          },
        },
      },
    },
  };
}

/**
 * JSON Schema keywords the structured-output validator refuses. Every one of
 * these has, at some point, turned a whole classification run into 400s with
 * zero tokens spent, so the test suite asserts the emitted schema has none.
 * Constraints they would express are enforced by zod on the response instead.
 */
export const UNSUPPORTED_OUTPUT_SCHEMA_KEYWORDS: readonly string[] = [
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'pattern', 'format',
  'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties',
];

/** Paths (dot-joined) of every unsupported keyword found anywhere in `schema`. */
export function findUnsupportedKeywords(schema: unknown, path: string[] = []): string[] {
  if (Array.isArray(schema)) {
    return schema.flatMap((v, i) => findUnsupportedKeywords(v, [...path, String(i)]));
  }
  if (!schema || typeof schema !== 'object') return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    // Property names live under `properties` and are not keywords.
    const isPropertyName = path[path.length - 1] === 'properties';
    if (!isPropertyName && UNSUPPORTED_OUTPUT_SCHEMA_KEYWORDS.includes(key)) out.push([...path, key].join('.'));
    out.push(...findUnsupportedKeywords(value, [...path, key]));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT (static; cached)
// ═══════════════════════════════════════════════════════════════════════

const TA_GUIDE: Record<string, string> = {
  oncology: 'solid tumors and hematological malignancies (any cancer, incl. cancer vaccines and cancer cell therapy)',
  neurology: 'CNS, neurodegeneration, psychiatry, epilepsy, migraine, pain and analgesia, anesthesia',
  immunology: 'autoimmune and inflammatory disease, rheumatology, transplant rejection, allergy, musculoskeletal (OA, osteoporosis)',
  metabolic: 'diabetes, obesity, MASH/NASH, dyslipidemia, endocrine, lysosomal and inborn metabolic disorders when not rare-first',
  cardiovascular: 'heart, vascular, thrombosis, hypertension, and renal disease (CVRM convention: kidney programs go here)',
  rare_disease: 'orphan genetic disease that is not primarily oncology, neuro, or heme (e.g. DMD, cystic fibrosis, PKU, Fabry)',
  infectious_disease: 'bacterial, viral, fungal, parasitic infection, HIV, hepatitis B/C, sepsis, and all prophylactic vaccines',
  ophthalmology: 'retina, glaucoma, dry eye, cornea, uveitis, myopia',
  respiratory: 'asthma, COPD, IPF and other ILD, cystic fibrosis lung, pulmonary hypertension',
  dermatology: 'psoriasis, atopic dermatitis, hidradenitis, alopecia, vitiligo, acne, wound healing',
  hematology: 'non-malignant blood disease: hemophilia, sickle cell, thalassemia, ITP, PNH, anemia, transfusion',
  gastroenterology: 'IBD (Crohn, UC), IBS, celiac, liver disease other than MASH (PBC, PSC, ALD), pancreatitis',
  womens_health: 'endometriosis, fibroids, contraception, menopause, preterm labor, obstetric and gynecologic conditions',
};

const MODALITY_GUIDE: Record<string, string> = {
  small_molecule: 'synthetic chemical entity, oral or IV (-nib, -parib, -ciclib, -lutamide, cytotoxics, degraders/PROTACs, molecular glues)',
  antibody: 'monoclonal antibody or antibody fragment/Fc-fusion with one target (-mab, -cept), not ADC and not bispecific',
  adc: 'antibody-drug conjugate (payload words: vedotin, deruxtecan, govitecan, emtansine, tesirine, mafodotin)',
  bispecific: 'bispecific or multispecific antibody / T-cell engager (BiTE, DART, TCE, trispecific)',
  car_t: 'CAR-T, CAR-NK, CAR-macrophage, TCR-T engineered cell therapy (-leucel with cabtagene/ciloleucel; "chimeric antigen receptor")',
  cell_therapy: 'other cell therapy: MSC, iPSC-derived, TIL, NK, islet, stem cell, dendritic cell',
  gene_therapy: 'AAV, lentiviral, gene editing (CRISPR, base editing) delivering or editing a gene in vivo or ex vivo (-vec, -gene)',
  mrna: 'mRNA or self-amplifying RNA therapeutic or vaccine delivered in LNP',
  peptide: 'peptide or peptide hormone analog (-tide, GLP-1 agonists, -relin, -pressin, cyclic peptides)',
  oligonucleotide: 'siRNA, antisense (ASO), aptamer, miRNA, exon-skipping (-siran, -rsen, -mer)',
  radiopharm: 'radioligand or radiolabeled antibody/peptide (Lu-177, Ac-225, I-131, Ra-223, Ga-68, Zr-89)',
  vaccine: 'prophylactic vaccine (protein, conjugate, live-attenuated, viral-vector, DNA) — use mrna only when the platform is mRNA',
};

const CATEGORY_GUIDE: Record<IndicationCategory, string> = {
  solid_tumor: 'any solid tumor (lung, breast, CRC, HCC, melanoma, glioma, sarcoma, "advanced solid tumors")',
  hematological: 'malignant blood disease: leukemia, lymphoma, myeloma, MDS, myelofibrosis',
  cns: 'neurology and psychiatry, incl. neurodegeneration, epilepsy, migraine, stroke, sleep',
  autoimmune: 'RA, SLE, MS, IBD when immunology-led, psoriatic arthritis, vasculitis, myasthenia, transplant',
  dermatology: 'skin disease that is not autoimmune-systemic first: AD, psoriasis (skin), HS, alopecia, acne',
  rare_disease: 'orphan genetic / metabolic disorders (DMD, SMA, Fabry, Pompe, PKU, hereditary angioedema)',
  infectious: 'treatment of infection (antibacterial, antiviral, antifungal, HIV, HBV, HCV, RSV therapy)',
  vaccine: 'prophylactic immunization against a pathogen (not cancer vaccines: those are solid_tumor/hematological)',
  cardiovascular: 'heart failure, ACS, hypertension, arrhythmia, thrombosis, PAD, hypercholesterolemia',
  metabolic: 'T1D/T2D, obesity, MASH/NASH, dyslipidemia, endocrine disorders, gout',
  ophthalmology: 'AMD, DME, glaucoma, dry eye, retinitis pigmentosa, uveitis',
  respiratory: 'asthma, COPD, IPF, bronchiectasis, PAH, ARDS',
  renal: 'CKD, IgA nephropathy, FSGS, lupus nephritis (renal-led), dialysis complications, AKI',
  gastroenterology: 'IBD (GI-led), IBS, GERD, celiac, EoE, PBC/PSC, gastroparesis, short bowel',
  hematology: 'non-malignant blood: hemophilia, sickle cell, thalassemia, ITP, PNH, iron deficiency, anemia',
  womens_health: 'endometriosis, uterine fibroids, PCOS, contraception, menopause, preterm birth, preeclampsia',
  musculoskeletal: 'osteoarthritis, osteoporosis, muscular dystrophy when musculoskeletal-led, tendinopathy, sarcopenia',
  pain: 'acute or chronic pain, neuropathic pain, post-operative analgesia, anesthesia adjuncts',
};

const TARGET_CLASS_GUIDE: Record<TargetClass, string> = {
  enzyme: 'non-kinase enzyme: protease, PARP, HDAC, IDH, DPP-4, PDE, MMP, BACE, LRRK2 (GTPase), KRAS (GTPase), synthetases',
  gpcr: 'G-protein coupled receptor: GLP-1R, GIPR, CGRP receptor, opioid, dopamine, serotonin, chemokine receptors (CCR/CXCR), S1P',
  ion_channel: 'Nav, Cav, Kv, TRP, GABA-A, NMDA, nicotinic, CFTR, P2X, HCN',
  transporter: 'SGLT2, SERT, NET, DAT, URAT1, NTCP, ABC transporters, glucose/amino-acid transporters',
  kinase: 'protein or lipid kinase: EGFR, ALK, BTK, JAK, KRAS-pathway kinases (MEK, RAF, ERK), CDK, PI3K, mTOR, FGFR, MET, RET, TRK, TYK2',
  nuclear_receptor: 'androgen, estrogen, glucocorticoid, PPAR, FXR, THR-beta, RORgt, RAR, vitamin D receptor',
  cytokine: 'soluble cytokine, growth factor, or its receptor: IL-4/IL-13, IL-17, IL-23, TNF, IL-6, VEGF, TSLP, TGF-beta, IFN, complement',
  antigen: 'cell-surface antigen or checkpoint bound by an antibody, ADC, CAR or engager: PD-1, PD-L1, HER2, CD19, CD20, BCMA, TROP2, CLDN18.2, CTLA-4, LAG-3, PSMA, DLL3, Nectin-4',
  unknown: 'target undisclosed or not a single molecular target (cell therapy without a CAR, broad cytotoxic, microbiome, botanical)',
};

function bulletList(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');
}

/**
 * The system prompt. Deterministic and free of timestamps or per-run values
 * so the same bytes are sent every call and served from the prompt cache.
 */
export function buildSystemPrompt(): string {
  return `You are a biopharma asset-classification engine for an institutional business-development intelligence platform. You receive a JSON array of clinical-stage drug assets. Each asset carries the intervention name from ClinicalTrials.gov, its aliases, the sponsor, up to three trials (title, conditions, brief summary), the intervention descriptions registered on those trials, the heuristic values already stored, and, when the drug has been resolved against public registries, the drug_master node (preferred name, modality, target, mechanism, confidence).

Classify every asset on the fields below and return one JSON object per asset in the same order, keyed by asset_id. Return exactly one result per input asset; never add, drop, or merge assets.

FIELDS AND ALLOWED VALUES (use these exact lowercase strings; anything else is rejected and the asset is sent to human review)

therapeutic_area: one of ${THERAPEUTIC_AREAS.join(', ')} — or null when the disease area cannot be determined.
${bulletList(TA_GUIDE)}

indication_category: one of ${INDICATION_CATEGORIES.join(', ')} — or null. This is the finer bucket that rolls up into therapeutic_area (solid_tumor and hematological roll up to oncology; cns and pain to neurology; autoimmune and musculoskeletal to immunology; renal to cardiovascular; infectious and vaccine to infectious_disease). Keep the two consistent.
${bulletList(CATEGORY_GUIDE)}

indication_specific: the lead disease as a short clinical name of at most ${INDICATION_SPECIFIC_MAX} characters, e.g. "non-small cell lung cancer", "atopic dermatitis", "IgA nephropathy", "relapsed/refractory multiple myeloma". Prefer the most specific disease named in the conditions or summary over generic labels such as "solid tumor" or "cancer". Null when nothing specific is stated.

modality: one of ${MODALITIES.join(', ')} — or null when the modality is undisclosed.
${bulletList(MODALITY_GUIDE)}
Precedence when several apply: radiopharm and adc beat antibody; bispecific beats antibody; car_t beats cell_therapy; mrna beats vaccine when the platform is mRNA; a peptide conjugated to a radionuclide is radiopharm. Decide from INN stems, intervention descriptions, and the drug_master node, in that order of reliability.

target: the molecular target as an HGNC symbol or the standard clinical name, at most ${TARGET_MAX} characters: "PD-1", "PD-L1", "HER2", "KRAS G12C", "TROP2", "CD19", "BCMA", "GLP-1R", "IL-23p19", "TYK2", "CLDN18.2", "SOD1". For a bispecific write both joined with "x" ("CD3 x CD20"). For a combination or a program whose target is undisclosed, null.

target_class: one of ${TARGET_CLASSES.join(', ')}. Use "unknown" when target is null or when the agent has no single protein target.
${bulletList(TARGET_CLASS_GUIDE)}

moa_short: mechanism of action in at most ${MOA_SHORT_MAX} characters, active voice, no trade names: "PD-1 blocking antibody", "KRAS G12C covalent inhibitor", "CD19-directed autologous CAR-T", "GLP-1/GIP dual receptor agonist", "TROP2-directed ADC with topoisomerase I payload". Null only when nothing about the mechanism is known.

confidence: integer 0-100 for the row as a whole. Calibrate as follows.
  - 90-100: the name is a recognized INN or brand and the mechanism is textbook, or the drug_master node carries modality and target and the trial text agrees.
  - 75-89: a sponsor code name whose trial summary or intervention description states the target or mechanism explicitly.
  - 60-74: the therapeutic area and modality are clear from the conditions and INN stem but the target is inferred, not stated.
  - below 60: the text is generic, the intervention is a backbone or comparator, the name is ambiguous across different drugs, or you are relying on a guess. Anything below 60 is not written to the database; it is parked for review, so be honest rather than optimistic.

evidence: which input decided the classification: one of ${EVIDENCE_SOURCES.join(', ')}. "prior_knowledge" means the drug is well known to you and the inputs merely agree; use it only when the name is an unambiguous INN or brand.

rationale: one clause of at most 160 characters a reviewer can check against the inputs, e.g. "summary states anti-TROP2 ADC with SN-38 payload; conditions list TNBC".

RULES
1. Never change or output the development phase; it is owned by the trial ingester.
2. Treat the stored "current" values as heuristic hints, not truth. If the conditions or summary contradict them, output the correct value and lower nothing else. If they agree, confirm them.
3. Use only the supplied inputs plus well-established pharmacology of named drugs. Do not invent a target for a code name whose mechanism is not in the text; return target null, target_class "unknown", and a confidence below 60 if nothing else is certain.
4. Combination arms ("A + B", "in combination with"): classify the novel component named first in asset_name; the moa_short describes that component only.
5. Prophylactic vaccines: therapeutic_area infectious_disease, indication_category vaccine, modality vaccine or mrna, target the pathogen antigen ("RSV F protein", "SARS-CoV-2 spike"), target_class antigen.
6. Oncology cell therapies and cancer vaccines are oncology / solid_tumor or hematological, never "vaccine".
7. Diagnostics, imaging agents, procedures, devices, dietary supplements, and behavioral interventions are not drugs: return every field null, target_class "unknown", confidence 0, evidence "asset_name".
8. Output must be valid JSON matching the provided schema, with no prose outside it.`;
}

// ═══════════════════════════════════════════════════════════════════════
// USER MESSAGE (per batch)
// ═══════════════════════════════════════════════════════════════════════

export const BRIEF_SUMMARY_MAX_CHARS = 700;
export const INTERVENTION_DESCRIPTION_MAX_CHARS = 350;
export const MAX_TRIALS_PER_ASSET = 3;
export const MAX_INTERVENTIONS_PER_ASSET = 3;
export const MAX_ALIASES_PER_ASSET = 8;
export const MAX_CONDITIONS_PER_TRIAL = 8;

function clip(text: string | null | undefined, max: number): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Compact, deterministic JSON for one batch. Field order is fixed so identical inputs serialize identically. */
export function buildUserMessage(assets: ClassificationInput[]): string {
  const payload = assets.map(a => ({
    asset_id: a.asset_id,
    asset_name: a.asset_name,
    aliases: a.aliases.slice(0, MAX_ALIASES_PER_ASSET),
    sponsor: a.company_name,
    current: a.current,
    indications_all: a.indications_all.slice(0, 10),
    drug_master: a.drug_master
      ? {
          preferred_name: a.drug_master.preferred_name,
          modality: a.drug_master.modality,
          target: a.drug_master.target,
          mechanism: clip(a.drug_master.mechanism, 160),
          confidence: a.drug_master.confidence,
        }
      : null,
    trials: a.trials.slice(0, MAX_TRIALS_PER_ASSET).map(t => ({
      nct_id: t.nct_id,
      title: clip(t.title, 200),
      conditions: t.conditions.slice(0, MAX_CONDITIONS_PER_TRIAL),
      brief_summary: clip(t.brief_summary, BRIEF_SUMMARY_MAX_CHARS),
    })),
    interventions: a.interventions.slice(0, MAX_INTERVENTIONS_PER_ASSET).map(i => ({
      nct_id: i.nct_id,
      name: i.name,
      other_names: i.other_names.slice(0, 5),
      description: clip(i.description, INTERVENTION_DESCRIPTION_MAX_CHARS),
    })),
  }));
  return `Classify these ${assets.length} assets. Return {"results": [...]} with one entry per asset_id, in input order.\n\n${JSON.stringify(payload)}`;
}
