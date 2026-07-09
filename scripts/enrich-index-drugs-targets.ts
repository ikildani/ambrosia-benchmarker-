#!/usr/bin/env npx tsx
/**
 * Enrich Index Drugs with Molecular Targets and Delivery Routes
 *
 * For each of the 163 index drugs in lib/financial/index-drugs.ts, this script
 * classifies the primary molecular target(s) and delivery route using Claude.
 *
 * Run modes:
 *   npx tsx scripts/enrich-index-drugs-targets.ts          # dry-run (prints results)
 *   npx tsx scripts/enrich-index-drugs-targets.ts --apply   # writes to file
 *
 * Follows the same pattern as scripts/retag-adc-modalities.ts
 */

import Anthropic from '@anthropic-ai/sdk';

const APPLY = process.argv.includes('--apply');

// Known target slugs from target-taxonomy.ts
const VALID_TARGETS = [
  'pd1', 'pdl1', 'ctla4', 'her2', 'egfr', 'kras_g12c', 'kras_g12d', 'vegf', 'alk',
  'braf_v600e', 'cdk4_6', 'trop2', 'bcma', 'cd19', 'cd20', 'fgfr', 'met', 'ret',
  'parp', 'lag3', 'tigit', 'claudin18_2', 'dll3', 'folr_alpha', 'nectin4', 'b7h3',
  'amyloid_beta', 'tau', 'alpha_synuclein', 'lrrk2', 'gba1', 'tfr', 'cgrp',
  'nav1_7', 'trem2', 'sv2a', 'sod1', 'htt', 'nmda', 'app', 'glymphatic',
  'tnf_alpha', 'il17', 'il23', 'il13', 'il4r_alpha', 'fcrn', 'tl1a', 'c5',
  'integrin_a4b7', 'jak1', 'baff', 'tslp', 's1p1', 'icos',
  'glp1r', 'gipr', 'gcgr', 'sglt2', 'pcsk9', 'lpa', 'angiotensinogen', 'myosin',
  'factor_xi', 'amylin', 'apoc3', 'fxr',
  'smn2', 'dystrophin', 'gaa', 'gla', 'cftr', 'aagt',
  'vegf_ophtho', 'ang2', 'rpe65', 'c3_ophtho',
  'hiv_integrase', 'hbv_surface_antigen', 'rsv_f_protein', 'neuraminidase',
  'btk', 'bcl2', 'cd38', 'flt3',
  'il31', 'il36', 'osx', 'tnf_gi', 'il12_23', 'madcam1',
];

const VALID_ROUTES = [
  'iv', 'sc', 'oral', 'intrathecal', 'intravitreal', 'inhaled',
  'topical', 'implantable', 'gene_therapy_vector', 'device_combo',
  'autoinjector', 'intranasal',
];

async function main() {
  const client = new Anthropic();

  // Dynamically import the index drugs
  const { INDEX_DRUG_DATABASE } = await import('../lib/financial/index-drugs');
  const drugs = Object.values(INDEX_DRUG_DATABASE).flat();

  console.log(`Found ${drugs.length} index drugs to enrich`);
  console.log(`Mode: ${APPLY ? 'APPLY (will write to file)' : 'DRY-RUN (preview only)'}\n`);

  const results: Array<{
    name: string;
    company: string;
    indication: string;
    modality: string;
    primaryTarget: string;
    additionalTargets: string[];
    deliveryRoute: string;
  }> = [];

  // Process in batches of 20
  const BATCH_SIZE = 20;
  for (let i = 0; i < drugs.length; i += BATCH_SIZE) {
    const batch = drugs.slice(i, i + BATCH_SIZE);
    const batchPrompt = batch.map((d, idx) => (
      `${idx + 1}. ${d.name} (${d.company}) — ${d.modality}, ${d.indication}, ${d.therapeuticArea}`
    )).join('\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `For each drug below, provide the primary molecular target, any additional targets, and delivery route.

Valid targets: ${VALID_TARGETS.join(', ')}
Valid routes: ${VALID_ROUTES.join(', ')}

If no exact match exists in the valid targets list, use the closest match or "other".
Respond as JSON array: [{"idx": 1, "primaryTarget": "...", "additionalTargets": ["..."], "deliveryRoute": "..."}]

Drugs:
${batchPrompt}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const entry of parsed) {
          const drug = batch[(entry.idx || entry.index || 1) - 1];
          if (drug) {
            results.push({
              name: drug.name,
              company: drug.company,
              indication: drug.indication,
              modality: drug.modality,
              primaryTarget: entry.primaryTarget || 'other',
              additionalTargets: entry.additionalTargets || [],
              deliveryRoute: entry.deliveryRoute || 'iv',
            });
          }
        }
      }
    } catch (e) {
      console.error(`Failed to parse batch ${i / BATCH_SIZE + 1}:`, e);
    }

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(drugs.length / BATCH_SIZE)} complete (${results.length} enriched)`);
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Enrichment Summary: ${results.length}/${drugs.length} drugs classified`);
  console.log(`${'='.repeat(60)}\n`);

  const targetCounts: Record<string, number> = {};
  const routeCounts: Record<string, number> = {};
  for (const r of results) {
    targetCounts[r.primaryTarget] = (targetCounts[r.primaryTarget] || 0) + 1;
    routeCounts[r.deliveryRoute] = (routeCounts[r.deliveryRoute] || 0) + 1;
  }

  console.log('Target distribution:');
  Object.entries(targetCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log('\nRoute distribution:');
  Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // Print first 10 as preview
  console.log('\nSample enrichments:');
  results.slice(0, 10).forEach(r => {
    console.log(`  ${r.name} (${r.company}): target=${r.primaryTarget}, route=${r.deliveryRoute}`);
  });

  if (APPLY) {
    // Write enrichment data to a JSON file for manual review and import
    const fs = await import('fs');
    const outputPath = 'data/index-drug-enrichment.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nEnrichment data written to ${outputPath}`);
    console.log('Import this data into lib/financial/index-drugs.ts to add target and route fields.');
  } else {
    console.log('\nDry run complete. Pass --apply to write enrichment data to file.');
  }
}

main().catch(console.error);
