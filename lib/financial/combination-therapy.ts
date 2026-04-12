/**
 * Combination Therapy Modeling
 *
 * Models the reality that most modern oncology and immunology drugs are used
 * in combinations, not monotherapy. Combination drugs share patient pools and
 * revenue, so effective peak sales for any single component is typically
 * 30-60% of monotherapy assumptions.
 *
 * The effective revenue multiplier is computed from two factors:
 *   1. comboFraction — fraction of eligible patients who receive the drug as
 *      part of a combination regimen (vs. as a standalone monotherapy).
 *   2. revenueShare — within combo regimens, fraction of total regimen
 *      revenue that accrues to THIS asset. For checkpoint inhibitor backbones
 *      (Keytruda + chemo), the backbone captures 70-80% of revenue; a new
 *      entrant added to existing SoC typically captures 25-50%.
 *
 * effectiveRevenueMultiplier = comboFraction × revenueShare + (1 - comboFraction) × 1.0
 *
 * Floors:
 *   - Multiplier is floored at 0.25 so even heavy combo regimens retain a
 *     quarter of monotherapy value (combos are still commercially valuable).
 *
 * Sources:
 *   - ASCO 2024-2025 Standard of Care guidelines
 *   - NCCN Clinical Practice Guidelines in Oncology (2025)
 *   - EvaluatePharma 2025 combination drug analysis
 *   - Goldman Sachs Healthcare Investment Research combo deal analysis 2024
 *   - IQVIA Oncology Combination Therapy Trends 2024
 */

export type CombinationContext =
  | 'monotherapy'
  | 'combination_with_existing_soc'
  | 'combination_new_pair'
  | 'either';

export interface CombinationDynamics {
  /** Default context for this indication */
  context: CombinationContext;
  /**
   * Fraction of patients who receive this drug as part of a combo regimen
   * (vs. monotherapy). 0 = always mono, 1 = always combo.
   */
  comboFraction: number;
  /**
   * Within combo regimens, fraction of regimen revenue attributable to
   * THIS drug (vs. partner drugs). For Keytruda + chemo, Keytruda captures
   * ~0.70-0.80. For a new entrant bolted onto existing SoC, typically
   * 0.25-0.50.
   */
  revenueShare: number;
  /**
   * Effective revenue multiplier vs. pure monotherapy assumption.
   * Pre-computed from comboFraction and revenueShare, floored at 0.25.
   */
  effectiveRevenueMultiplier: number;
  /** Combination partner drug(s) (for pricing context / transparency) */
  partnerDrug?: string;
  /** Clinical rationale explaining the dynamics */
  notes: string;
}

/** Minimum multiplier — combos still carry meaningful commercial value. */
const MIN_COMBO_MULTIPLIER = 0.25;

/**
 * Compute the effective revenue multiplier given combo dynamics.
 * Exported for tests and for callers that construct bespoke dynamics.
 */
export function computeEffectiveMultiplier(
  comboFraction: number,
  revenueShare: number,
): number {
  const cf = Math.max(0, Math.min(1, comboFraction));
  const rs = Math.max(0, Math.min(1, revenueShare));
  const raw = cf * rs + (1 - cf) * 1.0;
  return Math.max(MIN_COMBO_MULTIPLIER, Math.min(1.0, raw));
}

function build(
  context: CombinationContext,
  comboFraction: number,
  revenueShare: number,
  notes: string,
  partnerDrug?: string,
): CombinationDynamics {
  return {
    context,
    comboFraction,
    revenueShare,
    effectiveRevenueMultiplier: computeEffectiveMultiplier(comboFraction, revenueShare),
    partnerDrug,
    notes,
  };
}

/**
 * Combination dynamics keyed by indication slug.
 *
 * Covers the top 40+ indications where combination dynamics materially
 * change the effective peak sales assumption. Indications not listed here
 * default to no adjustment (monotherapy assumption).
 */
