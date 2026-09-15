/**
 * Trial lifecycle sequence — the standing founder-led conversion motion.
 *
 * Pure module: no I/O. Given a profile, their calculations, and a few verified
 * comps for their indication, it decides which track and touch applies today
 * and renders the plain-text email in Issa's voice.
 *
 * Copy rules (from the Sep 2026 cohort campaign, docs/trial-lifecycle.md):
 *   1. Lead with one exact fact about their indication. No hedges.
 *   2. Usage informs the email but never appears as a count.
 *   3. One CTA per email, deep-linked to their program. Pricing page only in T3
 *      and T2 (day-of).
 *   4. Price appears once, late, never in the subject.
 *   5. Subject is the insight, four to nine words.
 *   6. Plain text, from Issa, no template, no discount, no "extend your trial".
 *   7. No methodology jargon (engine, backtest, calibration, corpus).
 *
 * Tracks:
 *   active    — trial with at least one benchmark: T-5 / day-of / T+3
 *   zero_calc — trial that never ran a benchmark: same timing, build-it-for-you copy
 *   winback   — reopened 7-day Pro window (pro_engagement_type starts with
 *               "winback"): reopen day / two days before close / T+3
 */

export type Track = 'active' | 'zero_calc' | 'winback';
export type Touch = 't1' | 't2' | 't3';

export interface SequenceProfile {
  id: string;
  email: string;
  fullName?: string | null;
  tier: string | null;
  proExpiresAt: string | null;
  proEngagementType?: string | null;
  subscriptionStatus?: string | null;
}

export interface SequenceCalculation {
  therapeuticArea: string | null;
  indication: string | null;
  phase: string | null;
  modality: string | null;
  dealType?: string | null;
  createdAt: string;
}

export interface SequenceComp {
  licensorName: string;
  licenseeName: string;
  assetName?: string | null;
  phaseAtSigning?: string | null;
  upfrontUsd?: number | null;
  totalDealValueUsd?: number | null;
  announcedDate?: string | null;
  verified?: boolean | null;
}

/** Offers are copy, gated by flags that default OFF until Issa confirms dates. */
export interface SequenceOffers {
  /** 60 days of Terrain free for anyone on Pro by trial end (October launch). */
  terrainAccess: boolean;
  /** Search & Evaluation module releasing this month. */
  searchModule: boolean;
}

export interface SequenceContext {
  profile: SequenceProfile;
  calculations: SequenceCalculation[];
  comps: SequenceComp[];
  /** Count of deals with disclosed terms in the indication, from the quality-filtered pool. */
  indicationDealCount?: number;
  /**
   * Whether `comps` matched the indication or only the therapeutic area. The
   * fact sentence names the scope honestly: a neurology comp is not an MS comp.
   */
  compsScope?: 'indication' | 'ta';
  offers: SequenceOffers;
  now: Date;
}

export interface SequenceEmail {
  track: Track;
  touch: Touch;
  subject: string;
  text: string;
  /** Deep link the email points at; used for QA and logging. */
  cta: string;
}

export const BASE_URL = 'https://solidus.ambrosiaventures.co';
export const PRICING_URL = `${BASE_URL}/pricing`;
export const FOUNDER_FROM = 'Issa Kildani <ikildani@ambrosiaventures.co>';
export const FOUNDER_REPLY_TO = 'ikildani@ambrosiaventures.co';
export const SIGNATURE = 'Issa Kildani\nAmbrosia Ventures';

/** Read the offer flags from the environment. Both default OFF. */
export function offersFromEnv(env: NodeJS.ProcessEnv = process.env): SequenceOffers {
  const on = (v: string | undefined) => v === '1' || v === 'true';
  return {
    terrainAccess: on(env.TRIAL_OFFER_TERRAIN),
    searchModule: on(env.TRIAL_OFFER_SEARCH_MODULE),
  };
}

/** Phrases that must never appear in a lifecycle email (see copy rule 6 and 7). */
export const BANNED_PHRASES = [
  'backtest',
  'calibrat',
  'corpus',
  'our model',
  'valuation engine',
  'accuracy band',
  'hit rate',
  'extend your trial',
  'extend the trial',
  '% off',
  'promo',
  'discount',
  'coupon',
  'retained',
  'last chance',
  'limited time',
];

