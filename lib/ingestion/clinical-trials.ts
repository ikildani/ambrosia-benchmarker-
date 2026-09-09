// ClinicalTrials.gov Pipeline Intelligence Ingestion
// Tracks active trials for pharma/biotech companies

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const CT_API_V2 = 'https://clinicaltrials.gov/api/v2/studies';

/** CT.gov intervention types that describe a licensable drug/biologic asset. */
export const DRUG_INTERVENTION_TYPES = ['DRUG', 'BIOLOGICAL', 'GENETIC', 'COMBINATION_PRODUCT'] as const;

/**
 * CT.gov API v2 Essie expression (filter.advanced) restricting results to
 * interventional studies with at least one drug-class intervention.
 * Verified against the live API: AREA[StudyType]INTERVENTIONAL and
 * AREA[InterventionType]COMBINATION_PRODUCT both resolve.
 */
export const DRUG_STUDY_FILTER =
  'AREA[StudyType]INTERVENTIONAL AND (' +
  DRUG_INTERVENTION_TYPES.map(t => `AREA[InterventionType]${t}`).join(' OR ') +
  ')';

/**
 * The intervention that represents the asset: the first drug-class
 * intervention (a combined trial may list a procedure or device first),
 * falling back to the first intervention of any type.
 */
export function pickPrimaryIntervention<T extends { type: string }>(interventions: T[]): T | undefined {
  const drugTypes: readonly string[] = DRUG_INTERVENTION_TYPES;
  return interventions.find(i => drugTypes.includes((i.type || '').toUpperCase().replace(/\s+/g, '_')))
    ?? interventions[0];
}

// Top 150+ pharma/biotech companies to track
export const COMPANIES_TO_TRACK = [
  // Large Pharma
  'Pfizer', 'Merck', 'Novartis', 'Roche', 'AstraZeneca',
  'Bristol-Myers Squibb', 'Johnson & Johnson', 'AbbVie',
  'Gilead Sciences', 'Amgen', 'Regeneron', 'Eli Lilly', 'Sanofi',
  'GSK', 'Takeda', 'Boehringer Ingelheim', 'Bayer',
  'Novo Nordisk', 'Merck KGaA',

  // Large Biotech
  'Biogen', 'Vertex', 'Moderna', 'BioNTech', 'Alexion',
  'BioMarin', 'Incyte', 'Seagen', 'Jazz Pharmaceuticals',
  'Neurocrine', 'Alkermes', 'Exact Sciences', 'Argenx',

  // Rare Disease
  'Ultragenyx', 'Sarepta', 'Sobi', 'Ipsen', 'Insmed',

  // Ophthalmology
  'Alcon', 'Bausch + Lomb', 'Apellis',

  // CV/Metabolic
  'BridgeBio', 'Madrigal Pharmaceuticals', 'Structure Therapeutics',

  // Respiratory/Immunology
  'Teva', 'Chiesi', 'Iovance Biotherapeutics',

  // Dermatology
  'Roivant Sciences', 'Arcutis Biotherapeutics', 'Sun Pharma',
  'LEO Pharma', 'Galapagos',

  // Mid-cap Biotech
  'Blueprint Medicines', 'Agios', 'Rocket Pharmaceuticals',
  'Syndax', 'Protagonist', 'Revolution Medicines', 'Y-mAbs',
  'Legend Biotech', 'Replimune', 'MacroGenics', 'ImmunoGen',
  'Arcus Biosciences', 'CRISPR Therapeutics', 'Intellia',
  'Editas Medicine', 'Beam Therapeutics', 'Prime Medicine',
  'Allogene', 'Autolus', 'Fate Therapeutics', 'Poseida',
  'Caribou Biosciences', 'Precision BioSciences', '2seventy bio',
  'Intra-Cellular Therapies', 'Exelixis', 'Zealand Pharma',
  'Rhythm Pharmaceuticals', 'Travere Therapeutics',

  // ADC/Bispecific specialists
  'Daiichi Sankyo', 'Astellas', 'Zymeworks', 'Mersana',
  'ADC Therapeutics', 'Immunomedics', 'Sutro', 'Pyxis Oncology',

  // Cell/Gene Therapy
  'Spark Therapeutics', 'Bluebird Bio', 'Sarepta', 'Solid Biosciences',
  'Voyager Therapeutics', 'Passage Bio', 'Prevail Therapeutics',
  'LogicBio', 'Generation Bio', 'Encoded Therapeutics',

  // Radiopharmaceuticals
  'Lantheus', 'Point Biopharma',
  'Fusion Pharmaceuticals', 'RayzeBio', 'Aktis Oncology',

  // Emerging/Specialty
  'Alnylam', 'Ionis', 'Arrowhead', 'Dicerna',
  'Bicycle Therapeutics', 'Cullinan', 'Erasca', 'Nuvalent',
  'Relay Therapeutics', 'Recursion', 'Exscientia', 'Schrodinger',

  // Regional — Japan
  'Eisai', 'Shionogi', 'Chugai', 'Ono Pharmaceutical',
  'Sumitomo Pharma', 'Otsuka', 'Mitsubishi Tanabe',

  // Regional — China/Korea
  'BeiGene', 'Zai Lab', 'Hutchmed', 'Innovent',
  'Hengrui', 'CSPC Pharmaceutical', 'Celltrion', 'Samsung Biologics',

  // Regional — Europe/Other
  'Recordati', 'Menarini', 'Servier',

  // Regional — India
  'Lupin', 'Dr. Reddy\'s', 'Cipla',
];