export const COMBINATION_BY_INDICATION: Record<string, CombinationDynamics> = {
  // ==========================================================================
  // ONCOLOGY — combination is the standard of care
  // ==========================================================================
  lung_nsclc: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Standard of care for advanced NSCLC is checkpoint inhibitor + platinum doublet chemo (Keytruda + pem/carbo). New entrants must combo to win formulary access. Source: NCCN NSCLC 2025, ASCO 2024.',
    'Keytruda + platinum doublet chemotherapy',
  ),
  lung_sclc: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'SCLC first-line is atezolizumab/durvalumab + etoposide + platinum. Combo is mandatory; new entrants share revenue with IO backbone and chemo. Source: NCCN SCLC 2025.',
    'Atezolizumab/Durvalumab + Etoposide + Platinum',
  ),
  breast_her2: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'HER2+ breast almost always uses dual anti-HER2 (Herceptin + Perjeta) + taxane chemo in first-line metastatic. Adjuvant regimens similarly combine multiple agents. Source: NCCN Breast 2025.',
    'Herceptin + Perjeta + taxane',
  ),
  breast_hr_positive: build(
    'combination_with_existing_soc',
    0.85,
    0.45,
    'HR+/HER2- metastatic breast is CDK4/6 inhibitor + aromatase inhibitor or fulvestrant. New entrants typically add onto this backbone. Source: NCCN Breast 2025.',
    'CDK4/6 inhibitor + endocrine therapy',
  ),
  breast_tnbc: build(
    'combination_with_existing_soc',
    0.80,
    0.40,
    'Triple-negative breast increasingly uses Keytruda + chemo in first-line PD-L1+ patients. ADCs (Trodelvy) dominate later lines. Source: NCCN Breast 2025.',
    'Keytruda + chemotherapy',
  ),
  multiple_myeloma: build(
    'combination_with_existing_soc',
    0.95,
    0.28,
    'Modern myeloma uses 3-4 drug regimens (Dara-VRd, KRd, DRd). Single-agent therapy is rare outside relapsed/refractory late-line. New entrants slot into an existing 3-drug backbone. Source: NCCN Myeloma 2025.',
    'Daratumumab + Lenalidomide + Bortezomib + Dexamethasone',
  ),
  dlbcl: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'DLBCL first-line is R-CHOP or Pola-R-CHP (6 agents). New entrants typically replace a component or add to the regimen. Source: NCCN B-Cell Lymphoma 2025.',
    'Rituximab + CHOP / Pola-R-CHP',
  ),
  follicular_lymphoma: build(
    'combination_with_existing_soc',
    0.80,
    0.40,
    'Follicular lymphoma uses rituximab + chemo (bendamustine, CHOP) or obinutuzumab combos. Rituximab maintenance extends revenue share to backbone. Source: NCCN B-Cell Lymphoma 2025.',
    'Rituximab/Obinutuzumab + chemotherapy',
  ),
  mantle_cell_lymphoma: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Mantle cell uses BTK inhibitor + rituximab or R-CHOP/cytarabine regimens. Combinations dominate both first-line and relapsed settings. Source: NCCN 2025.',
    'BTK inhibitor + Rituximab',
  ),
  cll: build(
    'combination_with_existing_soc',
    0.70,
    0.55,
    'CLL increasingly uses fixed-duration Venetoclax + obinutuzumab or BTK inhibitor + venetoclax combos, though BTKi monotherapy remains common. Source: NCCN CLL 2025.',
    'Venetoclax + Obinutuzumab',
  ),
  aml: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'AML first-line is venetoclax + HMA in unfit patients, or 7+3 cytarabine/anthracycline in fit patients. Targeted agents (FLT3, IDH) add to backbone. Source: NCCN AML 2025.',
    'Venetoclax + HMA / 7+3 chemo',
  ),
  all_leukemia: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'ALL uses multi-agent chemo backbones (hyper-CVAD, BFM) with targeted agents (blinatumomab, inotuzumab, TKIs for Ph+) layered on. Source: NCCN ALL 2025.',
    'Multi-agent chemo + targeted therapy',
  ),
  ovarian: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Ovarian first-line is carboplatin + paclitaxel +/- bevacizumab, with PARP inhibitor maintenance. New entrants usually combo with platinum or serve as maintenance. Source: NCCN Ovarian 2025.',
    'Carboplatin + Paclitaxel + Bevacizumab + PARPi maintenance',
  ),
  melanoma: build(
    'combination_with_existing_soc',
    0.75,
    0.45,
    'Advanced melanoma uses nivolumab + ipilimumab or nivolumab + relatlimab dual IO combos. BRAF+ patients use BRAF + MEK inhibitor combos. Monotherapy use is declining. Source: NCCN Melanoma 2025.',
    'Nivolumab + Ipilimumab / BRAFi + MEKi',
  ),
  head_neck: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'First-line recurrent/metastatic head & neck is Keytruda + platinum + 5-FU (EXTREME-like regimen). Concurrent chemoradiation in locoregional setting. Source: NCCN H&N 2025.',
    'Keytruda + Platinum + 5-FU',
  ),
  colorectal: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'mCRC uses FOLFOX/FOLFIRI +/- bevacizumab or cetuximab. Every first-line regimen is 3+ drugs. New entrants stack onto an existing backbone. Source: NCCN CRC 2025.',
    'FOLFOX/FOLFIRI + bevacizumab/cetuximab',
  ),
  pancreatic: build(
    'combination_with_existing_soc',
    0.90,
    0.35,
    'Pancreatic first-line is FOLFIRINOX or gem/nab-paclitaxel. Monotherapy is reserved for poor performance status. Source: NCCN Pancreatic 2025.',
    'FOLFIRINOX / Gemcitabine + nab-Paclitaxel',
  ),
  prostate: build(
    'combination_with_existing_soc',
    0.80,
    0.45,
    'mCSPC uses ADT + novel hormonal agent +/- docetaxel (triplet therapy). mCRPC combines with PARPi, radiopharmaceuticals, or chemo. Source: NCCN Prostate 2025.',
    'ADT + ARPI + Docetaxel',
  ),
  bladder: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Advanced urothelial first-line is enfortumab vedotin + pembrolizumab (EV+P). Previously platinum-based chemo + IO maintenance. Source: NCCN Bladder 2025.',
    'Enfortumab vedotin + Pembrolizumab',
  ),
  renal_cell: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Advanced RCC first-line is IO + TKI (pembro + axitinib, nivo + cabo) or dual IO (nivo + ipi). Monotherapy is rare. Source: NCCN Kidney 2025.',
    'IO + TKI / Dual IO',
  ),
  gastric: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Advanced gastric/GEJ first-line is nivolumab or pembrolizumab + FOLFOX/CAPOX. HER2+ adds trastuzumab. Source: NCCN Gastric 2025.',
    'Nivolumab + FOLFOX',
  ),
  esophageal: build(
    'combination_with_existing_soc',
    0.85,
    0.40,
    'Esophageal uses pembrolizumab or nivolumab + chemo in first-line metastatic, concurrent chemoradiation in locoregional. Source: NCCN Esophageal 2025.',
    'Pembrolizumab + FOLFOX',
  ),
  hepatocellular: build(
    'combination_with_existing_soc',
    0.80,
    0.45,
    'Unresectable HCC first-line is atezolizumab + bevacizumab or durvalumab + tremelimumab. Source: NCCN HCC 2025.',
    'Atezolizumab + Bevacizumab',
  ),
  cervical: build(
    'combination_with_existing_soc',
    0.80,
    0.45,
    'Recurrent/metastatic cervical uses pembrolizumab + chemo +/- bevacizumab. Source: NCCN Cervical 2025.',
    'Pembrolizumab + chemotherapy + bevacizumab',
  ),
  endometrial: build(
    'combination_with_existing_soc',
    0.80,
    0.45,
    'Advanced endometrial uses dostarlimab or pembrolizumab + carbo/paclitaxel in first-line. Source: NCCN Endometrial 2025.',
    'Dostarlimab + Carboplatin + Paclitaxel',
  ),
  glioblastoma: build(
    'combination_with_existing_soc',
    0.70,
    0.55,
    'GBM standard is temozolomide + radiation (Stupp protocol) +/- TTFields. Combination dominates but new agents often tested as monotherapy. Source: NCCN CNS 2025.',
    'Temozolomide + Radiation',
  ),

  // ==========================================================================
  // HEMATOLOGY (non-malignant / mixed)
  // ==========================================================================
  myelofibrosis: build(
    'either',
    0.40,
    0.70,
    'JAK inhibitor monotherapy (ruxolitinib) dominates, but newer combos with BET/BCL-xL/PIM inhibitors are emerging. Source: NCCN MPN 2025.',
    'Ruxolitinib +/- novel agents',
  ),
  sickle_cell: build(
    'either',
    0.30,
    0.80,
    'Hydroxyurea foundation with L-glutamine, crizanlizumab, or voxelotor added. Gene therapies are standalone. Source: ASH 2024 guidelines.',
  ),

  // ==========================================================================
  // IMMUNOLOGY — mostly monotherapy
  // ==========================================================================
  rheumatoid_arthritis: build(
    'either',
    0.30,
    0.80,
    'Most biologics/JAKi are used as monotherapy or with low-dose methotrexate. Methotrexate is cheap generic so revenue share is high. Source: ACR 2024 guidelines.',
    'Low-dose methotrexate',
  ),
  psoriasis: build(
    'monotherapy',
    0.10,
    0.95,
    'Biologic monotherapy (IL-17, IL-23, TNF) is standard. Topical combos exist but do not share systemic biologic revenue. Source: AAD 2024 guidelines.',
  ),
  psoriatic_arthritis: build(
    'monotherapy',
    0.15,
    0.90,
    'Biologic monotherapy standard; some concurrent methotrexate use. Source: GRAPPA 2024.',
  ),
  atopic_dermatitis: build(
    'either',
    0.35,
    0.80,
    'Dupilumab and JAKi typically monotherapy; often co-administered with topical corticosteroids/calcineurin inhibitors which do not materially reduce systemic revenue. Source: AAD 2024.',
    'Topical corticosteroids',
  ),
  lupus: build(
    'either',
    0.50,
    0.70,
    'Biologics layered on hydroxychloroquine + immunosuppressants (MMF, methotrexate). Background therapy captures some revenue share. Source: ACR 2024 lupus.',
    'Hydroxychloroquine + immunosuppressants',
  ),
  ms: build(
    'monotherapy',
    0.05,
    0.95,
    'MS disease-modifying therapies are monotherapy — combining DMTs increases infection/PML risk. Source: AAN 2024.',
  ),
  ibd_uc: build(
    'either',
    0.40,
    0.75,
    'UC biologics often layered on 5-ASA or immunomodulators (thiopurines, methotrexate). Biologic captures most revenue share. Source: ACG 2024.',
    '5-ASA / immunomodulators',
  ),
  ibd_cd: build(
    'either',
    0.40,
    0.75,
    'Crohns biologics often combined with immunomodulators (SONIC regimen). Anti-TNF + azathioprine is common. Source: ACG 2024.',
    'Immunomodulators',
  ),

  // ==========================================================================
  // NEUROLOGY — mostly monotherapy
  // ==========================================================================
  alzheimers: build(
    'monotherapy',
    0.10,
    0.92,
    'Anti-amyloid DMTs (lecanemab, donanemab) are the sole disease-modifying agents. Symptomatic therapies (cholinesterase inhibitors, memantine) co-administered but do not share DMT revenue meaningfully. Source: AAN 2024.',
    'Cholinesterase inhibitors + memantine',
  ),
  als: build(
    'either',
    0.30,
    0.85,
    'Riluzole is foundation; newer agents (edaravone, tofersen, AMX0035) layered on. Riluzole is generic so revenue share stays high for new entrants. Source: AAN 2024.',
    'Riluzole',
  ),
  parkinsons: build(
    'either',
    0.40,
    0.80,
    'Levodopa is backbone; dopamine agonists, MAO-B, COMT inhibitors layered on. Levodopa is generic so new agents capture majority of novel revenue. Source: MDS 2024.',
    'Levodopa',
  ),
  huntingtons: build(
    'monotherapy',
    0.10,
    0.92,
    'No disease-modifying therapies approved; symptomatic agents used as monotherapy. Source: HSG 2024.',
  ),
  epilepsy: build(
    'either',
    0.50,
    0.65,
    'Refractory epilepsy often requires polypharmacy (2-3 AEDs). New entrants share revenue with existing AEDs. Source: ILAE 2024.',
    'Multiple AEDs',
  ),
  migraine: build(
    'monotherapy',
    0.15,
    0.90,
    'CGRP mAbs and gepants are predominantly monotherapy; acute and preventive can overlap but are distinct revenue streams. Source: AHS 2024.',
  ),

  // ==========================================================================
  // RARE DISEASE — almost all monotherapy
  // ==========================================================================
  dmd: build(
    'monotherapy',
    0.10,
    0.92,
    'Single-mechanism approaches dominate (exon skipping, gene therapy, corticosteroids). Corticosteroids are generic. Source: PPMD 2024.',
    'Corticosteroids',
  ),
  cystic_fibrosis: build(
    'monotherapy',
    0.05,
    0.95,
    'CFTR modulators (Trikafta) are the standard; non-modulator CF therapies are adjunctive but do not share modulator revenue. Source: CFF 2024.',
  ),
  sma: build(
    'monotherapy',
    0.05,
    0.95,
    'Nusinersen, risdiplam, onasemnogene are all single-agent therapies; sequential not combined. Source: SMA News Today / TREAT-NMD 2024.',
  ),
  hae: build(
    'monotherapy',
    0.05,
    0.95,
    'HAE prophylaxis (lanadelumab, berotralstat) is monotherapy; acute attack treatment is separate. Source: WAO/EAACI 2024.',
  ),
  pompe: build(
    'monotherapy',
    0.10,
    0.92,
    'Enzyme replacement therapy is standalone; substrate reduction therapies are alternative not additive. Source: AMDA 2024.',
  ),
  fabry: build(
    'monotherapy',
    0.05,
    0.95,
    'ERT (agalsidase) or chaperone (migalastat) as monotherapy; patients typically use one or the other. Source: NORD 2024.',
  ),
  gaucher: build(
    'monotherapy',
    0.05,
    0.95,
    'ERT (imiglucerase, velaglucerase) or SRT (eliglustat, miglustat) — patients use one modality. Source: NORD 2024.',
  ),

  // ==========================================================================
  // METABOLIC — mixed
  // ==========================================================================
  type2_diabetes: build(
    'either',
    0.55,
    0.80,
    'New oral/injectable agents layered onto metformin foundation. Metformin is generic so novel mechanism captures most new revenue. Source: ADA 2024.',
    'Metformin',
  ),
  obesity: build(
    'monotherapy',
    0.10,
    0.92,
    'GLP-1/GIP agonists are used as monotherapy for weight loss. Lifestyle intervention is standard but not a drug. Source: TOS/AACE 2024.',
  ),
  nash_mash: build(
    'either',
    0.40,
    0.75,
    'Resmetirom and future agents typically monotherapy; sometimes co-administered with GLP-1 or obesity agents in patients with metabolic comorbidities. Source: AASLD 2024.',
  ),

  // ==========================================================================
  // CARDIOVASCULAR — mostly additive, generics dominate backbone
  // ==========================================================================
  heart_failure: build(
    'either',
    0.60,
    0.75,
    'Guideline-directed medical therapy is 4-drug regimen (ARNI, beta-blocker, MRA, SGLT2i). New agents layered on, but 3 of 4 backbone drugs are generic so new entrants retain most novel revenue. Source: ACC/AHA 2024.',
    'ARNI + Beta-blocker + MRA + SGLT2i',
  ),
  afib: build(
    'either',
    0.30,
    0.85,
    'DOACs are monotherapy for stroke prevention; rate/rhythm control agents are separate revenue pools. Source: ACC/AHA 2024.',
  ),
  hypertension: build(
    'either',
    0.50,
    0.80,
    'Combo therapy common (RAS + CCB + diuretic) but backbone is all generic, so new entrants capture novel revenue. Source: ACC/AHA 2024.',
  ),
  hypercholesterolemia: build(
    'either',
    0.50,
    0.80,
    'Statin backbone is generic; PCSK9i, lp(a), bempedoic acid layered on. New mechanisms retain most of their revenue. Source: ACC/AHA 2024.',
    'Statins',
  ),

  // ==========================================================================
  // INFECTIOUS DISEASE — varies; usually single-drug or replacement combos
  // ==========================================================================
  hiv: build(
    'combination_with_existing_soc',
    0.95,
    0.40,
    'HIV ART is always 3-drug combo (e.g., BIC/FTC/TAF). New entrants typically replace a component rather than adding. Revenue share reflects single-component contribution. Source: DHHS ART 2024.',
    '3-drug ART regimen',
  ),
  hcv: build(
    'combination_with_existing_soc',
    0.90,
    0.50,
    'HCV DAAs are fixed-dose combos (sof/vel, gle/pib) marketed as single products, so revenue share goes to the formulated combo brand. Source: AASLD 2024.',
    'DAA combo',
  ),
  tuberculosis: build(
    'combination_with_existing_soc',
    0.95,
    0.30,
    'TB is 4-drug regimen (RIPE) for 6+ months. MDR-TB uses bedaquiline/pretomanid/linezolid combos. Source: WHO 2024.',
    'Rifampin + Isoniazid + Pyrazinamide + Ethambutol',
  ),
  covid19: build(
    'either',
    0.20,
    0.90,
    'Antivirals (Paxlovid, remdesivir) are monotherapy; sometimes used with supportive care. Source: NIH COVID-19 guidelines 2024.',
  ),
  flu: build(
    'monotherapy',
    0.10,
    0.92,
    'Influenza antivirals (oseltamivir, baloxavir) are monotherapy. Source: CDC 2024.',
  ),
  rsv: build(
    'monotherapy',
    0.10,
    0.92,
    'RSV prophylaxis (nirsevimab) and vaccines are standalone. Source: CDC ACIP 2024.',
  ),

  // ==========================================================================
  // OPHTHALMOLOGY — mostly monotherapy
  // ==========================================================================
  wet_amd: build(
    'monotherapy',
    0.10,
    0.92,
    'Anti-VEGF intravitreal injections (aflibercept, ranibizumab, faricimab) are monotherapy. Source: AAO 2024.',
  ),
  diabetic_retinopathy: build(
    'monotherapy',
    0.10,
    0.92,
    'Anti-VEGF monotherapy with occasional laser adjuvant. Source: AAO 2024.',
  ),
  dry_eye: build(
    'monotherapy',
    0.15,
    0.90,
    'Prescription dry eye treatments (cyclosporine, lifitegrast) are monotherapy. Source: AAO 2024.',
  ),

  // ==========================================================================
  // WOMEN'S HEALTH
  // ==========================================================================
  endometriosis: build(
    'monotherapy',
    0.10,
    0.92,
    'GnRH antagonists (elagolix, relugolix) are monotherapy; add-back hormones are bundled. Source: ACOG 2024.',
  ),
  uterine_fibroids: build(
    'monotherapy',
    0.10,
    0.92,
    'GnRH antagonists are monotherapy for fibroid-related heavy menstrual bleeding. Source: ACOG 2024.',
  ),
  menopause: build(
    'monotherapy',
    0.10,
    0.92,
    'NK3 antagonists (fezolinetant) and HRT are used as monotherapy. Source: NAMS 2024.',
  ),

  // ==========================================================================
  // DERMATOLOGY
  // ==========================================================================
  vitiligo: build(
    'monotherapy',
    0.20,
    0.90,
    'JAK inhibitor monotherapy (ruxolitinib cream). Sometimes combined with phototherapy but phototherapy is not drug revenue. Source: AAD 2024.',
  ),
  alopecia_areata: build(
    'monotherapy',
    0.10,
    0.92,
    'Oral JAK inhibitors (baricitinib, ritlecitinib) are monotherapy. Source: AAD 2024.',
  ),

  // ==========================================================================
  // GASTROENTEROLOGY
  // ==========================================================================
  eosinophilic_esophagitis: build(
    'monotherapy',
    0.15,
    0.90,
    'Dupilumab and swallowed topical steroids are typically monotherapy. Source: ACG 2024.',
  ),
};

