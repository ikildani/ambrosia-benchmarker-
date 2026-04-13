/**
 * ClinicalTrials.gov v2 API client for upcoming trial readouts.
 *
 * Pulls the next 90 days of pivotal Phase 3 / Phase 2/3 trial primary
 * completion dates for the indications we care about. This is the data
 * spine of the market-intelligence sidebar — when a trial completes, a
 * readout follows in 1-3 months and either confirms or kills a deal-
 * pricing thesis.
 *
 * API: https://clinicaltrials.gov/api/v2/studies (no auth required)
 * Docs: https://clinicaltrials.gov/data-api/api
 *
 * @module lib/market-intelligence/ct-gov-events
 */

export interface UpcomingReadout {
  /** ClinicalTrials.gov NCT number */
  nctId: string;
  /** Trial title */
  title: string;
  /** Lead sponsor (drug developer) */
  sponsor: string;
  /** Therapeutic area, derived from condition + indication mapping */
  therapeuticArea?: string;
  /** Cleaned condition list (e.g., "Atopic Dermatitis") */
  conditions: string[];
  /** Phase: PHASE2, PHASE3, etc. */
  phase: string;
  /** Primary completion date — when the readout is expected */
  primaryCompletionDate: string;
  /** Days from today to primaryCompletionDate (negative = past, future = positive) */
  daysToReadout: number;
  /** Enrollment count (proxy for trial size / readout impact) */
  enrollment: number | null;
  /** URL to the public study record */
  studyUrl: string;
  /** Intervention name (drug being tested) */
  intervention: string | null;
}

/** Conditions to monitor. Maps loose query terms to canonical TA labels. */
const TA_QUERIES: Array<{ ta: string; query: string }> = [
  { ta: 'oncology', query: 'cancer OR tumor OR carcinoma OR leukemia OR lymphoma' },
  { ta: 'neurology', query: 'Alzheimer OR Parkinson OR multiple sclerosis OR ALS' },
  { ta: 'immunology', query: 'atopic dermatitis OR psoriasis OR rheumatoid arthritis OR ulcerative colitis' },
  { ta: 'metabolic', query: 'obesity OR type 2 diabetes OR NASH OR MASH' },
  { ta: 'cardiovascular', query: 'heart failure OR hypertension OR atherosclerosis' },
  { ta: 'rareDisease', query: 'cystic fibrosis OR Duchenne OR spinal muscular atrophy OR sickle cell' },
];

interface CTGStudyResponse {
  studies: Array<{
    protocolSection?: {
      identificationModule?: { nctId?: string; briefTitle?: string };
      sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
      conditionsModule?: { conditions?: string[] };
      designModule?: {
        phases?: string[];
        enrollmentInfo?: { count?: number };
      };
      statusModule?: {
        primaryCompletionDateStruct?: { date?: string };
        overallStatus?: string;
      };
      armsInterventionsModule?: {
        interventions?: Array<{ name?: string; type?: string }>;
      };
    };
  }>;
}

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

/**
 * Fetch the next N upcoming readouts for a given TA + phase filter.
 * Excludes terminated, withdrawn, suspended trials.
 */
export async function fetchUpcomingReadouts(opts: {
  ta?: string;
  phase?: 'PHASE2' | 'PHASE3' | 'PHASE2_3';
  limit?: number;
  daysAhead?: number;
}): Promise<UpcomingReadout[]> {
  const limit = opts.limit ?? 10;
  const daysAhead = opts.daysAhead ?? 90;
  const today = new Date();
  const future = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const todayIso = today.toISOString().slice(0, 10);
  const futureIso = future.toISOString().slice(0, 10);

  const taConfig = opts.ta ? TA_QUERIES.find(t => t.ta === opts.ta) : null;
  const conditionQuery = taConfig?.query ?? '';
  const phaseFilter = opts.phase ?? 'PHASE3';

  const params = new URLSearchParams({
    'format': 'json',
    'pageSize': String(Math.min(limit * 4, 200)), // overfetch — many will be filtered
    'fields': [
      'NCTId',
      'BriefTitle',
      'LeadSponsorName',
      'Condition',
      'Phase',
      'PrimaryCompletionDate',
      'EnrollmentCount',
      'OverallStatus',
      'InterventionName',
      'InterventionType',
    ].join(','),
    'filter.advanced': [
      `AREA[OverallStatus](RECRUITING OR ACTIVE_NOT_RECRUITING)`,
      `AREA[Phase]${phaseFilter}`,
      `AREA[PrimaryCompletionDate]RANGE[${todayIso},${futureIso}]`,
      conditionQuery ? `AREA[Condition](${conditionQuery})` : '',
    ].filter(Boolean).join(' AND '),
    'sort': 'PrimaryCompletionDate:asc',
  });

  const url = `${BASE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // cache 1h — readout dates don't shift hourly
    });
    if (!res.ok) return [];
    const data = await res.json() as CTGStudyResponse;
    const studies = data.studies || [];

    const events: UpcomingReadout[] = studies
      .map(s => parseStudy(s, opts.ta))
      .filter((e): e is UpcomingReadout => e !== null)
      .filter(e => e.daysToReadout >= 0 && e.daysToReadout <= daysAhead)
      .sort((a, b) => a.daysToReadout - b.daysToReadout)
      .slice(0, limit);

    return events;
  } catch {
    return [];
  }
}

function parseStudy(study: CTGStudyResponse['studies'][number], ta?: string): UpcomingReadout | null {
  const ps = study.protocolSection;
  if (!ps) return null;
  const nctId = ps.identificationModule?.nctId;
  const title = ps.identificationModule?.briefTitle;
  const sponsor = ps.sponsorCollaboratorsModule?.leadSponsor?.name;
  const conditions = ps.conditionsModule?.conditions || [];
  const phaseList = ps.designModule?.phases || [];
  const enrollment = ps.designModule?.enrollmentInfo?.count ?? null;
  const completion = ps.statusModule?.primaryCompletionDateStruct?.date;
  const interventions = ps.armsInterventionsModule?.interventions || [];

  if (!nctId || !title || !completion) return null;

  // Find first DRUG or BIOLOGICAL intervention
  const drug = interventions.find(i =>
    i.type === 'DRUG' || i.type === 'BIOLOGICAL' || i.type === 'GENETIC'
  );

  // Compute daysToReadout
  const completionDate = parseDate(completion);
  if (!completionDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysToReadout = Math.round(
    (completionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const phase = phaseList.length > 0 ? phaseList[0] : 'UNKNOWN';

  return {
    nctId,
    title,
    sponsor: sponsor || 'Unknown sponsor',
    therapeuticArea: ta,
    conditions,
    phase,
    primaryCompletionDate: completion,
    daysToReadout,
    enrollment,
    studyUrl: `https://clinicaltrials.gov/study/${nctId}`,
    intervention: drug?.name || null,
  };
}

/** Parse "YYYY-MM-DD" or "YYYY-MM" dates. */
function parseDate(s: string): Date | null {
  if (!s) return null;
  // CT.gov sometimes returns YYYY-MM (no day) — assume mid-month
  const normalized = s.length === 7 ? `${s}-15` : s;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** Returns supported TA query keys (for UI filter dropdown). */
export function getSupportedTAs(): string[] {
  return TA_QUERIES.map(t => t.ta);
}
