/**
 * Shared utilities for cron job routes.
 * Provides consistent logging, time budgeting, and post-processing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Log a cron run result to the data_ingestion_log table.
 */
export async function logCronRun(
  supabase: SupabaseClient,
  source: string,
  result: {
    fetched?: number;
    processed?: number;
    inserted?: number;
    errors?: string[];
    parameters?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('data_ingestion_log').insert({
      source,
      run_type: 'cron',
      parameters: result.parameters || {},
      records_fetched: result.fetched || 0,
      records_processed: result.processed || 0,
      records_inserted: result.inserted || 0,
      records_failed: result.errors?.length || 0,
      errors: (result.errors || []).slice(0, 50),
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
  } catch {
    console.error(`[${source}] Failed to write ingestion log (non-fatal)`);
  }
}

/**
 * Check if we've exceeded the time budget.
 */
export function isTimeBudgetExceeded(startTime: number, budgetMs: number = 250_000): boolean {
  return Date.now() - startTime > budgetMs;
}

/**
 * Reclassify deals with therapeutic_area='other' using indication_category mapping.
 * Call this after any deal-producing cron run.
 */
export async function reclassifyOtherDeals(supabase: SupabaseClient): Promise<number> {
  const taMap: Record<string, string[]> = {
    oncology: ['solid_tumor', 'solid_tumors', 'hematological', 'hematologic', 'lung_cancer', 'breast_cancer', 'prostate_cancer', 'colorectal_cancer', 'pancreatic_cancer', 'melanoma', 'glioblastoma', 'bladder_cancer', 'renal_cell_carcinoma', 'ovarian_cancer'],
    cardiovascular: ['cardiovascular', 'cardiac', 'heart_failure', 'hypertension', 'thrombosis', 'cardiomyopathy', 'atrial_fibrillation', 'atherosclerosis', 'pulmonary_hypertension', 'attr_cardiomyopathy', 'pah'],
    neurology: ['cns', 'alzheimers', 'parkinsons', 'epilepsy', 'migraine', 'schizophrenia', 'depression', 'neurodegeneration', 'als', 'huntingtons', 'neuropathic_pain', 'bipolar', 'insomnia', 'stroke'],
    immunology: ['autoimmune', 'rheumatoid_arthritis', 'lupus', 'inflammatory_bowel', 'psoriasis', 'atopic_dermatitis', 'psoriatic_arthritis', 'vasculitis', 'myasthenia_gravis', 'ibd', 'crohns', 'ulcerative_colitis', 'iga_nephropathy', 'gvhd'],
    metabolic: ['metabolic', 'diabetes', 'obesity', 'nash', 'mash', 'dyslipidemia', 'type_2_diabetes', 'type_1_diabetes', 'gout', 'hypercholesterolemia'],
    infectiousDisease: ['infectious', 'hiv', 'hepatitis', 'hbv', 'hcv', 'rsv', 'influenza', 'covid_19', 'covid', 'antiviral', 'antibiotic', 'antimicrobial', 'vaccine', 'tuberculosis'],
    rareDisease: ['rare_disease', 'orphan', 'gene_therapy', 'sma', 'duchenne', 'hemophilia', 'cystic_fibrosis', 'fabry', 'gaucher', 'pompe', 'sickle_cell', 'thalassemia', 'attr_amyloidosis', 'pnh', 'hae'],
    hematology: ['hematology', 'leukemia', 'lymphoma', 'myeloma', 'multiple_myeloma', 'myelofibrosis', 'anemia', 'sickle_cell_disease', 'thrombocytopenia', 'aml', 'cll', 'dlbcl', 'mds', 'itp'],
    ophthalmology: ['ophthalmology', 'retinal', 'glaucoma', 'macular', 'wet_amd', 'dry_amd', 'ocular', 'dry_eye', 'diabetic_retinopathy', 'uveitis', 'geographic_atrophy'],
    dermatology: ['dermatology', 'eczema', 'acne', 'vitiligo', 'alopecia', 'alopecia_areata', 'hidradenitis', 'rosacea'],
    gastroenterology: ['gastroenterology', 'celiac', 'ibs', 'gerd', 'eosinophilic_esophagitis', 'c_difficile', 'liver_fibrosis', 'primary_biliary_cholangitis'],
    womensHealth: ['reproductive', 'endometriosis', 'uterine', 'uterine_fibroids', 'fertility', 'menopause', 'gynecology', 'pcos', 'contraception'],
  };

  let reclassified = 0;
  for (const [ta, categories] of Object.entries(taMap)) {
    for (const cat of categories) {
      const { data } = await supabase
        .from('deals')
        .update({ therapeutic_area: ta })
        .eq('therapeutic_area', 'other')
        .eq('indication_category', cat)
        .select('id');
      reclassified += data?.length || 0;
    }
  }
  return reclassified;
}

/**
 * Recalculate deal stats for companies that had recent deal activity.
 */
export async function updateCompanyStats(
  supabase: SupabaseClient,
  limit: number = 50
): Promise<number> {
  try {
    const { data: recentDeals } = await supabase
      .from('deals')
      .select('licensor_id, licensee_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    const companyIds = new Set<string>();
    for (const deal of recentDeals || []) {
      if (deal.licensor_id) companyIds.add(deal.licensor_id);
      if (deal.licensee_id) companyIds.add(deal.licensee_id);
    }

    let updated = 0;
    for (const companyId of companyIds) {
      const { error } = await supabase.rpc('update_company_deal_stats', { p_company_id: companyId });
      if (!error) updated++;
    }
    return updated;
  } catch {
    console.error('Company stats update failed (non-fatal)');
    return 0;
  }
}
