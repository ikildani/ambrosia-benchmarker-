/**
 * Cron Route: Deal Data Quality Assurance
 *
 * Nightly sweep that identifies data quality issues across the deals table:
 *   A. Near-duplicate deals (normalized company name matching)
 *   B. Date anomalies (future dates, date/ingestion mismatches)
 *   C. Missing financial terms on "terms_disclosed" deals
 *   D. Orphan TAs (therapeutic_area='other' with classifiable indication)
 *
 * Results logged to data_ingestion_log + Slack notification.
 * Schedule: daily at 3am UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function normalizeName(name: string): string {
  return name
    .replace(/,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|PLC|LLC|LP|Co\.?|Company|Pharmaceuticals?|Therapeutics?|Biosciences?|Biotech|Sciences?|AG|SA|S\.A\.?|N\.V\.?|SE|GmbH|A\/S)$/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const TA_MAP: Record<string, string[]> = {
  oncology: ['solid_tumor', 'solid_tumors', 'hematological', 'hematologic', 'heme_onc', 'lung_cancer', 'breast_cancer', 'prostate_cancer', 'colorectal_cancer', 'pancreatic_cancer', 'liver_cancer', 'melanoma', 'glioblastoma', 'bladder_cancer', 'renal_cell_carcinoma'],
  cardiovascular: ['cardiovascular', 'cardiac', 'heart_failure', 'hypertension', 'thrombosis', 'cardiomyopathy', 'atrial_fibrillation', 'atherosclerosis', 'pulmonary_hypertension'],
  neurology: ['cns', 'alzheimers', 'parkinsons', 'epilepsy', 'migraine', 'schizophrenia', 'depression', 'neurodegeneration', 'multiple_sclerosis', 'als', 'huntingtons'],
  immunology: ['autoimmune', 'rheumatoid_arthritis', 'lupus', 'inflammatory_bowel', 'psoriasis', 'atopic_dermatitis', 'psoriatic_arthritis', 'ibd', 'crohns', 'ulcerative_colitis', 'respiratory', 'asthma', 'copd'],
  metabolic: ['metabolic', 'diabetes', 'obesity', 'nash', 'mash', 'dyslipidemia', 'type_2_diabetes', 'glp1'],
  infectiousDisease: ['infectious', 'hiv', 'hepatitis', 'hbv', 'hcv', 'rsv', 'influenza', 'covid', 'antiviral', 'antibiotic', 'vaccine'],
  rareDisease: ['rare_disease', 'orphan', 'gene_therapy', 'sma', 'duchenne', 'hemophilia', 'cystic_fibrosis', 'fabry', 'sickle_cell'],
  hematology: ['hematology', 'leukemia', 'lymphoma', 'myeloma', 'myelofibrosis', 'anemia', 'thrombocytopenia', 'aml', 'cll', 'dlbcl'],
  ophthalmology: ['ophthalmology', 'retinal', 'glaucoma', 'macular', 'wet_amd', 'dry_amd', 'ocular', 'dry_eye'],
  dermatology: ['dermatology', 'eczema', 'acne', 'vitiligo', 'alopecia', 'hidradenitis', 'rosacea'],
  gastroenterology: ['gastroenterology', 'celiac', 'ibs', 'gerd', 'eosinophilic_esophagitis', 'pancreatitis', 'liver_fibrosis'],
  womensHealth: ['reproductive', 'endometriosis', 'uterine', 'uterine_fibroids', 'fertility', 'menopause', 'gynecology'],
};

function classifyIndication(indication: string): string | null {
  const lower = indication.toLowerCase().replace(/\s+/g, '_');
  for (const [ta, keywords] of Object.entries(TA_MAP)) {
    if (keywords.some(k => lower.includes(k))) return ta;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const result = {
    duplicates: [] as Array<{ ids: string[]; licensor: string; licensee: string; year: string; count: number }>,
    dateAnomalies: [] as Array<{ id: string; licensor: string; licensee: string; announced_date: string; issue: string }>,
    missingTerms: 0,
    orphanTAs: [] as Array<{ id: string; indication: string; suggestedTA: string }>,
    reclassified: 0,
  };

  // ── A. Near-duplicate detection ──────────────────────────────────────
  const { data: allDeals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, announced_date, asset_name')
    .eq('is_synthetic', false)
    .order('announced_date', { ascending: false });

  if (allDeals) {
    const groups = new Map<string, typeof allDeals>();
    for (const deal of allDeals) {
      if (!deal.licensor_name || !deal.licensee_name) continue;
      const year = deal.announced_date?.substring(0, 4) || 'unknown';
      const key = `${normalizeName(deal.licensor_name)}|${normalizeName(deal.licensee_name)}|${year}`;
      const group = groups.get(key) || [];
      group.push(deal);
      groups.set(key, group);
    }

    for (const [, group] of groups) {
      if (group.length >= 2) {
        const hasDifferentAssets = new Set(group.map(d => d.asset_name?.toLowerCase().trim()).filter(Boolean)).size > 1;
        if (!hasDifferentAssets) {
          result.duplicates.push({
            ids: group.map(d => d.id),
            licensor: group[0].licensor_name || '',
            licensee: group[0].licensee_name || '',
            year: group[0].announced_date?.substring(0, 4) || '?',
            count: group.length,
          });
        }
      }
    }
  }

  // ── B. Date anomalies ───────────────────────────────────────────────
  const { data: recentDeals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, announced_date, created_at')
    .eq('is_synthetic', false)
    .not('announced_date', 'is', null);

  if (recentDeals) {
    for (const deal of recentDeals) {
      if (!deal.announced_date) continue;

      if (deal.announced_date > today) {
        result.dateAnomalies.push({
          id: deal.id,
          licensor: deal.licensor_name || '?',
          licensee: deal.licensee_name || '?',
          announced_date: deal.announced_date,
          issue: 'future_date',
        });
      } else if (deal.created_at) {
        const createdDate = deal.created_at.split('T')[0];
        const announcedMs = new Date(deal.announced_date).getTime();
        const createdMs = new Date(createdDate).getTime();
        if (announcedMs > createdMs + 7 * 86400000) {
          result.dateAnomalies.push({
            id: deal.id,
            licensor: deal.licensor_name || '?',
            licensee: deal.licensee_name || '?',
            announced_date: deal.announced_date,
            issue: `announced ${deal.announced_date} but ingested ${createdDate}`,
          });
        }
      }
    }
  }

  // ── C. Missing financial terms ──────────────────────────────────────
  const { count: missingCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('is_synthetic', false)
    .eq('terms_disclosed', true)
    .is('upfront_usd', null)
    .is('total_deal_value_usd', null)
    .is('milestones_total_usd', null);
  result.missingTerms = missingCount || 0;

  // ── D. Orphan TA reclassification ───────────────────────────────────
  const { data: orphans } = await supabase
    .from('deals')
    .select('id, indication_category, indication_specific')
    .eq('therapeutic_area', 'other')
    .eq('is_synthetic', false)
    .limit(200);

  if (orphans) {
    for (const deal of orphans) {
      const indication = deal.indication_category || deal.indication_specific || '';
      if (!indication) continue;
      const suggested = classifyIndication(indication);
      if (suggested) {
        result.orphanTAs.push({ id: deal.id, indication, suggestedTA: suggested });
        await supabase.from('deals').update({ therapeutic_area: suggested }).eq('id', deal.id);
        result.reclassified++;
      }
    }
  }

  // ── Log results ─────────────────────────────────────────────────────
  await supabase.from('data_ingestion_log').insert({
    source: 'deal_qa',
    run_type: 'cron',
    parameters: {
      duplicates: result.duplicates.length,
      dateAnomalies: result.dateAnomalies.length,
      missingTerms: result.missingTerms,
      orphanTAs: result.orphanTAs.length,
      reclassified: result.reclassified,
      duplicateDetails: result.duplicates.slice(0, 20),
      dateAnomalyDetails: result.dateAnomalies.slice(0, 20),
    },
    records_fetched: allDeals?.length || 0,
    records_processed: (allDeals?.length || 0),
    records_inserted: result.reclassified,
    records_failed: result.duplicates.length + result.dateAnomalies.length + result.missingTerms,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  // ── Slack notification ──────────────────────────────────────────────
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl && (result.duplicates.length > 0 || result.dateAnomalies.length > 0 || result.missingTerms > 0)) {
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: ':mag: Deal QA Report' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Potential Duplicates:* ${result.duplicates.length}` },
          { type: 'mrkdwn', text: `*Date Anomalies:* ${result.dateAnomalies.length}` },
          { type: 'mrkdwn', text: `*Missing Terms:* ${result.missingTerms}` },
          { type: 'mrkdwn', text: `*Orphan TAs Reclassified:* ${result.reclassified}` },
        ],
      },
    ];

    if (result.duplicates.length > 0) {
      const top5 = result.duplicates.slice(0, 5).map(d => `• ${d.licensor} → ${d.licensee} (${d.year}, ${d.count}x)`).join('\n');
      blocks.push({
        type: 'section',
        fields: [{ type: 'mrkdwn', text: `*Top duplicates:*\n${top5}` }],
      } as any);
    }

    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: ':point_right: Review at solidus.ambrosiaventures.co/admin/dedup' }],
    } as any);

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
    } catch {}
  }

  return NextResponse.json({
    success: true,
    duplicates: result.duplicates.length,
    dateAnomalies: result.dateAnomalies.length,
    missingTerms: result.missingTerms,
    orphanTAsReclassified: result.reclassified,
  });
}
