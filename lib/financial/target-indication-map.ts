import { targetOptionsByTA, getTargetEntry } from './target-taxonomy';

/**
 * Maps indication slugs to the molecular target slugs most clinically relevant
 * for that indication. Used by MolecularTargetSelector to surface the right
 * targets first. Indications not listed here fall back to TA-level filtering.
 */
export const INDICATION_TARGET_RELEVANCE: Record<string, string[]> = {

  // ═══════════════════════════════════════════════════════════════════════
  // ONCOLOGY — Solid Tumors
  // ═══════════════════════════════════════════════════════════════════════

  lung_nsclc:           ['egfr', 'alk', 'kras_g12c', 'kras_g12d', 'pd1', 'pdl1', 'met', 'ret', 'braf_v600e', 'her2', 'vegf', 'fgfr', 'tigit'],
  lung_sclc:            ['pd1', 'pdl1', 'dll3', 'vegf', 'tigit'],
  breast_her2:          ['her2', 'cdk4_6', 'pd1', 'trop2', 'vegf'],
  breast_tnbc:          ['pd1', 'pdl1', 'trop2', 'vegf', 'nectin4', 'b7h3'],
  breast_hr:            ['cdk4_6', 'her2', 'vegf', 'pd1'],
  colorectal:           ['egfr', 'kras_g12c', 'vegf', 'pd1', 'her2', 'claudin18_2', 'b7h3', 'braf_v600e'],
  melanoma:             ['braf_v600e', 'pd1', 'ctla4', 'lag3', 'vegf', 'tigit'],
  gastric:              ['her2', 'pd1', 'claudin18_2', 'vegf', 'fgfr', 'ctla4'],
  renal:                ['pd1', 'vegf', 'ctla4', 'met', 'lag3'],
  bladder:              ['pd1', 'pdl1', 'nectin4', 'fgfr', 'trop2', 'her2'],
  gbm:                  ['vegf', 'pd1', 'egfr', 'pdl1'],
  ovarian:              ['parp', 'vegf', 'pd1', 'folr_alpha', 'ctla4'],
  prostate:             ['pd1', 'vegf', 'parp', 'ctla4'],
  pancreatic:           ['kras_g12c', 'kras_g12d', 'vegf', 'pd1'],
  liver:                ['pd1', 'pdl1', 'vegf', 'ctla4', 'fgfr'],
  headNeck:             ['pd1', 'pdl1', 'egfr', 'vegf', 'ctla4'],
  mesothelioma:         ['pd1', 'ctla4', 'vegf'],
  cholangiocarcinoma:   ['fgfr', 'pd1', 'her2', 'pdl1'],
  endometrial:          ['pd1', 'her2', 'vegf', 'parp'],
  cervical:             ['pd1', 'pdl1', 'vegf', 'ctla4'],
  esophageal:           ['pd1', 'pdl1', 'her2', 'vegf'],
  thyroid:              ['ret', 'braf_v600e', 'pd1', 'vegf'],
  sarcoma:              ['pd1', 'vegf', 'pdl1'],
  uvealMelanoma:        ['pd1', 'ctla4', 'lag3'],
  testicular:           ['pd1', 'vegf'],
  nasopharyngeal:       ['pd1', 'pdl1', 'vegf', 'egfr'],
  gist:                 ['pd1', 'vegf'],
  neuroblastoma:        ['pd1', 'vegf', 'b7h3'],
  merkelCell:           ['pd1', 'pdl1', 'ctla4'],
  neuroendocrine:       ['pd1', 'vegf'],
  smallBowel:           ['pd1', 'vegf'],
  dipg:                 ['pd1', 'vegf', 'egfr'],

  // ═══════════════════════════════════════════════════════════════════════
  // ONCOLOGY — Hematologic Malignancies (also under hematology TA)
  // ═══════════════════════════════════════════════════════════════════════

  aml:                  ['flt3', 'bcl2', 'cd38', 'cd19', 'pd1'],
  all:                  ['cd19', 'cd20', 'bcl2', 'pd1'],
  myeloma:              ['bcma', 'cd38', 'cd19', 'bcl2', 'pd1'],
  dlbcl:                ['cd19', 'cd20', 'bcl2', 'pd1', 'lag3'],
  follicular:           ['cd20', 'cd19', 'bcl2', 'pd1'],
  cll:                  ['btk', 'bcl2', 'cd20', 'cd19', 'pd1'],
  mantleCell:           ['btk', 'cd19', 'cd20', 'bcl2'],
  mds:                  ['flt3', 'bcl2', 'pd1', 'cd38'],
  mpn:                  ['jak1', 'pd1'],
  tCellLymphoma:        ['pd1', 'cd38', 'flt3'],
  cml:                  ['bcl2', 'pd1'],
  waldenstrom:          ['btk', 'cd20', 'bcl2'],
  hodgkins:             ['pd1', 'pdl1', 'cd19', 'cd20'],
  marginalZone:         ['btk', 'cd20', 'pd1'],
  burkitt:              ['cd20', 'cd19', 'bcl2'],
  primaryCNSLymphoma:   ['cd20', 'cd19', 'btk', 'pd1'],

  // ═══════════════════════════════════════════════════════════════════════
  // NEUROLOGY
  // ═══════════════════════════════════════════════════════════════════════

  alzheimers:           ['amyloid_beta', 'tau', 'trem2', 'app', 'glymphatic'],
  parkinsons:           ['alpha_synuclein', 'lrrk2', 'gba1'],
  migraine:             ['cgrp', 'nav1_7'],
  als:                  ['sod1', 'tfr'],
  huntingtons:          ['htt'],
  epilepsy:             ['sv2a', 'nmda', 'nav1_7'],
  ms:                   ['s1p1', 'cd20', 'btk', 'fcrn'],
  neuropathicPain:      ['nav1_7', 'cgrp'],
  pain:                 ['nav1_7', 'cgrp'],
  chronicPain:          ['nav1_7', 'cgrp'],
  lewyBody:             ['alpha_synuclein', 'tau', 'amyloid_beta'],
  frontotemporal:       ['tau', 'trem2'],
  sma:                  ['smn2'],
  psp:                  ['tau'],
  corticobasalDegen:    ['tau'],
  friedreichs:          ['tfr'],
  spinalCordInjury:     ['nav1_7'],
  tbi:                  ['tau', 'amyloid_beta', 'glymphatic'],
  insomnia:             ['nmda'],
  tardiveDyskinesia:    ['nmda'],
  narcolepsy:           ['nmda'],
  restlessLeg:          ['nav1_7'],
  tremor:               ['sv2a'],
  cidpNeuro:            ['fcrn', 'cd19', 'cd20'],
  agitationDementia:    ['nmda', 'amyloid_beta'],
  peripheralNeuropathy: ['nav1_7', 'cgrp'],
  gbs:                  ['fcrn', 'c5'],
  neuromyelitisOptica:  ['c5', 'cd19', 'cd20', 'fcrn'],
  autoimmuneEncephalitis: ['cd19', 'cd20', 'fcrn'],
  stiffPerson:          ['cd19', 'cd20', 'fcrn'],
  angelman:             ['nmda'],
  rett:                 ['nmda'],
  dravet:               ['nav1_7', 'sv2a'],
  lennoxGastaut:        ['sv2a', 'nmda'],
  dmd:                  ['dystrophin'],
  cmt:                  ['nav1_7'],
  myotonicDystrophy:    ['nmda'],
  msa:                  ['alpha_synuclein'],

  // ═══════════════════════════════════════════════════════════════════════
  // IMMUNOLOGY / AUTOIMMUNE
  // ═══════════════════════════════════════════════════════════════════════

  rheumatoidArthritis:  ['tnf_alpha', 'il17', 'jak1', 'cd20', 'ctla4', 'il23'],
  ulcerativeColitis:    ['tnf_alpha', 'il23', 'integrin_a4b7', 'jak1', 'tl1a', 'il12_23', 'madcam1', 'tnf_gi', 's1p1'],
  crohns:               ['tnf_alpha', 'il23', 'integrin_a4b7', 'jak1', 'tl1a', 'il12_23'],
  ibd_broad:            ['tnf_alpha', 'il23', 'integrin_a4b7', 'jak1', 'tl1a', 'il12_23', 'madcam1', 'tnf_gi'],
  psoriasis:            ['il17', 'il23', 'tnf_alpha', 'il13', 'tslp', 'tl1a'],
  psoriaticArthritis:   ['il17', 'il23', 'tnf_alpha', 'jak1', 'tl1a'],
  atopicDermatitis:     ['il13', 'il4r_alpha', 'jak1', 'il31', 'tslp'],
  atopicderm:           ['il13', 'il4r_alpha', 'jak1', 'il31', 'tslp'],
  sle_lupus:            ['baff', 'cd20', 'fcrn', 'c5', 'icos', 'cd19', 'jak1'],
  lupusNephritis:       ['baff', 'cd20', 'fcrn', 'c5', 'icos', 'cd19'],
  myastheniaGravis:     ['fcrn', 'c5', 'cd19', 'cd20'],
  myasthenia:           ['fcrn', 'c5', 'cd19', 'cd20'],
  asthma:               ['il13', 'il4r_alpha', 'tslp', 'il17', 'il23'],
  copd:                 ['il13', 'il4r_alpha', 'tslp', 'il17'],
  igan:                 ['baff', 'c5', 'integrin_a4b7', 'fcrn'],
  membranousNephropathy: ['cd20', 'c5', 'fcrn'],
  fsgs:                 ['cd20', 'fcrn'],
  heredAngioedema:      ['c5', 'fcrn'],
  gvhd:                 ['jak1', 'cd19', 'cd20', 'tnf_alpha'],
  chronicGvhd:          ['jak1', 'cd19', 'cd20', 'btk'],
  organTransplant:      ['cd20', 'ctla4', 'tnf_alpha', 'jak1'],
  systemicSclerosis:    ['il13', 'il4r_alpha', 'jak1', 'tnf_alpha'],
  dermatomyositis:      ['jak1', 'fcrn', 'cd20'],
  ankylosingSpondylitis: ['il17', 'tnf_alpha', 'jak1'],
  giantCellArteritis:   ['il17', 'jak1', 'tnf_alpha'],
  polymyalgiaRheumatica: ['il17', 'jak1', 'tnf_alpha'],
  behcets:              ['tnf_alpha', 'il17', 'il23'],
  egpa:                 ['il13', 'il4r_alpha', 'c5'],
  antiphospholipid:     ['c5', 'cd20', 'fcrn'],
  systemicJIA:          ['il17', 'jak1', 'tnf_alpha'],
  sarcoidosis:          ['tnf_alpha', 'jak1', 'il23'],
  uveitis:              ['tnf_alpha', 'il17', 'il23', 'jak1'],
  primaryImmunodeficiency: ['baff', 'cd20'],
  igg4Related:          ['cd20', 'cd19', 'jak1'],
  eosinophilicEsophagitis: ['il13', 'il4r_alpha', 'tslp', 'il23'],
  eosinophilicGI:       ['il13', 'il4r_alpha', 'tslp'],
  pemphigus:            ['cd20', 'cd19', 'fcrn'],
  sjogrens:             ['baff', 'cd20', 'jak1', 'icos'],
  celiac:               ['il17', 'il23', 'tnf_alpha'],
  pnh:                  ['c5'],
  coldAgglutinin:       ['c5', 'cd20'],
  itp:                  ['fcrn', 'cd20', 'baff'],
  ttpAutoimmune:        ['cd20', 'fcrn'],
  foodAllergy:          ['il13', 'il4r_alpha', 'tslp'],
  thyroidEye:           ['fcrn', 'jak1'],
  vitiligo:             ['jak1', 'il17', 'il23'],
  chronicUrticaria:     ['il4r_alpha', 'il13', 'fcrn'],
  alopecia:             ['jak1', 'il17'],
  mixedConnectiveTissue: ['tnf_alpha', 'cd20', 'jak1'],
  aancaVasculitis:      ['c5', 'cd20'],
  type1DiabetesAutoimmune: ['cd20', 'cd19', 'ctla4'],
  pbc:                  ['fxr', 'il23', 'jak1'],
  psc:                  ['il23', 'jak1', 'fxr'],
  autoImmuneHepatitis:  ['jak1', 'tnf_alpha', 'cd20'],
  nephroticSyndrome:    ['cd20', 'fcrn', 'c5'],
  rareAutoimmune:       ['cd20', 'cd19', 'fcrn', 'jak1'],
  systemicMastocytosis: ['jak1'],
  hidradenitis:         ['il17', 'tnf_alpha', 'il23'],
  epidermolysis:        ['jak1'],
  ipf:                  ['il13', 'il4r_alpha', 'tslp'],

  // ═══════════════════════════════════════════════════════════════════════
  // METABOLIC
  // ═══════════════════════════════════════════════════════════════════════

  obesity:              ['glp1r', 'gipr', 'gcgr', 'amylin'],
  obesityPediatric:     ['glp1r', 'gipr', 'gcgr', 'amylin'],
  obesitySleepApnea:    ['glp1r', 'gipr', 'gcgr'],
  obesityHeartFailure:  ['glp1r', 'gipr', 'sglt2'],
  obesityCkd:           ['glp1r', 'gipr', 'sglt2'],
  metabolicSyndrome:    ['glp1r', 'gipr', 'sglt2'],
  weightRegain:         ['glp1r', 'gipr', 'gcgr', 'amylin'],
  type2Diabetes:        ['glp1r', 'gipr', 'gcgr', 'sglt2'],
  type1Diabetes:        ['sglt2', 'amylin'],
  diabeticKidneyDisease: ['sglt2', 'glp1r'],
  nashMash:             ['fxr', 'glp1r', 'gipr'],
  lipodystrophy:        ['glp1r', 'amylin'],
  ckdMetabolic:         ['sglt2', 'glp1r'],
  familialHypercholesterolemia: ['pcsk9', 'angiotensinogen', 'apoc3'],
  severeHypertriglyceridemia: ['apoc3', 'pcsk9'],
  lpA:                  ['lpa'],
  acromegaly:           ['glp1r'],
  cushings:             ['glp1r'],
  congenitalAdrenalHyperplasia: ['glp1r'],
  congenitalHyperinsulinism: ['glp1r', 'amylin'],
  hypoparathyroidism:   ['amylin'],
  adrenalInsufficiency: ['amylin'],
  ghDeficiency:         ['glp1r'],

  // ═══════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR
  // ═══════════════════════════════════════════════════════════════════════

  heartFailure:         ['angiotensinogen', 'myosin', 'sglt2', 'factor_xi'],
  hfpef:                ['sglt2', 'angiotensinogen', 'glp1r'],

  // ═══════════════════════════════════════════════════════════════════════
  // OPHTHALMOLOGY
  // ═══════════════════════════════════════════════════════════════════════

  wetAmd:               ['vegf_ophtho', 'ang2', 'c3_ophtho'],
  dryAmd:               ['c3_ophtho', 'vegf_ophtho'],
  diabeticRetinopathy:  ['vegf_ophtho', 'ang2'],
  retinitisPigmentosa:  ['rpe65'],
  dme:                  ['vegf_ophtho', 'ang2'],

  // ═══════════════════════════════════════════════════════════════════════
  // INFECTIOUS DISEASE
  // ═══════════════════════════════════════════════════════════════════════

  hiv:                  ['hiv_integrase'],
  hepatitisB:           ['hbv_surface_antigen'],
  rsv:                  ['rsv_f_protein'],
  influenza:            ['neuraminidase'],

  // ═══════════════════════════════════════════════════════════════════════
  // RARE DISEASE (unique entries not covered above)
  // ═══════════════════════════════════════════════════════════════════════

  cftr:                 ['cftr'],
  fabry:                ['gla'],
  pompe:                ['gaa'],
  gaucher:              ['gba1'],

  // ═══════════════════════════════════════════════════════════════════════
  // HEMATOLOGY — non-malignant (unique entries)
  // ═══════════════════════════════════════════════════════════════════════

  aplasticAnemia:       ['flt3', 'cd38'],
  amyloidosisAL:        ['bcma', 'cd38', 'bcl2'],
  bpdcn:                ['cd19', 'cd38'],
  lgll:                 ['jak1'],
  castlemanDisease:     ['il17', 'jak1'],
};

