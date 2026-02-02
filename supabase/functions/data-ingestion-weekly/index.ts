// Supabase Edge Function: Weekly Data Ingestion
// Runs weekly on Sundays at 2 AM UTC via pg_cron
// Sources: ClinicalTrials.gov

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CT_API_V2 = 'https://clinicaltrials.gov/api/v2/studies';

// Top pharma/biotech companies to track
const COMPANIES_TO_TRACK = [
  // Large Pharma
  'Pfizer', 'Merck', 'Novartis', 'Roche', 'AstraZeneca',
  'Bristol-Myers Squibb', 'Johnson & Johnson', 'AbbVie',
  'Gilead', 'Amgen', 'Regeneron', 'Eli Lilly', 'Sanofi',
  'GSK', 'Takeda', 'Boehringer Ingelheim',
  // Large Biotech
  'Biogen', 'Vertex', 'Moderna', 'BioNTech', 'Alexion',
  'BioMarin', 'Incyte', 'Seagen', 'Jazz Pharmaceuticals',
  // Mid-cap
  'Blueprint Medicines', 'Agios', 'Revolution Medicines',
  'Legend Biotech', 'CRISPR Therapeutics', 'Intellia',
  'Beam Therapeutics', 'Allogene', 'Fate Therapeutics',
  // ADC specialists
  'Daiichi Sankyo', 'Astellas', 'Zymeworks', 'Mersana',
  'ADC Therapeutics', 'ImmunoGen',
  // Cell/Gene Therapy
  'Spark Therapeutics', 'Bluebird Bio', 'Sarepta',
  // Radiopharm
  'Lantheus', 'Point Biopharma', 'Fusion Pharmaceuticals',
  // Chinese Biotech
  'BeiGene', 'Zai Lab', 'Hutchmed', 'Innovent',
];

interface CTStudy {
  nctId: string;
  title: string;
  sponsor: string;
  phase: string;
  status: string;
  conditions: string[];
  interventions: { name: string; type: string }[];
  collaborators: string[];
  startDate: string | null;
  completionDate: string | null;
}