/** Engagement types that are never in the sequence. */
const EXCLUDED_ENGAGEMENT = new Set(['internal_team', 'complimentary', 'advisory-guest']);
const EXCLUDED_TIERS = new Set(['portfolio', 'report']);

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const TA_LABELS: Record<string, string> = {
  oncology: 'oncology',
  neurology: 'neurology',
  immunology: 'immunology',
  metabolic: 'metabolic disease',
  cardiovascular: 'cardiovascular',
  infectiousDisease: 'infectious disease',
  ophthalmology: 'ophthalmology',
  womensHealth: "women's health",
  rareDisease: 'rare disease',
  hematology: 'hematology',
  dermatology: 'dermatology',
  gastroenterology: 'gastroenterology',
};

const PHASE_LABELS: Record<string, string> = {
  discovery: 'discovery',
  preclinical: 'preclinical',
  phase1: 'Phase 1',
  phase1_2: 'Phase 1/2',
  phase2: 'Phase 2',
  phase2_3: 'Phase 2/3',
  phase3: 'Phase 3',
  nda_filed: 'NDA-stage',
  approved: 'approved',
};

const MODALITY_LABELS: Record<string, string> = {
  smallMolecule: 'small molecule',
  mab: 'antibody',
  adc: 'ADC',
  bispecific: 'bispecific',
  trispecificAntibody: 'trispecific',
  tCellEngager: 'T-cell engager',
  carT_heme: 'CAR-T',
  carT_solid: 'CAR-T',
  cellTherapy: 'cell therapy',
  geneTherapy: 'gene therapy',
  radiopharmaceutical: 'radiopharmaceutical',
  mrna: 'mRNA',
  rnai: 'RNAi',
  protac: 'PROTAC',
  molecularGlue: 'molecular glue',
  peptide: 'peptide',
  therapeuticVaccine: 'therapeutic vaccine',
  oncolyticVirus: 'oncolytic virus',
  aso: 'ASO',
  oligonucleotide: 'oligonucleotide',
  glp1Agonist: 'GLP-1',
  dualIncretin: 'dual incretin',
  tripleIncretin: 'triple incretin',
  enzymeReplacement: 'enzyme replacement',
  jakInhibitor: 'JAK inhibitor',
  s1pModulator: 'S1P modulator',
  tl1aInhibitor: 'TL1A antibody',
  fcrnAntagonist: 'FcRn antagonist',
  complementInhibitor: 'complement inhibitor',
};

const INDICATION_LABELS: Record<string, string> = {
  lung_nsclc: 'NSCLC',
  lung_sclc: 'SCLC',
  breast_tnbc: 'TNBC',
  breast_her2: 'HER2+ breast cancer',
  breast: 'breast cancer',
  pancreatic: 'pancreatic cancer',
  gastric: 'gastric cancer',
  colorectal: 'colorectal cancer',
  prostate: 'prostate cancer',
  ovarian: 'ovarian cancer',
  melanoma: 'melanoma',
  glioblastoma: 'glioblastoma',
  hcc: 'HCC',
  neuroblastoma: 'neuroblastoma',
  mesothelioma: 'mesothelioma',
  alzheimers: "Alzheimer's",
  parkinsons: "Parkinson's",
  schizophrenia: 'schizophrenia',
  ms: 'multiple sclerosis',
  tbi: 'traumatic brain injury',
  als: 'ALS',
  epilepsy: 'epilepsy',
  migraine: 'migraine',
  depression: 'depression',
  asthma: 'asthma',
  ulcerativeColitis: 'ulcerative colitis',
  crohns: "Crohn's",
  ra: 'rheumatoid arthritis',
  lupus: 'lupus',
  psoriasis: 'psoriasis',
  atopicDermatitis: 'atopic dermatitis',
  alopeciaAreata: 'alopecia areata',
  celiacDisease: 'celiac disease',
  nashMash: 'MASH',
  obesity: 'obesity',
  t2d: 'type 2 diabetes',
  heartFailure: 'heart failure',
  hypertension: 'hypertension',
  endometriosis: 'endometriosis',
  spinalMuscularAtrophy: 'SMA',
  dmd: 'DMD',
  hemophilia: 'hemophilia',
  sickleCell: 'sickle cell disease',
  wetAmd: 'wet AMD',
  diabeticMacularEdema: 'diabetic macular edema',
  hepatitisB: 'hepatitis B',
  dlbcl: 'DLBCL',
  multipleMyeloma: 'multiple myeloma',
  aml: 'AML',
};

