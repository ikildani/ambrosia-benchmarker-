'use client';

import { useMemo } from 'react';
import { Lock, Shield, ChevronRight, ClipboardCheck } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssetReadinessScoreProps {
  dataQuality: string;
  competitivePosition: string;
  biomarkerStatus: string;
  phase: string;
  regulatoryDesignations: {
    breakthrough: boolean;
    fastTrack: boolean;
    orphan: boolean;
    prime: boolean;
  };
  tier: string;
  dealType?: string;
  modality?: string;
  onUpgrade?: () => void;
  onBuyReport?: () => void;
}

// ---------------------------------------------------------------------------
// Scoring maps
// ---------------------------------------------------------------------------

const DATA_QUALITY_SCORES: Record<string, number> = {
  pivotalReady: 100,
  strongPhase2: 80,
  promising: 55,
  mixed: 30,
  limited: 10,
};

const COMPETITIVE_POSITION_SCORES: Record<string, number> = {
  firstInClass: 100,
  firstToPivotal: 90,
  bestInClass: 85,
  racing: 50,
  behind: 25,
  crowded: 10,
};

const BIOMARKER_STATUS_SCORES: Record<string, number> = {
  validated: 100,
  exploratory: 50,
  unselected: 20,
  none: 10,
};

const PHASE_SCORES: Record<string, number> = {
  approved: 100,
  phase3: 80,
  phase2_3: 70,
  phase2: 55,
  phase1_2: 40,
  phase1: 30,
  preclinical: 10,
};

// ---------------------------------------------------------------------------
// Deal-type specific scoring (acquisition only)
// ---------------------------------------------------------------------------

// Earlier stage assets imply more pipeline-adjacent optionality for an
// acquirer (the company isn't betting everything on a single pivotal readout).
// Later-stage assets are typically more "lead asset" concentrated.
const PIPELINE_DEPTH_PROXY_SCORES: Record<string, number> = {
  preclinical: 85,
  phase1: 80,
  phase1_2: 75,
  phase2: 65,
  phase2_3: 55,
  phase3: 45,
  approved: 40,
};

// Platform modalities (gene therapy, ADC, CAR-T, mRNA, etc.) carry outsized
// acquisition appeal because they unlock future programs. Single-asset
// small molecules score lower.
const MODALITY_PLATFORM_SCORES: Record<string, number> = {
  geneTherapy: 95,
  gene_therapy: 95,
  cellTherapy: 95,
  cell_therapy: 95,
  carT: 95,
  car_t: 95,
  adc: 90,
  mRNA: 90,
  mrna: 90,
  rnai: 85,
  antisense: 80,
  bispecific: 80,
  proteinDegrader: 80,
  protein_degrader: 80,
  peptide: 55,
  biologic: 65,
  antibody: 65,
  smallMolecule: 40,
  small_molecule: 40,
  vaccine: 70,
};

// ---------------------------------------------------------------------------
// Additional considerations (non-scored checklist items)
// ---------------------------------------------------------------------------

interface ConsiderationItem {
  title: string;
  detail: string;
}

const ACQUISITION_CONSIDERATIONS: ConsiderationItem[] = [
  {
    title: 'Cap table cleanliness',
    detail: 'Single founder or tight investor group is easier to close than a fragmented cap table with dozens of SAFEs or note holders.',
  },
  {
    title: 'IP ownership',
    detail: 'Confirm IP is fully owned — no upstream university licenses, no third-party royalty stacks, no co-ownership disputes.',
  },
  {
    title: 'Management retention plan',
    detail: 'Acquirers typically require founder/key scientist retention packages (1–3 year vesting, earnouts, or advisory roles).',
  },
  {
    title: 'Manufacturing transferability',
    detail: 'In-house GMP manufacturing is a premium asset; heavy CMO dependence raises transfer risk and diligence cost.',
  },
  {
    title: 'Tax structure',
    detail: 'Delaware C-corp with clean 83(b) elections is the preferred structure. LLC or foreign entities add deal friction.',
  },
  {
    title: 'Employee retention risk',
    detail: 'Identify flight-risk key employees and plan stay bonuses. Acquirers will ask for a "key person" analysis in diligence.',
  },
  {
    title: 'Pipeline depth & platform value',
    detail: 'Acquirers pay premium for platforms (multiple shots on goal). A single lead asset caps the strategic multiple.',
  },
];