Deno.serve(async (req) => {
  // Verify authorization - use SERVICE_ROLE_KEY (not SUPABASE_ prefix which is reserved)
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');

  const isValidAuth =
    authHeader === `Bearer ${serviceRoleKey}` ||
    authHeader === `Bearer ${cronSecret}`;

  if (!isValidAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey!
  );

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

  try {
    for (const companyName of COMPANIES_TO_TRACK) {
      try {
        console.log(`Processing ${companyName}...`);

        const trials = await fetchCompanyTrials(companyName);

        if (trials.length === 0) continue;

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

        if (!company) continue;

        // Aggregate data
        const modalities = new Set<string>();
        const indications = new Set<string>();
        const indicationsSpecific = new Set<string>();

        for (const trial of trials) {
          const modality = inferModality(trial.interventions);
          const indication = inferIndication(trial.conditions);

          // Upsert trial
          const { error } = await supabase
            .from('company_trials')
            .upsert({
              company_id: company.id,
              company_name: companyName,
              nct_id: trial.nctId,
              trial_title: trial.title,
              intervention_name: trial.interventions[0]?.name || null,
              intervention_type: trial.interventions[0]?.type || null,
              modality,
              indication_category: indication.category,
              indication_specific: indication.specific,
              conditions: trial.conditions,
              phase: mapPhase(trial.phase),
              status: mapStatus(trial.status),
              is_collaboration: trial.collaborators.length > 0,
              collaborator_names: trial.collaborators,
              start_date: trial.startDate,
              completion_date: trial.completionDate,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id,nct_id',
            });

          if (!error) trialsInserted++;

          if (modality && modality !== 'other') modalities.add(modality);
          if (indication.category) indications.add(indication.category);
          if (indication.specific) indicationsSpecific.add(indication.specific);
        }

        // Update company
        const { data: existing } = await supabase
          .from('companies')
          .select('modalities_active, indications_active, indications_specific, data_sources')
          .eq('id', company.id)
          .single();

        await supabase
          .from('companies')
          .update({
            modalities_active: [...new Set([...(existing?.modalities_active || []), ...modalities])],
            indications_active: [...new Set([...(existing?.indications_active || []), ...indications])],
            indications_specific: [...new Set([...(existing?.indications_specific || []), ...indicationsSpecific])],
            active_trials_count: trials.length,
            data_sources: [...new Set([...(existing?.data_sources || []), 'clinicaltrials'])],
            last_enriched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', company.id);

        companiesProcessed++;

        // Rate limit
        await sleep(1500);

      } catch (error) {
        errors.push(`Error processing ${companyName}: ${error}`);
      }
    }

    // Update log
    if (logId) {
      await supabase
        .from('data_ingestion_log')
        .update({
          completed_at: new Date().toISOString(),
          records_fetched: COMPANIES_TO_TRACK.length,
          records_processed: companiesProcessed,
          records_inserted: trialsInserted,
          records_failed: errors.length,
          errors: errors.slice(0, 20),
          status: errors.length > 0 ? 'partial' : 'completed',
        })
        .eq('id', logId);
    }

    return new Response(JSON.stringify({
      success: true,
      companies_processed: companiesProcessed,
      trials_inserted: trialsInserted,
      errors: errors.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

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

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function fetchCompanyTrials(companyName: string): Promise<CTStudy[]> {
  const studies: CTStudy[] = [];
  let pageToken: string | null = null;
  let pageCount = 0;

  do {
    try {
      const params = new URLSearchParams({
        'query.spons': companyName,
        'filter.overallStatus': 'RECRUITING,ACTIVE_NOT_RECRUITING,NOT_YET_RECRUITING',
        'pageSize': '100',
        'fields': 'NCTId,BriefTitle,LeadSponsorName,Phase,OverallStatus,Condition,InterventionName,InterventionType,CollaboratorName,StartDate,CompletionDate',
      });

      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`${CT_API_V2}?${params}`, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) break;

      const data = await response.json();

      if (data.studies) {
        for (const study of data.studies) {
          const p = study.protocolSection;
          studies.push({
            nctId: p?.identificationModule?.nctId || '',
            title: p?.identificationModule?.briefTitle || '',
            sponsor: p?.sponsorCollaboratorsModule?.leadSponsor?.name || companyName,
            phase: p?.designModule?.phases?.[0] || 'N/A',
            status: p?.statusModule?.overallStatus || '',
            conditions: p?.conditionsModule?.conditions || [],
            interventions: (p?.armsInterventionsModule?.interventions || []).map((i: any) => ({
              name: i.name || '',
              type: i.type || '',
            })),
            collaborators: (p?.sponsorCollaboratorsModule?.collaborators || []).map((c: any) => c.name),
            startDate: p?.statusModule?.startDateStruct?.date || null,
            completionDate: p?.statusModule?.completionDateStruct?.date || null,
          });
        }
      }

      pageToken = data.nextPageToken || null;
      pageCount++;
      await sleep(300);

    } catch (error) {
      console.error(`Error fetching trials for ${companyName}:`, error);
      break;
    }
  } while (pageToken && pageCount < 5);

  return studies;
}

function inferModality(interventions: { name: string; type: string }[]): string {
  const text = interventions.map(i => `${i.name} ${i.type}`).join(' ').toLowerCase();

  if (text.includes('adc') || text.includes('antibody-drug conjugate')) return 'adc';
  if (text.includes('bispecific')) return 'bispecific';
  if (text.includes('car-t') || text.includes('car t')) return 'car_t';
  if (text.includes('gene therapy') || text.includes('aav')) return 'gene_therapy';
  if (text.includes('mrna')) return 'mrna';
  if (text.includes('radioligand') || text.includes('radiopharm')) return 'radiopharm';
  if (text.includes('antibody') || text.includes('mab')) return 'antibody';

  return interventions.some(i => i.type === 'DRUG') ? 'small_molecule' : 'other';
}

function inferIndication(conditions: string[]): { category: string | null; specific: string | null } {
  const text = conditions.join(' ').toLowerCase();

  // Solid tumors
  const solidTumors: Record<string, string> = {
    'lung cancer': 'lung', 'nsclc': 'nsclc', 'breast cancer': 'breast',
    'colorectal': 'colorectal', 'pancreatic': 'pancreatic', 'ovarian': 'ovarian',
    'prostate': 'prostate', 'melanoma': 'melanoma', 'glioblastoma': 'glioblastoma',
  };
  for (const [pattern, specific] of Object.entries(solidTumors)) {
    if (text.includes(pattern)) return { category: 'solid_tumor', specific };
  }

  // Hematological
  const heme: Record<string, string> = {
    'acute myeloid leukemia': 'aml', 'aml': 'aml', 'multiple myeloma': 'myeloma',
    'lymphoma': 'lymphoma', 'leukemia': 'leukemia',
  };
  for (const [pattern, specific] of Object.entries(heme)) {
    if (text.includes(pattern)) return { category: 'hematological', specific };
  }

  if (text.includes('alzheimer') || text.includes('parkinson')) return { category: 'cns', specific: null };
  if (text.includes('rheumatoid') || text.includes('lupus')) return { category: 'autoimmune', specific: null };

  return { category: null, specific: null };
}

function mapPhase(ctPhase: string): string {
  const map: Record<string, string> = {
    'EARLY_PHASE1': 'phase_1', 'PHASE1': 'phase_1', 'PHASE2': 'phase_2',
    'PHASE3': 'phase_3', 'PHASE4': 'phase_4',
  };
  return map[ctPhase] || 'unknown';
}

function mapStatus(ctStatus: string): string {
  const map: Record<string, string> = {
    'NOT_YET_RECRUITING': 'not_yet_recruiting', 'RECRUITING': 'recruiting',
    'ACTIVE_NOT_RECRUITING': 'active_not_recruiting', 'COMPLETED': 'completed',
  };
  return map[ctStatus] || 'unknown';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