/**
 * Search stem for matching an indication key against deal rows. Abbreviation
 * keys map to the words a press release would use; anything under three
 * characters is unusable and returns null so the caller falls back to TA.
 */
const INDICATION_SEARCH_TERMS: Record<string, string> = {
  ms: 'multiple sclerosis',
  tbi: 'traumatic brain',
  als: 'amyotrophic',
  dmd: 'duchenne',
  hcc: 'hepatocellular',
  aml: 'acute myeloid',
  ra: 'rheumatoid',
  dlbcl: 'lymphoma',
  nashMash: 'mash',
  t2d: 'diabetes',
  wetAmd: 'macular',
  lung_nsclc: 'lung',
  lung_sclc: 'lung',
  breast_tnbc: 'breast',
  breast_her2: 'breast',
  spinalMuscularAtrophy: 'spinal muscular',
  ulcerativeColitis: 'colitis',
  atopicDermatitis: 'atopic',
  alopeciaAreata: 'alopecia',
  celiacDisease: 'celiac',
  diabeticMacularEdema: 'macular edema',
  heartFailure: 'heart failure',
  hepatitisB: 'hepatitis b',
  multipleMyeloma: 'myeloma',
  sickleCell: 'sickle',
};

export function indicationSearchTerm(key: string | null | undefined): string | null {
  if (!key) return null;
  const mapped = INDICATION_SEARCH_TERMS[key];
  if (mapped) return mapped;
  const base = key.split('_')[0].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();
  return base.length >= 3 ? base : null;
}

function possessive(name: string): string {
  const n = name.trim();
  return /s$/i.test(n) ? `${n}'` : `${n}'s`;
}

function humanize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