/**
 * Alias map — indication names can vary across the codebase. Normalize here.
 */
const INDICATION_ALIASES: Record<string, string> = {
  nsclc: 'lung_nsclc',
  lung_cancer: 'lung_nsclc',
  sclc: 'lung_sclc',
  her2_breast: 'breast_her2',
  hr_positive_breast: 'breast_hr_positive',
  tnbc: 'breast_tnbc',
  mm: 'multiple_myeloma',
  myeloma: 'multiple_myeloma',
  diffuse_large_b_cell_lymphoma: 'dlbcl',
  crc: 'colorectal',
  mcrc: 'colorectal',
  rcc: 'renal_cell',
  hcc: 'hepatocellular',
  gbm: 'glioblastoma',
  ra: 'rheumatoid_arthritis',
  psa: 'psoriatic_arthritis',
  ad: 'atopic_dermatitis',
  sle: 'lupus',
  multiple_sclerosis: 'ms',
  ulcerative_colitis: 'ibd_uc',
  crohns: 'ibd_cd',
  crohns_disease: 'ibd_cd',
  alzheimer: 'alzheimers',
  alzheimer_disease: 'alzheimers',
  parkinson: 'parkinsons',
  parkinson_disease: 'parkinsons',
  huntington: 'huntingtons',
  duchenne: 'dmd',
  duchenne_muscular_dystrophy: 'dmd',
  cf: 'cystic_fibrosis',
  t2d: 'type2_diabetes',
  diabetes_type_2: 'type2_diabetes',
  nash: 'nash_mash',
  mash: 'nash_mash',
  hf: 'heart_failure',
  hfref: 'heart_failure',
  hfpef: 'heart_failure',
  atrial_fibrillation: 'afib',
  htn: 'hypertension',
  ldl: 'hypercholesterolemia',
  hepatitis_c: 'hcv',
  tb: 'tuberculosis',
  influenza: 'flu',
  amd: 'wet_amd',
  neovascular_amd: 'wet_amd',
  eoe: 'eosinophilic_esophagitis',
};