/**
 * Returns targets filtered for a specific indication, falling back to TA-level
 * filtering when no indication mapping exists. Results are sorted with
 * validated targets first.
 */
export function getTargetsForIndication(
  indication: string,
  therapeuticArea: string,
): { value: string; label: string; indicationRelevant: boolean }[] {
  const indicationTargets = INDICATION_TARGET_RELEVANCE[indication];
  const allTAOptions = targetOptionsByTA[therapeuticArea] ?? [];

  if (!indicationTargets || indicationTargets.length === 0) {
    return allTAOptions.map(opt => ({ ...opt, indicationRelevant: false }));
  }

  const indicationSet = new Set(indicationTargets);

  const relevant: { value: string; label: string; indicationRelevant: boolean }[] = [];
  const other: { value: string; label: string; indicationRelevant: boolean }[] = [];

  for (const opt of allTAOptions) {
    if (indicationSet.has(opt.value)) {
      relevant.push({ ...opt, indicationRelevant: true });
    } else {
      other.push({ ...opt, indicationRelevant: false });
    }
  }

  // Also include indication-relevant targets that may belong to other TAs
  // (e.g., ms → s1p1 from immunology when in neurology TA)
  const existingSlugs = new Set(allTAOptions.map(o => o.value));
  for (const slug of indicationTargets) {
    if (!existingSlugs.has(slug)) {
      const entry = getTargetEntry(slug);
      if (entry) {
        relevant.push({
          value: entry.slug,
          label: `${entry.displayName}${entry.validatedTarget ? '' : ' (novel)'}`,
          indicationRelevant: true,
        });
      }
    }
  }

  return [...relevant, ...other];
}
