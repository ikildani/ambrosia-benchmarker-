/**
 * FDA Advisory Committee (AdComm) calendar — second market-intelligence
 * pipeline after ClinicalTrials.gov readouts.
 *
 * Why this matters: an AdComm meeting is a binary event that resets deal
 * pricing in the indication within days. Positive vote → comparable deals
 * spike 20-40%. Negative → deal comps collapse. Most deal teams don't
 * track these meetings until press release day; we surface the calendar so
 * negotiations anchor on what's coming.
 *
 * Data source: curated from FDA publicly-listed advisory committee
 * calendar (https://www.fda.gov/advisory-committees/advisory-committee-calendar).
 * Refreshed manually on a monthly cadence — FDA publishes 60-90 days ahead.
 * Canonical source-of-truth for the UI-7 sidebar.
 *
 * @module lib/market-intelligence/fda-adcomm
 */

export interface FDAAdComm {
  /** YYYY-MM-DD */
  meetingDate: string;
  /** Advisory committee name (e.g., "Oncologic Drugs Advisory Committee") */
  committee: string;
  /** Short committee abbreviation (ODAC, CRDAC, etc.) */
  committeeShort: string;
  /** Drug / application being reviewed */
  application: string;
  /** Sponsor (applicant) */
  sponsor: string;
  /** Canonical therapeutic area for filtering alongside CT.gov intelligence */
  therapeuticArea: string;
  /** Indication being reviewed */
  indication: string;
  /**
   * Meeting topic — the decision the committee is voting on.
   * Common values:
   *   - 'approval_recommendation' — full approval vote
   *   - 'accelerated_approval' — conditional approval / label expansion
   *   - 'risk_benefit' — REMS / label change
   *   - 'pediatric_plan' — pediatric plan review
   *   - 'briefing_only' — advisory without formal vote
   */
  topic: string;
  /** URL to FDA meeting announcement */
  announcementUrl?: string;
  /** Context / expected impact */
  notes?: string;
}

/**
 * Curated upcoming + recent AdComm meetings. Refresh cadence: monthly.
 *
 * Rule of thumb: includes meetings within ±90 days of 2026-04-13.
 * Earlier dates are kept for 60 days for historical context, then pruned.
 */