export interface CTStudy {
  nctId: string;
  title: string;
  acronym: string | null;
  briefSummary: string | null;
  sponsor: string;
  sponsorType: string;
  phase: string;
  status: string;
  conditions: string[];
  interventions: Intervention[];
  collaborators: string[];
  startDate: string | null;
  primaryCompletionDate: string | null;
  completionDate: string | null;
  lastUpdatePosted: string | null;
  enrollmentCount: number | null;
  locations: string[];
  hasResults: boolean;
  primaryOutcomes: Array<{ measure: string; description: string | null; timeFrame: string | null }>;
  secondaryOutcomes: Array<{ measure: string; description: string | null; timeFrame: string | null }>;
}

interface Intervention {
  name: string;
  type: string;
  description: string | null;
}

export async function fetchCompanyTrials(
  companyName: string,
  statusFilter: string[] = ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING', 'ENROLLING_BY_INVITATION']
): Promise<CTStudy[]> {
  const studies: CTStudy[] = [];
  let pageToken: string | null = null;
  let pageCount = 0;
  const maxPages = 10; // Limit to prevent runaway requests

  do {
    try {
      const params = new URLSearchParams({
        'query.spons': companyName,
        'filter.overallStatus': statusFilter.join(','),
        // Only interventional studies of a drug/biologic/genetic/combination
        // product. Devices, procedures, behavioral, dietary-supplement and
        // observational studies were becoming "assets" in clinical_assets.
        'filter.advanced': DRUG_STUDY_FILTER,
        'pageSize': '100',
        'fields': [
          'NCTId',
          'BriefTitle',
          'Acronym',
          'BriefSummary',
          'LeadSponsorName',
          'LeadSponsorClass',
          'Phase',
          'OverallStatus',
          'Condition',
          'InterventionName',
          'InterventionType',
          'InterventionDescription',
          'CollaboratorName',
          'StartDate',
          'PrimaryCompletionDate',
          'CompletionDate',
          'EnrollmentCount',
          'LocationCountry',
          'ResultsFirstPostDate',
          'LastUpdatePostDate',
          'PrimaryOutcomeMeasure',
          'SecondaryOutcomeMeasure',
        ].join(','),
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetchWithTimeout(`${CT_API_V2}?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
        timeoutMs: 20_000,
        retries: 1,
      });

      if (!response.ok) {
        console.error(`ClinicalTrials API error: ${response.status}`);
        break;
      }

      const data = await response.json();

      if (data.studies && data.studies.length > 0) {
        for (const study of data.studies) {
          const protocol = study.protocolSection;
          const identification = protocol?.identificationModule;
          const status = protocol?.statusModule;
          const sponsor = protocol?.sponsorCollaboratorsModule;
          const design = protocol?.designModule;
          const conditions = protocol?.conditionsModule;
          const interventions = protocol?.armsInterventionsModule;
          const contacts = protocol?.contactsLocationsModule;
          const results = study?.resultsSection;
          const outcomes = protocol?.outcomesModule;

          studies.push({
            nctId: identification?.nctId || '',
            title: identification?.briefTitle || '',
            acronym: identification?.acronym || null,
            briefSummary: protocol?.descriptionModule?.briefSummary || null,
            sponsor: sponsor?.leadSponsor?.name || companyName,
            sponsorType: sponsor?.leadSponsor?.class || 'UNKNOWN',
            phase: mapPhase(design?.phases),
            status: mapStatus(status?.overallStatus),
            conditions: conditions?.conditions || [],
            interventions: (interventions?.interventions || []).map((i: { name?: string; type?: string; description?: string }) => ({
              name: i.name || '',
              type: i.type || '',
              description: i.description || null,
            })),
            collaborators: (sponsor?.collaborators || []).map((c: { name?: string }) => c.name),
            startDate: normalizeDate(status?.startDateStruct?.date),
            primaryCompletionDate: normalizeDate(status?.primaryCompletionDateStruct?.date),
            completionDate: normalizeDate(status?.completionDateStruct?.date),
            lastUpdatePosted: normalizeDate(status?.lastUpdatePostDateStruct?.date),
            enrollmentCount: design?.enrollmentInfo?.count || null,
            locations: Array.from(new Set(contacts?.locations?.map((l: { country?: string }) => l.country) || [])),
            hasResults: !!results || !!status?.resultsFirstPostDateStruct,
            primaryOutcomes: (outcomes?.primaryOutcomes || []).map((o: { measure?: string; description?: string; timeFrame?: string }) => ({
              measure: o.measure || '',
              description: o.description || null,
              timeFrame: o.timeFrame || null,
            })),
            secondaryOutcomes: (outcomes?.secondaryOutcomes || []).map((o: { measure?: string; description?: string; timeFrame?: string }) => ({
              measure: o.measure || '',
              description: o.description || null,
              timeFrame: o.timeFrame || null,
            })),
          });
        }
      }

      // Break if no studies returned (API may still provide nextPageToken)
      if (!data.studies || data.studies.length === 0) {
        break;
      }

      pageToken = data.nextPageToken || null;
      pageCount++;

      // Rate limiting
      await sleep(200);

    } catch (error) {
      console.error(`Error fetching trials for ${companyName}:`, error);
      break;
    }
  } while (pageToken && pageCount < maxPages);

  return studies;
}

export function inferModalityFromIntervention(interventions: Intervention[]): string {
  const text = interventions
    .map(i => `${i.name} ${i.type} ${i.description || ''}`)
    .join(' ')
    .toLowerCase();

  // ADC detection
  if (text.includes('adc') ||
      text.includes('antibody-drug conjugate') ||
      text.includes('antibody drug conjugate') ||
      text.includes('drug conjugate')) {
    return 'adc';
  }

  // Bispecific detection
  if (text.includes('bispecific') ||
      text.includes('bi-specific') ||
      text.includes('dual-targeting')) {
    return 'bispecific';
  }

  // CAR-T detection
  if (text.includes('car-t') ||
      text.includes('car t') ||
      text.includes('chimeric antigen receptor') ||
      text.includes('cart cell')) {
    return 'car_t';
  }

  // Cell therapy (non-CAR-T)
  if (text.includes('cell therapy') ||
      text.includes('cellular therapy') ||
      text.includes('stem cell') ||
      text.includes('nk cell') ||
      text.includes('tcr ')) {
    return 'cell_therapy';
  }

  // Gene therapy
  if (text.includes('gene therapy') ||
      text.includes('aav') ||
      text.includes('adeno-associated') ||
      text.includes('lentiviral') ||
      text.includes('gene transfer')) {
    return 'gene_therapy';
  }

  // mRNA
  if (text.includes('mrna') ||
      text.includes('messenger rna') ||
      text.includes('modified rna')) {
    return 'mrna';
  }

  // Radiopharmaceuticals
  if (text.includes('radiopharm') ||
      text.includes('radioligand') ||
      text.includes('radionuclide') ||
      text.includes('radioimmuno') ||
      text.includes('lutetium') ||
      text.includes('actinium')) {
    return 'radiopharm';
  }

  // Oligonucleotides
  if (text.includes('antisense') ||
      text.includes('sirna') ||
      text.includes('rnai') ||
      text.includes('oligonucleotide')) {
    return 'oligonucleotide';
  }

  // Peptide
  if (text.includes('peptide') && !text.includes('polypeptide')) {
    return 'peptide';
  }

  // Standard antibody
  if (text.includes('antibody') ||
      text.includes('mab') ||
      interventions.some(i => i.type === 'BIOLOGICAL' && i.name.toLowerCase().endsWith('mab'))) {
    return 'antibody';
  }

  // Check intervention types
  const types = interventions.map(i => i.type);
  if (types.includes('DRUG')) {
    return 'small_molecule';
  }

  return 'other';
}

// ─── Term matching helpers ──────────────────────────────────────────────
// Short tokens (acronyms such as ALL, HIV, AML, MDS, IBS) must match as whole
// words: plain substring matching turned "allergic", "hive", "hamlet" or
// "small" into ALL / HIV / AML hits. Longer patterns keep substring semantics
// so stems like "neurodegenerat" and "retin" still work.
const WHOLE_WORD_MAX_LEN = 5;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word match that treats any non-alphanumeric character as a boundary. */
function hasWord(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, 'i').test(text);
}

function matchesTerm(text: string, term: string): boolean {
  return term.length <= WHOLE_WORD_MAX_LEN ? hasWord(text, term) : text.includes(term);
}

function matchesAny(text: string, terms: string[]): boolean {
  return terms.some(t => matchesTerm(text, t));
}

function firstMatch(text: string, map: Record<string, string>): string | null {
  for (const [pattern, specific] of Object.entries(map)) {
    if (matchesTerm(text, pattern)) return specific;
  }
  return null;
}

/**
 * Classify a trial's conditions into a company_trials.indication_category.
 *
 * Categories: solid_tumor, hematological, cns, autoimmune, dermatology,
 * rare_disease, infectious, vaccine, cardiovascular, metabolic, ophthalmology,
 * respiratory, renal, gastroenterology, hematology (non-malignant),
 * womens_health, musculoskeletal, pain. lib/radar/asset-universe.ts
 * (deriveTA) maps each of these to a Radar therapeutic_area.
 *
 * Order matters: more specific / higher-value categories are checked first.
 */
export function inferIndicationFromConditions(conditions: string[]): {
  category: string | null;
  specific: string | null;
} {
  const text = conditions.join(' ').toLowerCase();

  // Solid tumors
  const solidTumorMap: Record<string, string> = {
    'lung cancer': 'lung',
    'nsclc': 'nsclc',
    'non-small cell lung': 'nsclc',
    'small cell lung': 'sclc',
    'breast cancer': 'breast',
    'triple negative': 'tnbc',
    'colorectal': 'colorectal',
    'colon cancer': 'colorectal',
    'pancreatic': 'pancreatic',
    'ovarian': 'ovarian',
    'prostate': 'prostate',
    'gastric': 'gastric',
    'stomach cancer': 'gastric',
    'hepatocellular': 'hcc',
    'liver cancer': 'hcc',
    'melanoma': 'melanoma',
    'glioblastoma': 'glioblastoma',
    'gbm': 'glioblastoma',
    'renal cell': 'rcc',
    'kidney cancer': 'rcc',
    'bladder': 'bladder',
    'urothelial': 'bladder',
    'head and neck': 'head_neck',
    'esophageal': 'esophageal',
    // 'thyroid' alone matched hypothyroid / hyperthyroid / parathyroid trials
    'thyroid cancer': 'thyroid',
    'thyroid carcinoma': 'thyroid',
    'thyroid neoplasm': 'thyroid',
    'thyroid tumor': 'thyroid',
    'sarcoma': 'sarcoma',
    'mesothelioma': 'mesothelioma',
    'cholangiocarcinoma': 'cholangiocarcinoma',
    'endometrial': 'endometrial',
    'cervical': 'cervical',
    'solid tumor': 'solid_tumor',
    'solid tumour': 'solid_tumor',
    'advanced cancer': 'solid_tumor',
    'metastatic cancer': 'solid_tumor',
    'neuroendocrine': 'neuroendocrine',
    'carcinoma': 'solid_tumor',
    'adenocarcinoma': 'solid_tumor',
  };

  const solid = firstMatch(text, solidTumorMap);
  if (solid) return { category: 'solid_tumor', specific: solid };

  // Hematological malignancies
  const hemeMap: Record<string, string> = {
    'acute myeloid leukemia': 'aml',
    'aml': 'aml',
    'chronic lymphocytic leukemia': 'cll',
    'cll': 'cll',
    'acute lymphoblastic': 'all',
    'all': 'all',
    'multiple myeloma': 'myeloma',
    'myeloma': 'myeloma',
    'diffuse large b-cell': 'dlbcl',
    'dlbcl': 'dlbcl',
    'follicular lymphoma': 'follicular_lymphoma',
    'mantle cell': 'mcl',
    'hodgkin': 'hodgkin',
    'non-hodgkin': 'nhl',
    'myelodysplastic': 'mds',
    'mds': 'mds',
    'chronic myeloid': 'cml',
    'cml': 'cml',
    'waldenström': 'waldenstrom',
    'waldenstrom': 'waldenstrom',
    't-cell lymphoma': 'tcl',
    'myelofibrosis': 'mpn',
    'polycythemia': 'mpn',
    'myeloproliferative': 'mpn',
    'lymphoma': 'lymphoma',
    'leukemia': 'leukemia',
    'leukaemia': 'leukemia',
  };

  const heme = firstMatch(text, hemeMap);
  if (heme) return { category: 'hematological', specific: heme };

  // CNS / Neurology — specific conditions only, no broad terms
  if (matchesAny(text, [
    'alzheimer', 'parkinson', 'multiple sclerosis', 'neurodegenerat',
    'huntington', 'amyotrophic lateral', 'epilepsy', 'seizure',
    'schizophrenia', 'major depressive', 'bipolar disorder', 'anxiety disorder',
    'generalized anxiety', 'social anxiety', 'obsessive compulsive', 'ocd',
    'ptsd', 'post-traumatic stress', 'adhd', 'attention deficit',
    'autism spectrum', 'narcolepsy', 'insomnia', 'migraine',
    'cluster headache', 'neuropathic pain', 'peripheral neuropathy', 'diabetic neuropathy',
    'stroke', 'cerebrovascular', 'traumatic brain injury', 'spinal cord injury',
    'dementia', 'lewy body', 'frontotemporal', 'dystonia',
    'myasthenia gravis', 'cerebral palsy', 'neuropsychiatric', 'fibromyalgia',
    'neuropathy', 'neuralgia', 'glioma', 'brain tumor',
  ])) {
    return { category: 'cns', specific: null };
  }

  // Autoimmune / Immunology — specific conditions, not broad 'immune' or 'inflammatory'
  if (matchesAny(text, [
    'rheumatoid arthritis', 'lupus', 'psoriasis', 'psoriatic',
    'crohn', 'ulcerative colitis', 'atopic dermatitis', 'eczema',
    'inflammatory bowel', 'ibd', 'ankylosing spondylitis', 'axial spondyloarthritis',
    'vasculitis', 'pemphigus', 'scleroderma', 'systemic sclerosis',
    'sjögren', 'sjogren', 'celiac', 'alopecia areata',
    'vitiligo', 'graft versus host', 'gvhd', 'transplant rejection',
    'autoimmune', 'juvenile arthritis', 'uveitis', 'hidradenitis',
    'asthma', 'allergic rhinitis', 'food allergy', 'anaphylaxis',
    'chronic urticaria', 'angioedema', 'eosinophilic', 'multiple sclerosis',
  ])) {
    return { category: 'autoimmune', specific: null };
  }

  // Dermatology (non-autoimmune skin conditions)
  if (matchesAny(text, [
    'acne', 'rosacea', 'wound healing', 'dermatitis', 'dermatology',
    'pruritus', 'prurigo', 'urticaria', 'keloid', 'scarring',
  ])) {
    return { category: 'dermatology', specific: null };
  }

  // Rare disease
  if (matchesAny(text, [
    'duchenne', 'spinal muscular atrophy', 'hemophilia', 'haemophilia', 'fabry',
    'gaucher', 'pompe', 'wilson disease', 'cystic fibrosis',
    'sickle cell', 'thalassemia', 'phenylketonuria', 'pku',
    'lysosomal', 'hunter syndrome', 'hurler', 'niemann-pick',
    'batten', 'friedreich', 'progeria', 'epidermolysis bullosa',
    'orphan drug',
  ])) {
    return { category: 'rare_disease', specific: null };
  }

  // Infectious
  if (matchesAny(text, [
    'hiv', 'hepatitis', 'covid', 'sars-cov', 'rsv', 'respiratory syncytial',
    'influenza', 'tuberculosis', 'malaria', 'sepsis', 'pneumonia', 'meningitis',
    'herpes', 'cytomegalovirus', 'cmv', 'ebola', 'zika', 'dengue',
    'antimicrobial', 'antifungal', 'antiviral', 'antibiotic',
    'bacterial infection', 'viral infection', 'fungal infection', 'urinary tract infection',
    'clostridioides', 'clostridium difficile', 'c. difficile', 'candid', 'aspergill',
    'human papillomavirus', 'hpv', 'chikungunya', 'mpox', 'monkeypox', 'pertussis',
  ])) {
    return { category: 'infectious', specific: null };
  }

  // Vaccines / prophylaxis (no disease term matched above)
  if (matchesAny(text, ['vaccine', 'vaccination', 'immunization', 'immunisation', 'immunogenicity'])) {
    return { category: 'vaccine', specific: null };
  }

  // Cardiovascular
  if (matchesAny(text, [
    'heart failure', 'cardiovascular', 'atherosclerosis', 'hypertension',
    'atrial fibrillation', 'arrhythmia', 'coronary artery', 'myocardial infarction',
    'cardiomyopathy', 'thrombosis', 'pulmonary hypertension', 'aneurysm',
    'peripheral artery', 'cardiac', 'venous thromboembolism', 'pulmonary embolism',
    'deep vein thrombosis', 'dvt', 'heart disease', 'angina',
  ])) {
    return { category: 'cardiovascular', specific: null };
  }

  // Metabolic — specific terms, not broad 'weight' or 'insulin'
  if (matchesAny(text, [
    'diabetes', 'diabetic', 'obesity', 'obese', 'nash', 'fatty liver',
    'nafld', 'mash', 'metabolic syndrome', 'dyslipidemia',
    'hyperlipidemia', 'hypercholesterolemia', 'hypertriglyceridemia', 'gout',
    'hyperuricemia', 'weight management', 'weight loss', 'anti-obesity',
    'glp-1', 'incretin', 'glycemic control', 'hba1c',
    'type 2 diabetes', 't2dm', 'type 1 diabetes', 't1dm',
    'hypothyroid', 'hyperthyroid', 'pcos', 'polycystic ovary', 'growth hormone',
    'lipodystrophy', 'endocrine', 'steatohepatitis', 'steatotic liver',
    'adrenal', 'cushing', 'acromegaly', 'hypoparathyroid', 'hyperparathyroid', 'hypogonadism',
  ]) || hasWord(text, 'thyroid')) {
    return { category: 'metabolic', specific: null };
  }

  // Ophthalmology
  if (matchesAny(text, [
    'macular degeneration', 'amd', 'macular edema', 'macular oedema', 'retinopathy',
    'retinitis', 'retinal', 'retina', 'glaucoma', 'dry eye', 'keratitis', 'keratoconus',
    'myopia', 'presbyopia', 'cataract', 'ocular', 'ophthalm', 'conjunctivitis',
    'blepharitis', 'optic neuropathy', 'geographic atrophy', 'stargardt', 'leber',
    'intraocular', 'vitreous', 'corneal', 'thyroid eye disease',
  ])) {
    return { category: 'ophthalmology', specific: null };
  }

  // Respiratory
  if (matchesAny(text, [
    'copd', 'chronic obstructive', 'pulmonary fibrosis', 'ipf', 'interstitial lung',
    'bronchiectasis', 'acute respiratory distress', 'ards', 'chronic cough',
    'lung disease', 'respiratory disease', 'bronchopulmonary', 'pneumonitis',
    'sarcoidosis', 'sleep apnea', 'sleep apnoea', 'emphysema', 'bronchitis',
    'respiratory failure', 'lung transplant', 'alpha-1 antitrypsin',
  ])) {
    return { category: 'respiratory', specific: null };
  }

  // Renal
  if (matchesAny(text, [
    'chronic kidney disease', 'ckd', 'iga nephropathy', 'nephropathy', 'nephrotic',
    'nephritis', 'glomerul',
    'kidney disease', 'kidney failure', 'kidney injury', 'dialysis', 'hemodialysis',
    'polycystic kidney', 'alport', 'hyperkalemia', 'hyperphosphatemia',
    'kidney transplant',
  ]) || hasWord(text, 'renal')) {
    return { category: 'renal', specific: null };
  }

  // Gastroenterology / hepatology (non-infectious, non-autoimmune)
  if (matchesAny(text, [
    'primary biliary', 'primary sclerosing', 'cirrhosis', 'gastroparesis',
    'irritable bowel', 'ibs', 'gerd', 'gastroesophageal reflux', 'constipation',
    'short bowel', 'liver disease', 'hepatic', 'liver fibrosis', 'liver failure',
    'pancreatitis', 'diarrhea', 'diarrhoea', 'nausea', 'vomiting', 'gastrointestinal',
    'esophagitis', 'gastritis', 'peptic ulcer', 'biliary', 'cholestasis',
    'liver transplant', 'hepatic encephalopathy', 'portal hypertension', 'colitis',
  ])) {
    return { category: 'gastroenterology', specific: null };
  }

  // Non-malignant hematology
  if (matchesAny(text, [
    'anemia', 'anaemia', 'thrombocytopenia', 'neutropenia', 'iron deficiency',
    'paroxysmal nocturnal', 'pnh', 'itp', 'immune thrombocytopenia', 'aplastic',
    'hemolytic', 'haemolytic', 'hemochromatosis', 'bleeding disorder', 'von willebrand',
    'coagulation', 'transfusion', 'hematolog', 'haematolog', 'cytopenia',
  ])) {
    return { category: 'hematology', specific: null };
  }

  // Women's health
  if (matchesAny(text, [
    'endometriosis', 'uterine fibroid', 'menopaus', 'vasomotor', 'hot flash', 'hot flush',
    'contracept', 'preterm', 'preeclampsia', 'pre-eclampsia', 'infertility',
    'in vitro fertilization', 'ivf', 'vaginal', 'vulvovaginal', 'vaginosis',
    'dysmenorrhea', 'menstrual', 'postpartum', 'pregnan', 'lactation',
    'ovarian insufficiency', 'hypoactive sexual desire', 'heavy menstrual bleeding',
  ])) {
    return { category: 'womens_health', specific: null };
  }

  // Musculoskeletal
  if (matchesAny(text, [
    'osteoarthritis', 'osteoporosis', 'osteopenia', 'sarcopenia', 'tendin', 'rotator cuff',
    'fracture', 'bone loss', 'muscular dystrophy', 'myopathy', 'myositis',
    'osteogenesis imperfecta', 'achondroplasia', 'spinal stenosis', 'degenerative disc',
    'cachexia', 'muscle atrophy', 'hypophosphatasia', 'hypophosphatemia', 'fibrodysplasia',
    'musculoskeletal',
  ])) {
    return { category: 'musculoskeletal', specific: null };
  }

  // Pain / analgesia (neuropathic pain is caught by CNS above)
  if (matchesAny(text, [
    'chronic pain', 'acute pain', 'postoperative pain', 'post-operative pain',
    'post-surgical pain', 'postsurgical pain', 'low back pain', 'back pain', 'cancer pain',
    'analgesi', 'opioid', 'nociceptive', 'pain management', 'bunionectomy', 'abdominoplasty',
  ]) || hasWord(text, 'pain')) {
    return { category: 'pain', specific: null };
  }

  return { category: null, specific: null };
}

/**
 * Map CT.gov v2 `designModule.phases` (an ARRAY — combined-phase studies are
 * reported as ["PHASE1","PHASE2"], not "PHASE1/PHASE2") to the company_trials
 * CHECK values: early_phase_1, phase_1, phase_1_2, phase_2, phase_2_3,
 * phase_3, phase_4, not_applicable, unknown.
 */
function mapPhase(ctPhases: string[] | string | undefined | null): string {
  const phases = (Array.isArray(ctPhases) ? ctPhases : ctPhases ? [ctPhases] : [])
    .map(p => String(p).toUpperCase().replace(/[\s/-]+/g, ''))
    .filter(Boolean);
  if (phases.length === 0) return 'unknown';

  const has = (p: string) => phases.includes(p) || phases.some(x => x.includes(p) && !x.startsWith('EARLY'));
  const hasEarly1 = phases.includes('EARLY_PHASE1') || phases.includes('EARLYPHASE1');

  if (has('PHASE1') && has('PHASE2')) return 'phase_1_2';
  if (has('PHASE2') && has('PHASE3')) return 'phase_2_3';
  if (has('PHASE4')) return 'phase_4';
  if (has('PHASE3')) return 'phase_3';
  if (has('PHASE2')) return 'phase_2';
  if (has('PHASE1')) return 'phase_1';
  if (hasEarly1) return 'early_phase_1';
  if (phases.includes('NA')) return 'not_applicable';
  return 'unknown';
}

function mapStatus(ctStatus: string | undefined): string {
  if (!ctStatus) return 'unknown';

  const statusMap: Record<string, string> = {
    'NOT_YET_RECRUITING': 'not_yet_recruiting',
    'RECRUITING': 'recruiting',
    'ENROLLING_BY_INVITATION': 'enrolling_by_invitation',
    'ACTIVE_NOT_RECRUITING': 'active_not_recruiting',
    'SUSPENDED': 'suspended',
    'TERMINATED': 'terminated',
    'COMPLETED': 'completed',
    'WITHDRAWN': 'withdrawn',
  };

  return statusMap[ctStatus] || 'unknown';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ClinicalTrials.gov returns dates as "YYYY-MM-DD", "YYYY-MM", or "YYYY"
// Normalize to full "YYYY-MM-DD" for Postgres date columns
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr; // Already full date
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`; // Year-month → add day
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01`; // Year only → add month+day
  return null; // Unrecognized format
}

function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

export async function runWeeklyIngestion(
  supabase: SupabaseClient,
  options: { batchSize?: number } = {}
): Promise<{ companies: number; trials: number; errors: string[]; batch_info: { processed: number; total: number } }> {
  const { batchSize = 30 } = options;

  console.log(`Starting ClinicalTrials.gov ingestion (batch of ${batchSize})...`);

  // Dynamic: pull all companies from DB, ordered by least recently enriched
  // This replaces the hardcoded COMPANIES_TO_TRACK list so new seeded companies
  // are automatically picked up for trial tracking
  const { data: allDbCompanies } = await supabase
    .from('companies')
    .select('id, name, name_variations, last_enriched_at')
    .eq('actively_acquiring', true)
    .order('last_enriched_at', { ascending: true, nullsFirst: true });

  if (!allDbCompanies || allDbCompanies.length === 0) {
    return { companies: 0, trials: 0, errors: ['No companies found in DB'], batch_info: { processed: 0, total: 0 } };
  }

  // Build lookup: lowercase name/variation -> { id, last_enriched_at }
  const companyLookup = new Map<string, { id: string; last_enriched_at: string | null }>();
  for (const c of allDbCompanies) {
    companyLookup.set(c.name.toLowerCase(), { id: c.id, last_enriched_at: c.last_enriched_at });
    for (const v of c.name_variations || []) {
      companyLookup.set(v.toLowerCase(), { id: c.id, last_enriched_at: c.last_enriched_at });
    }
  }

  // Use company names as CT.gov search terms (already sorted by stalest first from query)
  const allCompanyNames = allDbCompanies.map((c: { name: string }) => c.name);
  const totalCompanies = allCompanyNames.length;

  // Take only the batch
  const batch = allCompanyNames.slice(0, batchSize);
  console.log(`Processing batch of ${batch.length}/${totalCompanies} companies (stalest first)`);

  // Log ingestion start
  const { data: logEntry } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'clinicaltrials',
      run_type: 'scheduled',
      parameters: { companies: batch.length, total: totalCompanies, batchSize },
    })
    .select('id')
    .single();

  const logId = logEntry?.id;
  const errors: string[] = [];
  let companiesProcessed = 0;
  let trialsInserted = 0;

  try {
    for (const companyName of batch) {
      try {
        console.log(`Processing ${companyName}...`);

        const trials = await fetchCompanyTrials(companyName);

        if (trials.length === 0) {
          companiesProcessed++;
          // Still mark as enriched so we don't re-process empty companies every run
          const existing = companyLookup.get(companyName.toLowerCase());
          if (existing) {
            await supabase
              .from('companies')
              .update({ last_enriched_at: new Date().toISOString() })
              .eq('id', existing.id);
          }
          await sleep(200);
          continue;
        }

        // Find or create company (atomic upsert to prevent race conditions)
        let companyId = companyLookup.get(companyName.toLowerCase())?.id;

        if (!companyId) {
          // Try ilike search as fallback
          const { data: found } = await supabase
            .from('companies')
            .select('id')
            .ilike('name', `%${escapeLikePattern(companyName)}%`)
            .limit(1)
            .single();

          if (found) {
            companyId = found.id;
          } else {
            // Use upsert with ON CONFLICT to prevent duplicate companies
            // under concurrent ingestion
            const { data: newCompany } = await supabase
              .from('companies')
              .upsert({
                name: companyName,
                name_variations: [companyName],
                data_sources: ['clinicaltrials'],
              }, { onConflict: 'name', ignoreDuplicates: false })
              .select('id')
              .single();
            companyId = newCompany?.id;
          }
        }

        if (!companyId) {
          errors.push(`Failed to find/create company: ${companyName}`);
          continue;
        }

        // Aggregate modalities and indications while building batch records
        const modalities = new Set<string>();
        const indications = new Set<string>();
        const indicationsSpecific = new Set<string>();
        const trialRecords: Record<string, unknown>[] = [];

        for (const trial of trials) {
          const modality = inferModalityFromIntervention(trial.interventions);
          const indication = inferIndicationFromConditions(trial.conditions);
          const primaryIntervention = pickPrimaryIntervention(trial.interventions);

          trialRecords.push({
            company_id: companyId,
            company_name: companyName,
            nct_id: trial.nctId,
            trial_title: trial.title,
            trial_acronym: trial.acronym,
            brief_summary: trial.briefSummary?.substring(0, 2000),
            intervention_name: primaryIntervention?.name || null,
            intervention_type: primaryIntervention?.type || null,
            modality: modality,
            indication_category: indication.category,
            indication_specific: indication.specific,
            conditions: trial.conditions,
            phase: trial.phase,
            status: trial.status,
            is_collaboration: trial.collaborators.length > 0,
            collaborator_names: trial.collaborators,
            lead_sponsor_type: trial.sponsorType,
            locations_countries: trial.locations,
            enrollment_count: trial.enrollmentCount,
            start_date: trial.startDate,
            primary_completion_date: trial.primaryCompletionDate,
            completion_date: trial.completionDate,
            last_update_posted: trial.lastUpdatePosted,
            results_available: trial.hasResults,
            primary_outcomes: trial.primaryOutcomes.map(o => o.measure).filter(Boolean),
            secondary_outcomes: trial.secondaryOutcomes.map(o => o.measure).filter(Boolean),
            primary_outcome_measures: trial.primaryOutcomes,
            updated_at: new Date().toISOString(),
          });

          if (modality && modality !== 'other') modalities.add(modality);
          if (indication.category) indications.add(indication.category);
          if (indication.specific) indicationsSpecific.add(indication.specific);
        }

        // Batch upsert trials (chunks of 50 to avoid payload limits)
        for (let i = 0; i < trialRecords.length; i += 50) {
          const chunk = trialRecords.slice(i, i + 50);
          const { error: batchError } = await supabase
            .from('company_trials')
            .upsert(chunk, { onConflict: 'company_id,nct_id' });

          if (batchError) {
            errors.push(`Batch upsert error for ${companyName} (chunk ${i}): ${batchError.message}`);
          } else {
            trialsInserted += chunk.length;
          }
        }

        // Count active trials
        const { count: activeTrialsCount } = await supabase
          .from('company_trials')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting']);

        // Update company profile (merge with existing data)
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('modalities_active, indications_active, indications_specific, data_sources')
          .eq('id', companyId)
          .single();

        const mergedModalities = Array.from(new Set([
          ...(existingCompany?.modalities_active || []),
          ...modalities,
        ]));

        const mergedIndications = Array.from(new Set([
          ...(existingCompany?.indications_active || []),
          ...indications,
        ]));

        const mergedIndicationsSpecific = Array.from(new Set([
          ...(existingCompany?.indications_specific || []),
          ...indicationsSpecific,
        ]));

        const mergedSources = Array.from(new Set([
          ...(existingCompany?.data_sources || []),
          'clinicaltrials',
        ]));

        await supabase
          .from('companies')
          .update({
            modalities_active: mergedModalities,
            indications_active: mergedIndications,
            indications_specific: mergedIndicationsSpecific,
            active_trials_count: activeTrialsCount || 0,
            data_sources: mergedSources,
            last_enriched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', companyId);

        companiesProcessed++;

        // Rate limiting between companies (reduced from 1500ms)
        await sleep(500);

      } catch (error) {
        const errorMsg = `Error processing ${companyName}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Update log entry
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          records_fetched: batch.length,
          records_processed: companiesProcessed,
          records_inserted: trialsInserted,
          records_updated: 0,
          records_failed: errors.length,
          errors: errors.slice(0, 50),
          status: errors.length > 0 ? 'partial' : 'completed',
        })
        .eq('id', logId);
    }

    console.log(`ClinicalTrials.gov ingestion complete: ${companiesProcessed}/${batch.length} companies, ${trialsInserted} trials`);

    return {
      companies: companiesProcessed,
      trials: trialsInserted,
      errors,
      batch_info: { processed: batch.length, total: totalCompanies },
    };

  } catch (error) {
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          errors: [String(error)],
        })
        .eq('id', logId);
    }
    throw error;
  }
}