function normalizeIndication(indication: string): string {
  if (!indication) return '';
  const key = indication.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return INDICATION_ALIASES[key] || key;
}

/**
 * Look up combination dynamics for an indication. Returns null if no data.
 */
export function getCombinationDynamics(indication: string): CombinationDynamics | null {
  if (!indication) return null;
  const key = normalizeIndication(indication);
  return COMBINATION_BY_INDICATION[key] || null;
}

export interface CombinationAdjustmentResult {
  adjusted: number;
  multiplier: number;
  rationale: string | null;
  dynamics: CombinationDynamics | null;
}

/**
 * Apply combination therapy adjustment to a peak sales estimate.
 *
 * If the user explicitly selects 'monotherapy' as their context, no
 * adjustment is applied (they are asserting the asset will not be used in
 * combination). Otherwise, the effective revenue multiplier from
 * COMBINATION_BY_INDICATION is applied.
 *
 * Indications with no combo data pass through unchanged.
 */
export function applyCombinationAdjustment(
  basePeakSales: number,
  indication: string,
  userOverride?: CombinationContext,
): CombinationAdjustmentResult {
  const dynamics = getCombinationDynamics(indication);
  if (!dynamics) {
    return {
      adjusted: basePeakSales,
      multiplier: 1.0,
      rationale: null,
      dynamics: null,
    };
  }

  // If user explicitly asserts monotherapy, skip the combo discount.
  if (userOverride === 'monotherapy') {
    return {
      adjusted: basePeakSales,
      multiplier: 1.0,
      rationale: 'User specified monotherapy — no combo adjustment applied',
      dynamics,
    };
  }

  const multiplier = dynamics.effectiveRevenueMultiplier;
  return {
    adjusted: basePeakSales * multiplier,
    multiplier,
    rationale: `Combination adjustment (${(multiplier * 100).toFixed(0)}% of monotherapy assumption): ${dynamics.notes}`,
    dynamics,
  };
}