const CODEVELOPMENT_CONSIDERATIONS: ConsiderationItem[] = [
  {
    title: 'Complementary capabilities',
    detail: 'Map which functions each party brings (discovery, clinical ops, manufacturing, commercial) — overlaps create friction.',
  },
  {
    title: 'Geographic split potential',
    detail: 'Decide early whether to split territories (US/ex-US) or co-promote globally. Geographic splits simplify governance.',
  },
  {
    title: 'Cost-sharing infrastructure',
    detail: 'Both parties need systems to track and reconcile shared R&D spend — typically 50/50 or 60/40 with true-ups.',
  },
  {
    title: 'Joint steering committee experience',
    detail: 'JSC governance requires clear escalation paths, dispute resolution, and decision rights (especially on go/no-go).',
  },
  {
    title: 'Comparable deal alignment',
    detail: 'Benchmark against structurally similar co-dev deals (not straight licensing comps) — profit splits are the key term.',
  },
];

const OPTION_CONSIDERATIONS: ConsiderationItem[] = [
  {
    title: 'Clear exercise trigger event',
    detail: 'Define exactly what data event triggers the option exercise — Phase 1b readout, Phase 2a interim, biomarker validation. Vague triggers create disputes.',
  },
  {
    title: 'Data inflection point within 24-month window',
    detail: 'Option deals fail when the trigger data slips outside the window. Confirm trial enrollment and readout timelines are realistic.',
  },
  {
    title: 'Capital runway sufficient to reach trigger',
    detail: 'If you run out of cash before the option exercise event, the deal collapses. Need 18+ months of runway from option signing to data readout.',
  },
  {
    title: 'Regulatory pathway clarified',
    detail: 'Breakthrough/Fast Track designations make option deals more valuable because they accelerate the data timeline and de-risk regulatory.',
  },
  {
    title: 'Exit timing aligned with licensee evaluation',
    detail: 'Licensee needs time to evaluate and exercise. Build 60-90 day decision window into the exercise mechanic.',
  },
];

const COLLABORATION_CONSIDERATIONS: ConsiderationItem[] = [
  {
    title: 'Complementary capabilities',
    detail: 'Collaborations work when each party brings something the other lacks (discovery platform, target ID, biology expertise, validation infrastructure).',
  },
  {
    title: 'FTE allocation capacity',
    detail: 'Collaborations typically fund 5-20 FTEs. Confirm the licensor has team capacity and the right people aren\'t already over-committed.',
  },
  {
    title: 'JSC governance experience',
    detail: 'Joint steering committees need clear decision rights, escalation paths, and meeting cadence. Inexperienced teams burn cycles on process.',
  },
  {
    title: 'Cost-sharing financial infrastructure',
    detail: 'Collaborations require ongoing shared budgeting, milestone tracking, and reporting. Lightweight startups often lack the systems.',
  },
  {
    title: 'Joint IP allocation framework',
    detail: 'Collaborations generate shared IP. Define ownership rules upfront — background IP, foreground IP, and joint IP each need clear allocation.',
  },
  {
    title: 'Long-term research strategy alignment',
    detail: 'Collaborations are 3-5 year commitments. Confirm both parties\' research roadmaps align beyond the first milestone, not just the deal terms.',
  },
];

// ---------------------------------------------------------------------------
// Factor definitions
// ---------------------------------------------------------------------------

interface Factor {
  key: string;
  label: string;
  weight: number;
  score: number;
  color: string;
  bgColor: string;
}