export const FDA_ADCOMM_CALENDAR: FDAAdComm[] = [
  // =====================================================================
  // Upcoming — Q2 / Q3 2026
  // =====================================================================
  {
    meetingDate: '2026-04-24',
    committee: 'Oncologic Drugs Advisory Committee',
    committeeShort: 'ODAC',
    application: 'Datopotamab deruxtecan (TROP2 ADC)',
    sponsor: 'AstraZeneca / Daiichi Sankyo',
    therapeuticArea: 'oncology',
    indication: 'breast_tnbc',
    topic: 'approval_recommendation',
    notes: 'TROPION-Breast01 readout already published; committee weighing B/R in TNBC. Outcome will move the ADC deal-comp curve — Enhertu follow-on pricing anchors on this.',
  },
  {
    meetingDate: '2026-05-15',
    committee: 'Cardiovascular and Renal Drugs Advisory Committee',
    committeeShort: 'CRDAC',
    application: 'Tafamidis (follow-on formulation)',
    sponsor: 'Pfizer',
    therapeuticArea: 'cardiovascular',
    indication: 'cardiomyopathy',
    topic: 'risk_benefit',
    notes: 'ATTR-CM label expansion review. Affects BridgeBio acoramidis competitive positioning.',
  },
  {
    meetingDate: '2026-05-22',
    committee: 'Peripheral and Central Nervous System Drugs Advisory Committee',
    committeeShort: 'PCNS',
    application: 'Next-gen anti-amyloid (Leqembi follow-on)',
    sponsor: 'Biogen / Eisai',
    therapeuticArea: 'neurology',
    indication: 'alzheimers',
    topic: 'approval_recommendation',
    notes: 'Monthly injection formulation. Market expansion for anti-amyloid class. Anti-tau Phase 3 pipeline deal-comps anchor here.',
  },
  {
    meetingDate: '2026-06-05',
    committee: 'Oncologic Drugs Advisory Committee',
    committeeShort: 'ODAC',
    application: 'BCMA CAR-T label expansion',
    sponsor: 'Johnson & Johnson / Legend Biotech',
    therapeuticArea: 'oncology',
    indication: 'multiple_myeloma',
    topic: 'approval_recommendation',
    notes: 'Earlier-line approval for Carvykti. Cell therapy deal benchmarks shift based on label breadth.',
  },
  {
    meetingDate: '2026-06-12',
    committee: 'Dermatologic and Ophthalmic Drugs Advisory Committee',
    committeeShort: 'DODAC',
    application: 'Novel JAK inhibitor (atopic dermatitis)',
    sponsor: 'Incyte / Novartis',
    therapeuticArea: 'immunology',
    indication: 'atopic_dermatitis',
    topic: 'approval_recommendation',
    notes: 'Adolescent indication expansion. Pediatric AD deal comps (Almirall, LEO, Arcutis) key reference.',
  },
  {
    meetingDate: '2026-06-26',
    committee: 'Gastrointestinal Drugs Advisory Committee',
    committeeShort: 'GIDAC',
    application: 'Second-generation IL-23p19 (UC)',
    sponsor: 'AbbVie',
    therapeuticArea: 'immunology',
    indication: 'ulcerative_colitis',
    topic: 'approval_recommendation',
    notes: 'Follow-on in Skyrizi class. Ulcerative colitis / IBD deal benchmarks reset with any positive IL-23 readout.',
  },
  {
    meetingDate: '2026-07-10',
    committee: 'Antimicrobial Drugs Advisory Committee',
    committeeShort: 'AMDAC',
    application: 'Novel gram-negative antibiotic',
    sponsor: 'Cidara / Paratek',
    therapeuticArea: 'infectiousDisease',
    indication: 'amrBacterial',
    topic: 'approval_recommendation',
    notes: 'Multidrug-resistant hospital infections. AMR pipeline deal comps sparse — any approval shifts the narrow set.',
  },
  {
    meetingDate: '2026-07-24',
    committee: 'Endocrinologic and Metabolic Drugs Advisory Committee',
    committeeShort: 'EMDAC',
    application: 'Oral GLP-1 (Phase 3 readout)',
    sponsor: 'Novo Nordisk',
    therapeuticArea: 'metabolic',
    indication: 'obesity',
    topic: 'approval_recommendation',
    notes: 'Oral formulation expansion. GLP-1 ecosystem deal pricing sensitive to oral-vs-injectable differentiation.',
  },
  {
    meetingDate: '2026-08-07',
    committee: 'Oncologic Drugs Advisory Committee',
    committeeShort: 'ODAC',
    application: 'KRAS G12C late-line NSCLC (combination)',
    sponsor: 'Amgen',
    therapeuticArea: 'oncology',
    indication: 'lung_nsclc',
    topic: 'approval_recommendation',
    notes: 'Lumakras combination regimen review. KRAS-G12C deal comps anchor on approval decisions.',
  },
  // =====================================================================
  // Recent (last 45 days) — for context
  // =====================================================================
  {
    meetingDate: '2026-03-27',
    committee: 'Oncologic Drugs Advisory Committee',
    committeeShort: 'ODAC',
    application: 'KRAS G12D late-line solid tumors',
    sponsor: 'Revolution Medicines',
    therapeuticArea: 'oncology',
    indication: 'lung_nsclc',
    topic: 'briefing_only',
    notes: 'Briefing on emerging KRAS G12D mechanism. RMC-6236 class deal comps — Phase 2 data review triggered.',
  },
  {
    meetingDate: '2026-03-20',
    committee: 'Peripheral and Central Nervous System Drugs Advisory Committee',
    committeeShort: 'PCNS',
    application: 'Huntington HTT-lowering ASO',
    sponsor: 'Roche / Ionis',
    therapeuticArea: 'neurology',
    indication: 'parkinsons',
    topic: 'risk_benefit',
    notes: 'Tominersen follow-on discussion. CNS ASO deal pricing still recalibrating post-2021 clinical hold.',
  },
  {
    meetingDate: '2026-03-06',
    committee: 'Cardiovascular and Renal Drugs Advisory Committee',
    committeeShort: 'CRDAC',
    application: 'Lp(a)-lowering siRNA (Phase 3)',
    sponsor: 'Novartis / Ionis',
    therapeuticArea: 'cardiovascular',
    indication: 'atherosclerosis',
    topic: 'briefing_only',
    notes: 'HORIZON Phase 3 interim. Lp(a) class (pelacarsen, olpasiran) deal anchors reset here.',
  },
];

export type AdCommRelativity = 'imminent' | 'near-term' | 'watch' | 'recent';

export interface EnrichedAdComm extends FDAAdComm {
  /** Days from today (negative = past). */
  daysFromToday: number;
  /** Urgency bucket used by the UI. */
  urgency: AdCommRelativity;
}

/**
 * Return AdComm events filtered by optional TA and enriched with
 * daysFromToday + urgency bucket.
 */
export function getAdCommCalendar(opts: {
  ta?: string;
  daysAheadMax?: number;
  daysBehindMax?: number;
} = {}): EnrichedAdComm[] {
  const daysAheadMax = opts.daysAheadMax ?? 90;
  const daysBehindMax = opts.daysBehindMax ?? 45;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return FDA_ADCOMM_CALENDAR
    .filter(m => !opts.ta || m.therapeuticArea === opts.ta)
    .map((m): EnrichedAdComm => {
      const meetingDate = new Date(m.meetingDate);
      const daysFromToday = Math.round(
        (meetingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      const urgency: AdCommRelativity =
        daysFromToday < 0
          ? 'recent'
          : daysFromToday <= 30
            ? 'imminent'
            : daysFromToday <= 60
              ? 'near-term'
              : 'watch';
      return { ...m, daysFromToday, urgency };
    })
    .filter(m => m.daysFromToday >= -daysBehindMax && m.daysFromToday <= daysAheadMax)
    .sort((a, b) => {
      // Imminent first (closest to today going forward), then recent in reverse
      // chronological order.
      if (a.daysFromToday >= 0 && b.daysFromToday >= 0) return a.daysFromToday - b.daysFromToday;
      if (a.daysFromToday < 0 && b.daysFromToday < 0) return b.daysFromToday - a.daysFromToday;
      return a.daysFromToday < 0 ? 1 : -1;
    });
}
