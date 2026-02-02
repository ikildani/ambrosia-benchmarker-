// ClinicalTrials.gov Pipeline Intelligence Ingestion
// Tracks active trials for pharma/biotech companies

const CT_API_V2 = 'https://clinicaltrials.gov/api/v2/studies';

// Top 100+ pharma/biotech companies to track
export const COMPANIES_TO_TRACK = [
  // Large Pharma
  'Pfizer', 'Merck', 'Novartis', 'Roche', 'AstraZeneca',
  'Bristol-Myers Squibb', 'Johnson & Johnson', 'AbbVie',
  'Gilead Sciences', 'Amgen', 'Regeneron', 'Eli Lilly', 'Sanofi',
  'GSK', 'Takeda', 'Boehringer Ingelheim', 'Bayer',

  // Large Biotech
  'Biogen', 'Vertex', 'Moderna', 'BioNTech', 'Alexion',
  'BioMarin', 'Incyte', 'Seagen', 'Jazz Pharmaceuticals',
  'Neurocrine', 'Alkermes', 'Exact Sciences',

  // Mid-cap Biotech
  'Blueprint Medicines', 'Agios', 'Rocket Pharmaceuticals',
  'Syndax', 'Protagonist', 'Revolution Medicines', 'Y-mAbs',
  'Legend Biotech', 'Replimune', 'MacroGenics', 'ImmunoGen',
  'Arcus Biosciences', 'CRISPR Therapeutics', 'Intellia',
  'Editas Medicine', 'Beam Therapeutics', 'Prime Medicine',
  'Allogene', 'Autolus', 'Fate Therapeutics', 'Poseida',
  'Caribou Biosciences', 'Precision BioSciences', '2seventy bio',

  // ADC/Bispecific specialists
  'Daiichi Sankyo', 'Astellas', 'Zymeworks', 'Mersana',
  'ADC Therapeutics', 'Immunomedics', 'Sutro', 'Pyxis Oncology',

  // Cell/Gene Therapy
  'Spark Therapeutics', 'Bluebird Bio', 'Sarepta', 'Solid Biosciences',
  'Voyager Therapeutics', 'Passage Bio', 'Prevail Therapeutics',
  'LogicBio', 'Generation Bio', 'Encoded Therapeutics',

  // Radiopharmaceuticals
  'Novartis', 'Bayer', 'Lantheus', 'Point Biopharma',
  'Fusion Pharmaceuticals', 'RayzeBio', 'Aktis Oncology',

  // Emerging/Specialty
  'Alnylam', 'Ionis', 'Arrowhead', 'Dicerna',
  'Bicycle Therapeutics', 'Cullinan', 'Erasca', 'Nuvalent',
  'Relay Therapeutics', 'Recursion', 'Exscientia', 'Schrodinger',

  // Japanese Pharma
  'Astellas', 'Daiichi Sankyo', 'Eisai', 'Shionogi',
  'Chugai', 'Ono Pharmaceutical', 'Sumitomo Pharma',

  // Chinese Biotech
  'BeiGene', 'Zai Lab', 'Hutchmed', 'Innovent',
  'Hengrui', 'CSPC Pharmaceutical',
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
  enrollmentCount: number | null;
  locations: string[];
  hasResults: boolean;
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
        ].join(','),
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(`${CT_API_V2}?${params}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`ClinicalTrials API error: ${response.status}`);
        break;
      }

      const data = await response.json();

      if (data.studies) {
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

          studies.push({
            nctId: identification?.nctId || '',
            title: identification?.briefTitle || '',
            acronym: identification?.acronym || null,
            briefSummary: protocol?.descriptionModule?.briefSummary || null,
            sponsor: sponsor?.leadSponsor?.name || companyName,
            sponsorType: sponsor?.leadSponsor?.class || 'UNKNOWN',
            phase: mapPhase(design?.phases?.[0]),
            status: mapStatus(status?.overallStatus),
            conditions: conditions?.conditions || [],
            interventions: (interventions?.interventions || []).map((i: any) => ({
              name: i.name || '',
              type: i.type || '',
              description: i.description || null,
            })),
            collaborators: (sponsor?.collaborators || []).map((c: any) => c.name),
            startDate: status?.startDateStruct?.date || null,
            primaryCompletionDate: status?.primaryCompletionDateStruct?.date || null,
            completionDate: status?.completionDateStruct?.date || null,
            enrollmentCount: design?.enrollmentInfo?.count || null,
            locations: Array.from(new Set(contacts?.locations?.map((l: any) => l.country) || [])),
            hasResults: !!results || !!status?.resultsFirstPostDateStruct,
          });
        }
      }

      pageToken = data.nextPageToken || null;
      pageCount++;

      // Rate limiting
      await sleep(300);

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
    'thyroid': 'thyroid',
    'sarcoma': 'sarcoma',
    'mesothelioma': 'mesothelioma',
    'cholangiocarcinoma': 'cholangiocarcinoma',
    'endometrial': 'endometrial',
    'cervical': 'cervical',
  };

  for (const [pattern, specific] of Object.entries(solidTumorMap)) {
    if (text.includes(pattern)) {
      return { category: 'solid_tumor', specific };
    }
  }

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
    't-cell lymphoma': 'tcl',
  };

  for (const [pattern, specific] of Object.entries(hemeMap)) {
    if (text.includes(pattern)) {
      return { category: 'hematological', specific };
    }
  }

  // CNS
  if (text.includes('alzheimer') || text.includes('parkinson') ||
      text.includes('multiple sclerosis') || text.includes('neurodegenerat') ||
      text.includes('huntington') || text.includes('als') ||
      text.includes('amyotrophic lateral') || text.includes('epilepsy') ||
      text.includes('schizophrenia') || text.includes('depression')) {
    return { category: 'cns', specific: null };
  }

  // Autoimmune
  if (text.includes('rheumatoid') || text.includes('lupus') ||
      text.includes('psoriasis') || text.includes('crohn') ||
      text.includes('colitis') || text.includes('atopic dermatitis') ||
      text.includes('inflammatory bowel') || text.includes('ibd')) {
    return { category: 'autoimmune', specific: null };
  }

  // Rare disease
  if (text.includes('rare') || text.includes('orphan') ||
      text.includes('duchenne') || text.includes('sma') ||
      text.includes('spinal muscular') || text.includes('hemophilia') ||
      text.includes('fabry') || text.includes('gaucher')) {
    return { category: 'rare_disease', specific: null };
  }

  // Infectious
  if (text.includes('hiv') || text.includes('hepatitis') ||
      text.includes('covid') || text.includes('rsv') ||
      text.includes('influenza') || text.includes('infection')) {
    return { category: 'infectious', specific: null };
  }

  // Cardiovascular
  if (text.includes('heart failure') || text.includes('cardiovascular') ||
      text.includes('atherosclerosis') || text.includes('hypertension')) {
    return { category: 'cardiovascular', specific: null };
  }

  // Metabolic
  if (text.includes('diabetes') || text.includes('obesity') ||
      text.includes('nash') || text.includes('fatty liver')) {
    return { category: 'metabolic', specific: null };
  }

  return { category: null, specific: null };
}

function mapPhase(ctPhase: string | undefined): string {
  if (!ctPhase) return 'unknown';

  const phaseMap: Record<string, string> = {
    'EARLY_PHASE1': 'phase_1',
    'PHASE1': 'phase_1',
    'PHASE2': 'phase_2',
    'PHASE3': 'phase_3',
    'PHASE4': 'phase_4',
    'NA': 'not_applicable',
  };

  // Handle combined phases
  if (ctPhase.includes('PHASE1') && ctPhase.includes('PHASE2')) {
    return 'phase_1_2';
  }
  if (ctPhase.includes('PHASE2') && ctPhase.includes('PHASE3')) {
    return 'phase_2_3';
  }

  return phaseMap[ctPhase] || 'unknown';
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

export async function runWeeklyIngestion(
  supabase: any
): Promise<{ companies: number; trials: number; errors: string[] }> {
  console.log('Starting ClinicalTrials.gov weekly ingestion...');

  // Log ingestion start
  const { data: logEntry } = await supabase
    .from('data_ingestion_log')
    .insert({
      source: 'clinicaltrials',
      run_type: 'scheduled',
      parameters: { companies: COMPANIES_TO_TRACK.length },
    })
    .select('id')
    .single();

  const logId = logEntry?.id;
  const errors: string[] = [];
  let companiesProcessed = 0;
  let trialsInserted = 0;
  let trialsUpdated = 0;

  try {
    for (const companyName of COMPANIES_TO_TRACK) {
      try {
        console.log(`Processing ${companyName}...`);

        const trials = await fetchCompanyTrials(companyName);

        if (trials.length === 0) {
          continue;
        }

        // Find or create company
        let { data: company } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', `%${companyName}%`)
          .limit(1)
          .single();

        if (!company) {
          const { data: newCompany } = await supabase
            .from('companies')
            .insert({
              name: companyName,
              name_variations: [companyName],
              data_sources: ['clinicaltrials'],
            })
            .select('id')
            .single();
          company = newCompany;
        }

        if (!company) {
          errors.push(`Failed to create company: ${companyName}`);
          continue;
        }

        // Aggregate modalities and indications
        const modalities = new Set<string>();
        const indications = new Set<string>();
        const indicationsSpecific = new Set<string>();

        for (const trial of trials) {
          const modality = inferModalityFromIntervention(trial.interventions);
          const indication = inferIndicationFromConditions(trial.conditions);

          // Upsert trial
          const { error: upsertError, data: upserted } = await supabase
            .from('company_trials')
            .upsert({
              company_id: company.id,
              company_name: companyName,
              nct_id: trial.nctId,
              trial_title: trial.title,
              trial_acronym: trial.acronym,
              brief_summary: trial.briefSummary?.substring(0, 2000),
              intervention_name: trial.interventions[0]?.name || null,
              intervention_type: trial.interventions[0]?.type || null,
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
              results_available: trial.hasResults,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,nct_id',
            })
            .select('id');

          if (upsertError) {
            errors.push(`Trial upsert error ${trial.nctId}: ${upsertError.message}`);
          } else {
            trialsInserted++;
          }

          if (modality && modality !== 'other') modalities.add(modality);
          if (indication.category) indications.add(indication.category);
          if (indication.specific) indicationsSpecific.add(indication.specific);
        }

        // Count active trials
        const { count: activeTrialsCount } = await supabase
          .from('company_trials')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting']);

        // Update company profile (merge with existing data)
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('modalities_active, indications_active, indications_specific, data_sources')
          .eq('id', company.id)
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
          .eq('id', company.id);

        companiesProcessed++;

        // Rate limiting between companies
        await sleep(1500);

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
          records_fetched: COMPANIES_TO_TRACK.length,
          records_processed: companiesProcessed,
          records_inserted: trialsInserted,
          records_updated: trialsUpdated,
          records_failed: errors.length,
          errors: errors.slice(0, 50),
          status: errors.length > 0 ? 'partial' : 'completed',
        })
        .eq('id', logId);
    }

    console.log(`ClinicalTrials.gov ingestion complete: ${companiesProcessed} companies, ${trialsInserted} trials`);

    return { companies: companiesProcessed, trials: trialsInserted, errors };

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