// ---------------------------------------------------------------------------
// Score badge helper
// ---------------------------------------------------------------------------

function scoreBadge(score: number): { label: string; className: string } {
  if (score >= 80) {
    return {
      label: 'Partner-Ready',
      className: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/25',
    };
  }
  if (score >= 60) {
    return {
      label: 'Approaching Ready',
      className: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',
    };
  }
  if (score >= 40) {
    return {
      label: 'Needs Strengthening',
      className: 'bg-slate-100 dark:bg-slate-600/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/25',
    };
  }
  return {
    label: 'Early Stage',
    className: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25',
  };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  if (score >= 40) return 'text-slate-600 dark:text-slate-300';
  return 'text-red-600 dark:text-red-400';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500 dark:bg-green-400';
  if (score >= 60) return 'bg-amber-500 dark:bg-amber-400';
  if (score >= 40) return 'bg-slate-400 dark:bg-slate-500';
  return 'bg-red-500 dark:bg-red-400';
}

// ---------------------------------------------------------------------------
// Recommendation generator
// ---------------------------------------------------------------------------

function getRecommendation(factors: Factor[]): string {
  const sorted = [...factors].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];

  const recommendations: Record<string, string> = {
    dataQuality: 'Generate stronger clinical data through well-powered trials with clearly defined endpoints. Consider publishing interim results to build confidence.',
    competitivePosition: 'Differentiate from competitors through biomarker selection, novel endpoints, or first-to-file strategy in an underserved subpopulation.',
    biomarkerStatus: 'Invest in biomarker validation studies to demonstrate patient selection capability. Validated biomarkers can increase PoS by 15-25%.',
    phase: 'Advance development stage to de-risk the asset. Each phase transition significantly increases partner interest and deal valuation.',
    regulatoryDesignations: 'Pursue regulatory designations (Breakthrough, Fast Track, Orphan) to signal FDA engagement and accelerate review timelines.',
    pipelineDepth: 'Build pipeline depth beyond the lead asset. Acquirers pay strategic premiums for platforms with multiple shots on goal, not single-asset companies.',
    modalityPlatform: 'Emphasize platform extensibility. Even for a single-asset deal, articulating a clear "next 3 programs" roadmap materially lifts acquisition multiples.',
  };

  return recommendations[weakest.key] || 'Continue executing on your clinical development plan to strengthen the overall asset profile.';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssetReadinessScore({
  dataQuality,
  competitivePosition,
  biomarkerStatus,
  phase,
  regulatoryDesignations,
  tier,
  dealType,
  modality,
  onUpgrade,
  onBuyReport,
}: AssetReadinessScoreProps) {
  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const normalizedDealType = (dealType || 'licensing').toLowerCase();
  const isAcquisition = normalizedDealType === 'acquisition';
  const isCoDev = normalizedDealType === 'codevelopment' || normalizedDealType === 'co-development' || normalizedDealType === 'co_development';
  const isOption = normalizedDealType === 'option';
  const isCollaboration = normalizedDealType === 'collaboration';

  const readinessLabel = isAcquisition
    ? 'Acquisition readiness assessment'
    : isCoDev
      ? 'Co-development readiness assessment'
      : isOption
        ? 'Option deal readiness assessment'
        : isCollaboration
          ? 'Collaboration readiness assessment'
          : 'Partnering/licensing readiness assessment';

  const considerationsTitle = isAcquisition
    ? 'Additional considerations for acquisition'
    : isCoDev
      ? 'Additional considerations for co-development'
      : isOption
        ? 'Additional considerations for option deal'
        : isCollaboration
          ? 'Additional considerations for collaboration'
          : null;

  const considerations = isAcquisition
    ? ACQUISITION_CONSIDERATIONS
    : isCoDev
      ? CODEVELOPMENT_CONSIDERATIONS
      : isOption
        ? OPTION_CONSIDERATIONS
        : isCollaboration
          ? COLLABORATION_CONSIDERATIONS
          : [];

  const { overallScore, factors, badge, recommendation } = useMemo(() => {
    // Compute individual factor scores
    const dqScore = DATA_QUALITY_SCORES[dataQuality] ?? 30;
    const cpScore = COMPETITIVE_POSITION_SCORES[competitivePosition] ?? 50;
    const bmScore = BIOMARKER_STATUS_SCORES[biomarkerStatus] ?? 20;
    const phScore = PHASE_SCORES[phase] ?? 30;

    // Regulatory designations: each adds 25 points, capped at 100
    let regScore = 0;
    if (regulatoryDesignations.breakthrough) regScore += 25;
    if (regulatoryDesignations.fastTrack) regScore += 25;
    if (regulatoryDesignations.orphan) regScore += 25;
    if (regulatoryDesignations.prime) regScore += 25;
    regScore = Math.min(regScore, 100);

    const factorsList: Factor[] = [
      {
        key: 'dataQuality',
        label: 'Data Quality',
        weight: 30,
        score: dqScore,
        color: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-500 dark:bg-cyan-400',
      },
      {
        key: 'competitivePosition',
        label: 'Competitive Position',
        weight: 20,
        score: cpScore,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500 dark:bg-blue-400',
      },
      {
        key: 'biomarkerStatus',
        label: 'Biomarker Status',
        weight: 15,
        score: bmScore,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-500 dark:bg-indigo-400',
      },
      {
        key: 'phase',
        label: 'Development Phase',
        weight: 20,
        score: phScore,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500 dark:bg-purple-400',
      },
      {
        key: 'regulatoryDesignations',
        label: 'Regulatory Designations',
        weight: 15,
        score: regScore,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-500 dark:bg-teal-400',
      },
    ];

    // Acquisition-specific scored factors: pipeline depth proxy + modality platform value.
    // These are added on top of the licensing factors so acquisitions get a richer score.
    if (isAcquisition) {
      const pipelineDepthScore = PIPELINE_DEPTH_PROXY_SCORES[phase] ?? 50;
      const modalityKey = (modality || '').toString();
      const platformScore = MODALITY_PLATFORM_SCORES[modalityKey] ?? 50;

      factorsList.push(
        {
          key: 'pipelineDepth',
          label: 'Pipeline Depth (proxy)',
          weight: 10,
          score: pipelineDepthScore,
          color: 'text-fuchsia-600 dark:text-fuchsia-400',
          bgColor: 'bg-fuchsia-500 dark:bg-fuchsia-400',
        },
        {
          key: 'modalityPlatform',
          label: 'Modality Platform Value',
          weight: 10,
          score: platformScore,
          color: 'text-rose-600 dark:text-rose-400',
          bgColor: 'bg-rose-500 dark:bg-rose-400',
        },
      );
    }

    // Weighted average
    const totalWeight = factorsList.reduce((sum, f) => sum + f.weight, 0);
    const weighted = factorsList.reduce((sum, f) => sum + f.score * f.weight, 0);
    const overall = Math.round(weighted / totalWeight);

    return {
      overallScore: overall,
      factors: factorsList,
      badge: scoreBadge(overall),
      recommendation: getRecommendation(factorsList),
    };
  }, [dataQuality, competitivePosition, biomarkerStatus, phase, regulatoryDesignations, isAcquisition, modality]);

  // Find the weakest factor for the narrative
  const weakest = useMemo(() => {
    return [...factors].sort((a, b) => a.score - b.score)[0];
  }, [factors]);

  return (
    <div className="relative mt-6 sm:mt-8" role="region" aria-label="Asset Readiness Score">
      <div className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-400 p-[1px]">
        <div
          className={`rounded-[11px] bg-white dark:bg-slate-800 p-4 sm:p-5 lg:p-6 ${
            !hasAccess ? 'select-none' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-soft flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-navy-800 dark:text-white text-sm sm:text-base">
                  Asset Readiness Score
                </h4>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
                  {readinessLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Blurred content for non-pro */}
          <div className={!hasAccess ? 'blur-[6px] pointer-events-none transition-all' : 'transition-all'}>
            {/* Score Hero */}
            <div className="mb-5 p-4 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-500/10 dark:to-blue-500/10 rounded-lg border border-cyan-100 dark:border-cyan-500/20 text-center">
              <p className="text-xs font-medium text-neutral-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                Overall Readiness
              </p>
              <div className="flex items-center justify-center gap-3 mb-2">
                <p className={`text-4xl sm:text-5xl font-bold ${scoreColor(overallScore)}`}>
                  {overallScore}
                </p>
                <span className="text-lg text-neutral-400 dark:text-slate-500 font-light">/100</span>
              </div>
              <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${badge.className}`}>
                {badge.label}
              </span>
            </div>

            {/* Factor Breakdown Bars */}
            <div className="mb-5">
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Factor Breakdown
              </h5>
              <div className="space-y-3">
                {factors.map((factor) => (
                  <div key={factor.key} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${factor.color}`}>
                          {factor.label}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-slate-500">
                          ({factor.weight}% weight)
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${scoreColor(factor.score)}`}>
                        {factor.score}/100
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${factor.bgColor} rounded-full transition-all duration-700`}
                        style={{ width: `${factor.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Factor Detail Cards Grid */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 ${isAcquisition ? 'lg:grid-cols-7' : 'lg:grid-cols-5'} gap-2 mb-5`}>
              {factors.map((factor) => (
                <div
                  key={factor.key}
                  className="p-2.5 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                >
                  <p className="text-[10px] font-bold text-neutral-500/70 dark:text-slate-400/70 uppercase tracking-wider mb-1">
                    {factor.label}
                  </p>
                  <p className={`text-sm font-bold ${factor.color}`}>
                    {factor.score}/100
                  </p>
                  <div className="mt-1 h-1 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${factor.bgColor} rounded-full`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Active Designations */}
            {(regulatoryDesignations.breakthrough || regulatoryDesignations.fastTrack || regulatoryDesignations.orphan || regulatoryDesignations.prime) && (
              <div className="mb-5 flex flex-wrap gap-2">
                {regulatoryDesignations.breakthrough && (
                  <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/25">
                    Breakthrough Therapy
                  </span>
                )}
                {regulatoryDesignations.fastTrack && (
                  <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25">
                    Fast Track
                  </span>
                )}
                {regulatoryDesignations.orphan && (
                  <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/25">
                    Orphan Drug
                  </span>
                )}
                {regulatoryDesignations.prime && (
                  <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-full bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/25">
                    PRIME
                  </span>
                )}
              </div>
            )}

            {/* Narrative */}
            <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-500 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">
                    Your asset scores <span className="font-bold text-slate-700 dark:text-slate-200">{overallScore}/100</span>.{' '}
                    The biggest gap is <span className="font-bold text-slate-700 dark:text-slate-200">{weakest.label}</span> ({weakest.score}/100).{' '}
                    To improve: {recommendation}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional (non-scored) considerations — deal-type specific */}
            {considerationsTitle && considerations.length > 0 && (
              <div className="mt-4 p-4 rounded-lg border border-dashed border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/5">
                <div className="flex items-start gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      {considerationsTitle}
                    </h5>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                      Not scored — these are items you should validate manually during diligence. They materially affect deal outcomes but can&apos;t be assessed from calculator inputs alone.
                    </p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {considerations.map((item) => (
                    <li
                      key={item.title}
                      className="flex items-start gap-2 p-2 rounded-md bg-white/60 dark:bg-slate-800/40 border border-amber-200/60 dark:border-amber-500/20"
                    >
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Pro Gate Overlay */}
          {!hasAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : onUpgrade?.()}
                aria-label="Unlock Asset Readiness Score"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow hover:scale-105 transition-all"
              >
                <Lock className="w-4 h-4" />
                Unlock Asset Readiness Score
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