export function indicationLabel(key: string | null | undefined): string {
  if (!key) return 'your indication';
  return INDICATION_LABELS[key] || humanize(key);
}
export function phaseLabel(key: string | null | undefined): string {
  if (!key) return 'this stage';
  return PHASE_LABELS[key] || humanize(key);
}
export function modalityLabel(key: string | null | undefined): string {
  if (!key) return 'program';
  return MODALITY_LABELS[key] || humanize(key);
}
export function taLabel(key: string | null | undefined): string {
  if (!key) return 'your area';
  return TA_LABELS[key] || humanize(key);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatMoney(usd: number | null | undefined): string | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  if (usd >= 1e9) {
    const b = usd / 1e9;
    return `$${b >= 10 ? b.toFixed(1) : b.toFixed(2).replace(/0$/, '')}B`;
  }
  return `$${Math.round(usd / 1e6)}M`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Calendar-day difference (UTC) between an ISO timestamp and now. Positive = future. */
export function daysUntil(iso: string, now: Date): number {
  const target = Date.UTC(new Date(iso).getUTCFullYear(), new Date(iso).getUTCMonth(), new Date(iso).getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86400000);
}

function weekdayOf(iso: string): string {
  return WEEKDAYS[new Date(iso).getUTCDay()];
}
function monthOf(iso: string): string {
  return MONTHS[new Date(iso).getUTCMonth()];
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

function firstName(profile: SequenceProfile): string | null {
  const n = (profile.fullName || '').trim();
  if (!n) return null;
  const first = n.split(/\s+/)[0];
  return first.length >= 2 ? first : null;
}

function greeting(profile: SequenceProfile): string {
  const f = firstName(profile);
  return f ? `Hi ${f},` : 'Hello,';
}

// ---------------------------------------------------------------------------
// Track and touch selection
// ---------------------------------------------------------------------------

/** Windows are in calendar days relative to pro_expires_at (positive = before expiry). */
const WINDOWS: Record<Track, Record<Touch, [number, number]>> = {
  active: { t1: [4, 6], t2: [-1, 0], t3: [-5, -3] },
  zero_calc: { t1: [4, 6], t2: [-1, 0], t3: [-5, -3] },
  winback: { t1: [5, 7], t2: [1, 2], t3: [-5, -3] },
};

export function isEligible(profile: SequenceProfile): boolean {
  if (!profile.proExpiresAt) return false;
  if (profile.tier && EXCLUDED_TIERS.has(profile.tier)) return false;
  if (profile.proEngagementType && EXCLUDED_ENGAGEMENT.has(profile.proEngagementType)) return false;
  // A paying subscription is a conversion, not a trial.
  if (profile.subscriptionStatus === 'active' || profile.subscriptionStatus === 'past_due') return false;
  return true;
}

export function pickTrack(profile: SequenceProfile, calculations: SequenceCalculation[]): Track {
  if ((profile.proEngagementType || '').toLowerCase().startsWith('winback')) return 'winback';
  return calculations.length === 0 ? 'zero_calc' : 'active';
}

/** Which touch, if any, is due today for this profile. */
export function touchDue(profile: SequenceProfile, track: Track, now: Date): Touch | null {
  if (!profile.proExpiresAt) return null;
  const d = daysUntil(profile.proExpiresAt, now);
  const w = WINDOWS[track];
  // Later touches take precedence so a late cron never sends T1 after expiry.
  for (const touch of ['t3', 't2', 't1'] as Touch[]) {
    const [lo, hi] = w[touch];
    if (d >= lo && d <= hi) return touch;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

function primaryCalc(calcs: SequenceCalculation[]): SequenceCalculation | null {
  if (calcs.length === 0) return null;
  // Most recent first; prefer one with an indication.
  const sorted = [...calcs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return sorted.find(c => c.indication) || sorted[0];
}

function deepLink(calc: SequenceCalculation | null): string {
  if (!calc) return `${BASE_URL}/calculator`;
  const params = new URLSearchParams();
  if (calc.therapeuticArea) params.set('therapeuticArea', calc.therapeuticArea);
  if (calc.modality) params.set('modality', calc.modality);
  const q = params.toString();
  return q ? `${BASE_URL}/calculator?${q}` : `${BASE_URL}/calculator`;
}

/** The one exact fact. A verified comp with a disclosed upfront beats a count. */
function factSentence(ctx: SequenceContext, calc: SequenceCalculation): string {
  const ind = indicationLabel(calc.indication);
  const comp = ctx.comps
    .filter(c => c.upfrontUsd && c.upfrontUsd > 0)
    .sort((a, b) => (Number(!!b.verified) - Number(!!a.verified)) || (b.announcedDate || '').localeCompare(a.announcedDate || ''))[0];
  if (comp) {
    const up = formatMoney(comp.upfrontUsd);
    const tdv = formatMoney(comp.totalDealValueUsd);
    const tail = tdv && tdv !== up ? ` and ${tdv} total` : '';
    const scope = ctx.compsScope === 'ta' ? taLabel(calc.therapeuticArea) : ind;
    const isAcquisition = /acqui/i.test(String(comp.phaseAtSigning || ''));
    const deal = isAcquisition
      ? `${possessive(comp.licenseeName)} acquisition of ${comp.licensorName}${comp.assetName ? ` for ${comp.assetName}` : ''}`
      : `${possessive(comp.licensorName)} ${comp.assetName ? `${comp.assetName} ` : ''}licence to ${comp.licenseeName}`;
    return `The most recent disclosed ${scope} comp is ${deal} at ${up} upfront${tail}.`;
  }
  const n = ctx.indicationDealCount ?? 0;
  if (n > 0) {
    return `${capitalize(ind)} has ${n} deals with disclosed terms in the set you were working from.`;
  }
  return `${capitalize(ind)} has no disclosed licence with terms in the last decade, so the ${phaseLabel(calc.phase)} range prices off adjacent indications.`;
}

/** One interpretation sentence, by stage. */
function stageSentence(calc: SequenceCalculation): string {
  const ph = calc.phase || '';
  const mod = modalityLabel(calc.modality);
  if (ph === 'discovery' || ph === 'preclinical') {
    return `At ${phaseLabel(ph)} the number a buyer quotes is usually the Phase 1 or Phase 2 comp, and the gap between that and what ${mod} programs actually fetch at this stage is the whole negotiation.`;
  }
  if (ph === 'phase1' || ph === 'phase1_2') {
    return `Phase 1 with human data and preclinical without it price very differently, and buyers will quote whichever helps them.`;
  }
  if (ph === 'phase2' || ph === 'phase2_3') {
    return `Phase 2 is where the licence-versus-sale question gets decided, and the gap between the two has never been wider.`;
  }
  return `Late-stage terms pull toward regulatory and commercial milestones rather than upfront, and the territory split usually decides the structure.`;
}

/** True when the fact sentence will cite a named comp rather than a fallback. */
function hasNamedComp(ctx: SequenceContext): boolean {
  return ctx.comps.some(c => c.upfrontUsd != null && c.upfrontUsd > 0);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function priceLine(ctx: SequenceContext, lead: string): string {
  const base = `${lead} $299 a month or $199 a month billed annually`;
  if (ctx.offers.terrainAccess && ctx.profile.proExpiresAt) {
    return `${base}, and anyone on Pro by ${shortDate(ctx.profile.proExpiresAt)} gets 60 days of Terrain, our market intelligence platform, free when it launches in October.`;
  }
  return `${base}.`;
}

function searchModuleLine(ctx: SequenceContext, calc: SequenceCalculation | null): string {
  if (!ctx.offers.searchModule) return '';
  // Only for people who look for assets rather than sell one: co-development and acquisition runs.
  const buyerSide = calc?.dealType === 'acquisition' || calc?.dealType === 'codevelopment';
  if (!buyerSide) return '';
  return `\n\nThe Search and Evaluation module, which screens partnering-ready assets against a thesis, releases this month and is included in Pro.`;
}

// ---- active -----------------------------------------------------------------

function activeT1(ctx: SequenceContext, calc: SequenceCalculation): SequenceEmail {
  const ind = indicationLabel(calc.indication);
  const cta = deepLink(calc);
  const subject = hasNamedComp(ctx)
    ? `${ind} ${phaseLabel(calc.phase)}, the comp that matters`
    : `${ind} ${phaseLabel(calc.phase)}: what buyers actually quote`;
  const text = [
    greeting(ctx.profile),
    '',
    `${factSentence(ctx, calc)} ${stageSentence(calc)}`,
    '',
    `Your trial runs through ${weekdayOf(ctx.profile.proExpiresAt!)}. Pick the ${ind} scenario back up here:`,
    '',
    cta,
    '',
    priceLine(ctx, 'Pro afterwards is') + searchModuleLine(ctx, calc),
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'active', touch: 't1', subject, text, cta };
}

function activeT2(ctx: SequenceContext, calc: SequenceCalculation): SequenceEmail {
  const ind = indicationLabel(calc.indication);
  const subject = `re: ${activeT1(ctx, calc).subject}`;
  const terrain = ctx.offers.terrainAccess ? ', and locks in 60 days of Terrain free at its October launch' : '';
  const text = [
    greeting(ctx.profile),
    '',
    `Trial closes today. Your ${ind} scenarios stay in the workspace. Pro at $199 a month on the annual plan keeps them running${terrain}:`,
    '',
    PRICING_URL,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'active', touch: 't2', subject, text, cta: PRICING_URL };
}

function activeT3(ctx: SequenceContext, calc: SequenceCalculation): SequenceEmail {
  const ind = indicationLabel(calc.indication);
  const subject = `your ${ind} scenarios are still there`;
  const text = [
    greeting(ctx.profile),
    '',
    `Everything you built is intact. When the ${ind} program moves toward a real decision, Pro is $299 a month or $199 billed annually, and the scenarios pick up where you left them.`,
    '',
    PRICING_URL,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'active', touch: 't3', subject, text, cta: PRICING_URL };
}

// ---- zero_calc --------------------------------------------------------------

function zeroT1(ctx: SequenceContext): SequenceEmail {
  const subject = 'let me build your first benchmark';
  const cta = `${BASE_URL}/calculator`;
  const text = [
    greeting(ctx.profile),
    '',
    `You set up a Solidus trial and have not run a benchmark yet. That usually means the asset sits between two phases or the modality does not map cleanly, and both take about two minutes to sort out.`,
    '',
    `Reply with the indication, the stage and the modality and I will build the first benchmark for you, comp set with named deals and disclosed terms included, and send you the link. Or start it yourself here:`,
    '',
    cta,
    '',
    `Your trial ends ${weekdayOf(ctx.profile.proExpiresAt!)}.`,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'zero_calc', touch: 't1', subject, text, cta };
}

function zeroT2(ctx: SequenceContext): SequenceEmail {
  const subject = 're: let me build your first benchmark';
  const cta = `${BASE_URL}/calculator`;
  const text = [
    greeting(ctx.profile),
    '',
    `Trial closes today. The offer stands: send me the program and I will build the benchmark, or run it here before the day is out.`,
    '',
    cta,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'zero_calc', touch: 't2', subject, text, cta };
}

function zeroT3(ctx: SequenceContext): SequenceEmail {
  const subject = 'your workspace is still there';
  const text = [
    greeting(ctx.profile),
    '',
    priceLine(ctx, 'Your Solidus workspace is intact. Whenever there is a live program to benchmark, Pro is'),
    '',
    PRICING_URL,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'zero_calc', touch: 't3', subject, text, cta: PRICING_URL };
}

// ---- winback ----------------------------------------------------------------

function winbackT1(ctx: SequenceContext, calc: SequenceCalculation | null): SequenceEmail {
  const cta = deepLink(calc);
  if (!calc) {
    const subject = 'your Solidus trial, second attempt';
    const text = [
      greeting(ctx.profile),
      '',
      `You activated a Solidus trial and did not get as far as running a benchmark before it lapsed. I would rather fix that than let it sit.`,
      '',
      `If there is an asset you are evaluating, reply with the indication, the stage and the modality. I will build the first benchmark for you, comp set with named deals and disclosed terms included, and send you the link.`,
      '',
      `I have reopened Pro on your account for seven days, no card, so you can explore from there:`,
      '',
      cta,
      '',
      SIGNATURE,
    ].join('\n');
    return { track: 'winback', touch: 't1', subject, text, cta };
  }
  const ind = indicationLabel(calc.indication);
  const since = monthOf(calc.createdAt);
  const subject = hasNamedComp(ctx)
    ? `${ind} terms have moved since ${since}`
    : `${ind}: what buyers actually quote`;
  const text = [
    greeting(ctx.profile),
    '',
    `${factSentence(ctx, calc)} ${stageSentence(calc)}`,
    '',
    `I have reopened Pro on your account for seven days, no card. ${ctx.comps.length > 0 ? `The ${ind} set has grown since ${since} and partner` : 'Partner'} matching now shows buyer intent, so it is worth a second look:`,
    '',
    cta,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'winback', touch: 't1', subject, text, cta };
}

function winbackT2(ctx: SequenceContext, calc: SequenceCalculation | null): SequenceEmail {
  const cta = deepLink(calc);
  const ind = calc ? indicationLabel(calc.indication) : null;
  const subject = `re: ${winbackT1(ctx, calc).subject}`;
  const text = [
    greeting(ctx.profile),
    '',
    `Your reopened Pro window closes ${weekdayOf(ctx.profile.proExpiresAt!)}. ${ind ? `Worth rerunning the ${ind} benchmark this week.` : 'The offer to build the first benchmark stands; just send me the program.'}`,
    '',
    cta,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'winback', touch: 't2', subject, text, cta };
}

function winbackT3(ctx: SequenceContext, calc: SequenceCalculation | null): SequenceEmail {
  const ind = calc ? indicationLabel(calc.indication) : null;
  const subject = ind ? `your ${ind} benchmark is still there` : 'whenever there is a program';
  const text = [
    greeting(ctx.profile),
    '',
    priceLine(ctx, `${ind ? 'Everything you built is intact.' : 'Your workspace is intact.'} Whenever the ${ind ? 'program' : 'asset'} needs a current range, Pro is`),
    '',
    PRICING_URL,
    '',
    SIGNATURE,
  ].join('\n');
  return { track: 'winback', touch: 't3', subject, text, cta: PRICING_URL };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildTouch(track: Track, touch: Touch, ctx: SequenceContext): SequenceEmail {
  const calc = primaryCalc(ctx.calculations);
  if (track === 'winback') {
    return touch === 't1' ? winbackT1(ctx, calc) : touch === 't2' ? winbackT2(ctx, calc) : winbackT3(ctx, calc);
  }
  if (track === 'zero_calc' || !calc) {
    return touch === 't1' ? zeroT1(ctx) : touch === 't2' ? zeroT2(ctx) : zeroT3(ctx);
  }
  return touch === 't1' ? activeT1(ctx, calc) : touch === 't2' ? activeT2(ctx, calc) : activeT3(ctx, calc);
}

/** Decide today's email for a profile, or null when nothing is due. */
export function planForToday(ctx: SequenceContext): SequenceEmail | null {
  if (!isEligible(ctx.profile)) return null;
  const track = pickTrack(ctx.profile, ctx.calculations);
  const touch = touchDue(ctx.profile, track, ctx.now);
  if (!touch) return null;
  return buildTouch(track, touch, ctx);
}

export function eventTypeFor(touch: Touch): string {
  return `trial_seq_${touch}`;
}

/** Minimal HTML wrapper so a plain-text email renders identically in HTML clients. */
export function textToHtml(text: string): string {
  // The plain-text body is the source of truth and carries raw URLs (a raw
  // "&" between query parameters). Only the HTML twin is entity-escaped, and
  // the anchor href is escaped separately so it round-trips to the raw URL.
  const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const esc = text
    .split(/(https?:\/\/[^\s]+)/g)
    .map((part, i) => (i % 2 === 1 ? `<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>` : escapeHtml(part)))
    .join('');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;white-space:pre-wrap">${esc}</div>`;
}

/**
 * Lint an email against the copy rules. Returns a list of violations; empty
 * means compliant. Used by tests and by the cron before sending.
 */
export function lintEmail(email: SequenceEmail): string[] {
  const out: string[] = [];
  const lower = `${email.subject}\n${email.text}`.toLowerCase();
  for (const p of BANNED_PHRASES) if (lower.includes(p)) out.push(`banned phrase: ${p}`);
  const words = email.subject.trim().split(/\s+/).length;
  if (words < 4 || words > 9) out.push(`subject has ${words} words (want 4-9)`);
  if (/\$\d/.test(email.subject)) out.push('price in subject');
  const urls = email.text.match(/https?:\/\/\S+/g) || [];
  if (email.touch === 't2' && urls.length !== 1) out.push(`t2 has ${urls.length} URLs (want exactly 1)`);
  if (urls.length < 1) out.push('no CTA URL');
  const price299 = (email.text.match(/\$299/g) || []).length;
  const price199 = (email.text.match(/\$199/g) || []).length;
  if (price299 > 1 || price199 > 1) out.push('price mentioned more than once');
  // Usage counts read as surveillance: "you opened four times", "13 sessions", "you ran 8".
  if (/\b(you (opened|ran|logged in)|\d+ (sessions?|times|runs|logins?))\b/i.test(email.text)) out.push('usage count in body');
  if (/\b(eleven|thirteen|four|three|two|five|six|seven|eight|nine|ten) (sessions|times)\b/i.test(email.text)) out.push('usage count in body (words)');
  // The text alternative must never carry HTML entities: "&amp;" inside a
  // deep link drops the second query parameter for every recipient.
  if (/&(amp|lt|gt|quot|#\d+);/.test(email.text)) out.push('html entity in plain-text body');
  for (const u of urls) {
    try {
      new URL(u);
    } catch {
      out.push(`unparseable URL: ${u}`);
    }
  }
  return out;
}
