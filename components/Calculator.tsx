'use client';

import { useState, useEffect, useRef } from 'react';
import { Circle, Star, Hexagon, Dna, Globe2, CheckCircle } from 'lucide-react';
import {
  Phase,
  Modality,
  Indication,
  Territory,
  BiomarkerStatus,
  LineOfTherapy,
  CombinationPotential,
  CompetitivePosition,
  DataQuality,
  RegulatoryDesignations,
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  phaseOptions,
  modalityOptions,
  indicationOptions,
  territoryOptions,
  biomarkerOptions,
  lineOfTherapyOptions,
  combinationPotentialOptions,
  competitivePositionOptions,
  dataQualityOptions,
  regulatoryDesignationOptions,
} from '@/lib/calculations';
import { canUseCalculator, incrementUsage, getRemainingUses, FREE_LIMIT } from '@/lib/usage';
import { addToHistory } from '@/lib/history';
import { useTracking } from './TrackingProvider';
import Results from './Results';
import PaywallModal from './PaywallModal';
import OnboardingModal, { type OnboardingStep } from './OnboardingModal';
import { shouldShowOnboarding, markOnboardingComplete, markOnboardingSkipped } from '@/lib/onboarding';

// Template types and data
interface DealTemplate {
  id: string;
  name: string;
  description: string;
  icon: 'standard' | 'premium' | 'highValue' | 'platform' | 'regional' | 'commercial';
  values: Partial<CalculationInput>;
}

const DEAL_TEMPLATES: DealTemplate[] = [
  {
    id: 'standard-phase2',
    name: 'Standard Phase 2',
    description: 'Most common deal type',
    icon: 'standard',
    values: {
      phase: 'phase2',
      modality: 'smallMolecule',
      indication: 'lung_nsclc',
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'first-in-class',
    name: 'First-in-Class',
    description: 'Premium positioning',
    icon: 'premium',
    values: {
      phase: 'phase1',
      modality: 'bispecific',
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'late-stage-adc',
    name: 'Late-Stage ADC',
    description: 'High-value acquisitions',
    icon: 'highValue',
    values: {
      phase: 'phase3',
      modality: 'adc',
      indication: 'breast_her2',
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'pivotalReady',
    },
  },
  {
    id: 'platform-multi-asset',
    name: 'Platform / Multi-Asset',
    description: 'CAR-T, gene therapy',
    icon: 'platform',
    values: {
      phase: 'phase1',
      modality: 'carT_solid',
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'regional-carveout',
    name: 'Regional Carve-Out',
    description: 'China/Japan rights only',
    icon: 'regional',
    values: {
      phase: 'phase2',
      territory: 'china',
    },
  },
  {
    id: 'commercial-asset',
    name: 'Commercial Asset',
    description: 'Approved products',
    icon: 'commercial',
    values: {
      phase: 'approved',
      territory: 'global',
      dataQuality: 'pivotalReady',
    },
  },
];

const TEMPLATE_ICONS: Record<DealTemplate['icon'], React.ComponentType<{ className?: string }>> = {
  standard: Circle,
  premium: Star,
  highValue: Hexagon,
  platform: Dna,
  regional: Globe2,
  commercial: CheckCircle,
};

interface CalculatorProps {
  tier?: 'free' | 'pro';
  onUpgrade?: () => void;
}

export default function Calculator({ tier = 'free', onUpgrade }: CalculatorProps) {
  const [phase, setPhase] = useState<Phase>('phase2');
  const [modality, setModality] = useState<Modality>('smallMolecule');
  const [indication, setIndication] = useState<Indication>('lung_nsclc');
  const [territory, setTerritory] = useState<Territory>('global');
  const [biomarker, setBiomarker] = useState<BiomarkerStatus>('unselected');
  const [lineOfTherapy, setLineOfTherapy] = useState<LineOfTherapy>('2L');
  const [combinationPotential, setCombinationPotential] = useState<CombinationPotential>('some');
  const [competitivePosition, setCompetitivePosition] = useState<CompetitivePosition>('racing');
  const [dataQuality, setDataQuality] = useState<DataQuality>('promising');
  const [regulatoryDesignations, setRegulatoryDesignations] = useState<RegulatoryDesignations>({
    breakthrough: false,
    fastTrack: false,
    orphan: false,
    prime: false,
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'limit_reached' | 'pro_feature'>('limit_reached');
  const [remainingUses, setRemainingUses] = useState<number>(FREE_LIMIT);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);

  // Template selection state
  const [showTemplates, setShowTemplates] = useState(true);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());

  // Tracking
  const { trackCalculation, trackParameterChange, trackPaywallHit, sessionId, anonymousId } = useTracking();
  const calculationCountRef = useRef(0);
  // Ref for race condition prevention - checked immediately before async work
  const calculatingRef = useRef(false);

  useEffect(() => {
    setRemainingUses(getRemainingUses(tier));
  }, [tier]);

  // Check if onboarding should show for first-time users
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowOnboarding()) {
        setShowOnboarding(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Check for prefilled inputs from history reuse
  useEffect(() => {
    let mounted = true;

    const prefill = sessionStorage.getItem('prefill_calculation');
    if (prefill && mounted) {
      try {
        const inputs = JSON.parse(prefill);
        if (inputs.phase) setPhase(inputs.phase as Phase);
        if (inputs.modality) setModality(inputs.modality as Modality);
        if (inputs.indication) setIndication(inputs.indication as Indication);
        if (inputs.territory) setTerritory(inputs.territory as Territory);
        if (inputs.biomarker) setBiomarker(inputs.biomarker as BiomarkerStatus);
        if (inputs.lineOfTherapy) setLineOfTherapy(inputs.lineOfTherapy as LineOfTherapy);
        if (inputs.combinationPotential) setCombinationPotential(inputs.combinationPotential as CombinationPotential);
        if (inputs.competitivePosition) setCompetitivePosition(inputs.competitivePosition as CompetitivePosition);
        if (inputs.dataQuality) setDataQuality(inputs.dataQuality as DataQuality);
        if (inputs.regulatoryDesignations) setRegulatoryDesignations(inputs.regulatoryDesignations);
        sessionStorage.removeItem('prefill_calculation');
        // Hide templates when prefill data is present
        setShowTemplates(false);
      } catch {
        // Ignore invalid prefill data
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  const handleCalculate = () => {
    // Check usage limits for free tier
    if (!canUseCalculator(tier)) {
      setPaywallReason('limit_reached');
      setShowPaywall(true);
      // Track paywall hit
      trackPaywallHit('calculation_limit', {
        modality,
        phase,
        indication,
      });
      return;
    }

    // Prevent multiple clicks - check both state and ref for race condition prevention
    if (isCalculating || calculatingRef.current) return;

    // Set ref immediately BEFORE any async work to prevent race conditions
    calculatingRef.current = true;
    setIsCalculating(true);
    setSaveError(null);

    // Use requestAnimationFrame + setTimeout for smooth UI update before calculation
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          const input: CalculationInput = {
            phase,
            modality,
            indication,
            territory,
            biomarker,
            lineOfTherapy,
            combinationPotential,
            competitivePosition,
            dataQuality,
            regulatoryDesignations,
          };
          const calculatedResult = calculateDealTerms(input);
          setResult(calculatedResult);

          // Increment calculation count for this session
          calculationCountRef.current += 1;

          // Track calculation event
          trackCalculation(
            {
              modality,
              development_phase: phase,
              indication_category: indication.split('_')[0],
              indication_specific: indication,
              territory_scope: territory,
            },
            {
              upfront_low: calculatedResult.terms.upfront.low,
              upfront_mid: calculatedResult.terms.upfront.median,
              upfront_high: calculatedResult.terms.upfront.high,
              milestones_total: calculatedResult.terms.devMilestones.median +
                calculatedResult.terms.regMilestones.median +
                calculatedResult.terms.commMilestones.median,
              royalty_low: calculatedResult.tieredRoyalties.base.low,
              royalty_high: calculatedResult.tieredRoyalties.highTier.high,
              total_deal_value_low: calculatedResult.terms.totalDealValue.low,
              total_deal_value_high: calculatedResult.terms.totalDealValue.high,
            },
            calculationCountRef.current
          );

          // Save calculation to database (non-blocking but with user feedback)
          fetch('/api/calculations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              anonymous_id: anonymousId,
              modality,
              development_phase: phase,
              indication_category: indication.split('_')[0],
              indication_specific: indication,
              territory_scope: territory,
              outputs: {
                upfront_low: calculatedResult.terms.upfront.low,
                upfront_mid: calculatedResult.terms.upfront.median,
                upfront_high: calculatedResult.terms.upfront.high,
                milestones_total: calculatedResult.terms.devMilestones.median +
                  calculatedResult.terms.regMilestones.median +
                  calculatedResult.terms.commMilestones.median,
                royalty_low: calculatedResult.tieredRoyalties.base.low,
                royalty_high: calculatedResult.tieredRoyalties.highTier.high,
                total_deal_value_low: calculatedResult.terms.totalDealValue.low,
                total_deal_value_high: calculatedResult.terms.totalDealValue.high,
              },
            }),
          })
            .then(async (response) => {
              if (!response.ok) {
                throw new Error('Server returned an error');
              }
            })
            .catch(error => {
              console.error('Failed to save calculation to database:', error);
              setSaveError('Unable to save calculation. Your results are shown but may not be synced.');
            });

      // Save to local history with ALL inputs for recalculation
      addToHistory({
        inputs: {
          phase,
          modality,
          indication,
          territory,
          biomarker,
          lineOfTherapy,
          combinationPotential,
          competitivePosition,
          dataQuality,
          regulatoryDesignations,
        },
        results: {
          upfrontLow: calculatedResult.terms.upfront.low,
          upfrontHigh: calculatedResult.terms.upfront.high,
          upfrontMedian: calculatedResult.terms.upfront.median,
          totalValueLow: calculatedResult.terms.totalDealValue.low,
          totalValueHigh: calculatedResult.terms.totalDealValue.high,
          totalValueMedian: calculatedResult.terms.totalDealValue.median,
        },
        labels: calculatedResult.labels,
        hasPDF: false,
      });

          // Increment usage after successful calculation (only for free tier)
          if (tier === 'free') {
            incrementUsage();
            setRemainingUses(getRemainingUses(tier));
          }

          // Scroll to results
          setTimeout(() => {
            document.querySelector('.results-container')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }, 100);
        } catch (error) {
          console.error('Calculation error:', error);
        } finally {
          setIsCalculating(false);
          calculatingRef.current = false;
        }
      }, 600);
    });
  };

  // Handle sensitivity analysis changes - updates inputs and triggers recalculation
  const handleSensitivityApply = (newInputs: Partial<CalculationInput>) => {
    try {
      // Merge new inputs with current state values to get complete input
      const mergedInputs: CalculationInput = {
        phase: (newInputs.phase as Phase) || phase,
        modality: (newInputs.modality as Modality) || modality,
        indication: (newInputs.indication as Indication) || indication,
        territory: (newInputs.territory as Territory) || territory,
        biomarker: (newInputs.biomarker as BiomarkerStatus) || biomarker,
        lineOfTherapy: (newInputs.lineOfTherapy as LineOfTherapy) || lineOfTherapy,
        combinationPotential: (newInputs.combinationPotential as CombinationPotential) || combinationPotential,
        competitivePosition: (newInputs.competitivePosition as CompetitivePosition) || competitivePosition,
        dataQuality: (newInputs.dataQuality as DataQuality) || dataQuality,
        regulatoryDesignations: newInputs.regulatoryDesignations || regulatoryDesignations,
      };

      // Update state variables for UI sync
      if (newInputs.phase) setPhase(newInputs.phase as Phase);
      if (newInputs.modality) setModality(newInputs.modality as Modality);
      if (newInputs.indication) setIndication(newInputs.indication as Indication);
      if (newInputs.territory) setTerritory(newInputs.territory as Territory);
      if (newInputs.biomarker) setBiomarker(newInputs.biomarker as BiomarkerStatus);
      if (newInputs.lineOfTherapy) setLineOfTherapy(newInputs.lineOfTherapy as LineOfTherapy);
      if (newInputs.combinationPotential) setCombinationPotential(newInputs.combinationPotential as CombinationPotential);
      if (newInputs.competitivePosition) setCompetitivePosition(newInputs.competitivePosition as CompetitivePosition);
      if (newInputs.dataQuality) setDataQuality(newInputs.dataQuality as DataQuality);
      if (newInputs.regulatoryDesignations) setRegulatoryDesignations(newInputs.regulatoryDesignations);

      // Calculate directly with merged inputs (don't rely on state which is async)
      const calculatedResult = calculateDealTerms(mergedInputs);
      setResult(calculatedResult);

      // Track calculation event (non-blocking)
      try {
        calculationCountRef.current += 1;
        trackCalculation(
          {
            modality: mergedInputs.modality,
            development_phase: mergedInputs.phase,
            indication_category: mergedInputs.indication?.split('_')[0] || '',
            indication_specific: mergedInputs.indication || '',
            territory_scope: mergedInputs.territory,
          },
          {
            upfront_low: calculatedResult.terms.upfront.low,
            upfront_mid: calculatedResult.terms.upfront.median,
            upfront_high: calculatedResult.terms.upfront.high,
            milestones_total: calculatedResult.terms.devMilestones.median +
              calculatedResult.terms.regMilestones.median +
              calculatedResult.terms.commMilestones.median,
            royalty_low: calculatedResult.tieredRoyalties.base.low,
            royalty_high: calculatedResult.tieredRoyalties.highTier.high,
            total_deal_value_low: calculatedResult.terms.totalDealValue.low,
            total_deal_value_high: calculatedResult.terms.totalDealValue.high,
          },
          calculationCountRef.current
        );
      } catch (trackError) {
        console.error('Error tracking sensitivity calculation:', trackError);
      }
    } catch (error) {
      console.error('Error applying sensitivity changes:', error);
    }
  };

  const handleRegulatoryChange = (designation: keyof RegulatoryDesignations) => {
    setRegulatoryDesignations((prev) => ({
      ...prev,
      [designation]: !prev[designation],
    }));
  };

  const applyTemplate = (template: DealTemplate) => {
    const { values } = template;
    const fieldsSet = new Set<string>();

    if (values.phase) { setPhase(values.phase); fieldsSet.add('phase'); }
    if (values.modality) { setModality(values.modality); fieldsSet.add('modality'); }
    if (values.indication) { setIndication(values.indication); fieldsSet.add('indication'); }
    if (values.territory) { setTerritory(values.territory); fieldsSet.add('territory'); }
    if (values.biomarker) { setBiomarker(values.biomarker); fieldsSet.add('biomarker'); }
    if (values.lineOfTherapy) { setLineOfTherapy(values.lineOfTherapy); fieldsSet.add('lineOfTherapy'); }
    if (values.combinationPotential) { setCombinationPotential(values.combinationPotential); fieldsSet.add('combinationPotential'); }
    if (values.competitivePosition) { setCompetitivePosition(values.competitivePosition); fieldsSet.add('competitivePosition'); }
    if (values.dataQuality) { setDataQuality(values.dataQuality); fieldsSet.add('dataQuality'); }
    if (values.regulatoryDesignations) { setRegulatoryDesignations(values.regulatoryDesignations); fieldsSet.add('regulatoryDesignations'); }

    setHighlightedFields(fieldsSet);
    setShowTemplates(false);

    // Clear highlight after animation
    setTimeout(() => setHighlightedFields(new Set()), 2000);

    // Track template selection
    trackParameterChange('template', 'none', template.id);
  };

  return (
    <div id="calculator" className="w-full max-w-6xl mx-auto scroll-mt-24">
      <div className="card-elevated overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-glow flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Oncology Deal Terms Calculator</h2>
                <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
                  2025 Market Benchmarks
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Template Selection */}
        {showTemplates && (
          <div className="p-4 sm:p-6 lg:p-8 border-b border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-navy-800 dark:text-white">Start with a template</h3>
              <p className="text-sm text-neutral-500 dark:text-slate-400">Based on 500+ analyzed deals</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {DEAL_TEMPLATES.map((template) => {
                const IconComponent = TEMPLATE_ICONS[template.icon];
                return (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="p-4 rounded-xl border-2 border-neutral-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500
                               bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-slate-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50
                                    flex items-center justify-center mb-3 transition-colors">
                      <IconComponent className="w-5 h-5 text-neutral-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                    </div>
                    <div className="font-semibold text-navy-800 dark:text-white text-sm">{template.name}</div>
                    <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1">{template.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-slate-700" />
              <span className="text-xs text-neutral-400 dark:text-slate-500">or</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-slate-700" />
            </div>

            <button
              onClick={() => setShowTemplates(false)}
              className="mt-4 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1 group"
            >
              Start from scratch
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Form */}
        <div className="p-4 sm:p-6 lg:p-8 bg-gradient-subtle">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Column */}
            <div className="space-y-6 lg:space-y-8">
              {/* Asset Details Section */}
              <div className={onboardingStep === 'big-three' ? 'onboarding-spotlight p-4 -m-4 bg-white rounded-xl' : ''}>
                <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center">1</span>
                  Asset Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Development Phase</label>
                    <select
                      value={phase}
                      onChange={(e) => {
                        const newValue = e.target.value as Phase;
                        trackParameterChange('phase', phase, newValue);
                        setPhase(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('phase') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {phaseOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Modality</label>
                    <select
                      value={modality}
                      onChange={(e) => {
                        const newValue = e.target.value as Modality;
                        trackParameterChange('modality', modality, newValue);
                        setModality(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('modality') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {modalityOptions.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Primary Indication</label>
                    <select
                      value={indication}
                      onChange={(e) => {
                        const newValue = e.target.value as Indication;
                        trackParameterChange('indication', indication, newValue);
                        setIndication(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('indication') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {indicationOptions.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Biomarker Status</label>
                    <select
                      value={biomarker}
                      onChange={(e) => {
                        const newValue = e.target.value as BiomarkerStatus;
                        trackParameterChange('biomarker', biomarker, newValue);
                        setBiomarker(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('biomarker') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {biomarkerOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Target Profile Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/70 text-white text-xs flex items-center justify-center">2</span>
                  Target Profile
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Line of Therapy</label>
                    <select
                      value={lineOfTherapy}
                      onChange={(e) => {
                        const newValue = e.target.value as LineOfTherapy;
                        trackParameterChange('lineOfTherapy', lineOfTherapy, newValue);
                        setLineOfTherapy(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('lineOfTherapy') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {lineOfTherapyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Combination Potential</label>
                    <select
                      value={combinationPotential}
                      onChange={(e) => {
                        const newValue = e.target.value as CombinationPotential;
                        trackParameterChange('combinationPotential', combinationPotential, newValue);
                        setCombinationPotential(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('combinationPotential') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {combinationPotentialOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6 lg:space-y-8">
              {/* Competitive Landscape Section */}
              <div className={onboardingStep === 'modifiers' ? 'onboarding-spotlight p-4 -m-4 bg-white rounded-xl' : ''}>
                <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/50 text-white text-xs flex items-center justify-center">3</span>
                  Competitive Landscape
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Competitive Position</label>
                    <select
                      value={competitivePosition}
                      onChange={(e) => {
                        const newValue = e.target.value as CompetitivePosition;
                        trackParameterChange('competitivePosition', competitivePosition, newValue);
                        setCompetitivePosition(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('competitivePosition') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {competitivePositionOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Data Quality</label>
                    <select
                      value={dataQuality}
                      onChange={(e) => {
                        const newValue = e.target.value as DataQuality;
                        trackParameterChange('dataQuality', dataQuality, newValue);
                        setDataQuality(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('dataQuality') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {dataQualityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Deal Scope Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/30 text-teal-700 text-xs flex items-center justify-center">4</span>
                  Deal Scope
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Territory</label>
                    <select
                      value={territory}
                      onChange={(e) => {
                        const newValue = e.target.value as Territory;
                        trackParameterChange('territory', territory, newValue);
                        setTerritory(newValue);
                      }}
                      className={`select-field transition-all duration-300 ${highlightedFields.has('territory') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                    >
                      {territoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Regulatory Designations</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                      {regulatoryDesignationOptions.map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center gap-3 px-4 py-3.5 sm:py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 touch-feedback min-h-[52px] ${
                            regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                              ? 'border-teal-500 bg-teal-50 shadow-sm'
                              : 'border-neutral-200 bg-white hover:border-teal-300 active:bg-teal-50/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={regulatoryDesignations[option.value as keyof RegulatoryDesignations]}
                            onChange={() => handleRegulatoryChange(option.value as keyof RegulatoryDesignations)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                            regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-neutral-300'
                          }`}>
                            {regulatoryDesignations[option.value as keyof RegulatoryDesignations] && (
                              <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm sm:text-sm font-medium ${
                            regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                              ? 'text-teal-700'
                              : 'text-neutral-700'
                          }`}>
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Counter for Free Tier */}
          {tier === 'free' && (
            <div className="mt-6 lg:mt-8 p-3 sm:p-4 rounded-xl bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-500 dark:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm text-neutral-600 dark:text-slate-400">
                    <span className="font-semibold text-navy-800 dark:text-white">{remainingUses}</span> of {FREE_LIMIT} free calculations remaining
                  </span>
                </div>
                {remainingUses === 0 && (
                  <button
                    onClick={() => {
                      setPaywallReason('limit_reached');
                      setShowPaywall(true);
                    }}
                    className="text-xs sm:text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Save Error Warning */}
          {saveError && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-700 flex-1">{saveError}</span>
              <button
                onClick={() => setSaveError(null)}
                className="text-amber-600 hover:text-amber-800 p-1"
                aria-label="Dismiss warning"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Calculate Button - Enhanced mobile touch feedback */}
          <button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="mt-5 sm:mt-6 w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-4 sm:py-4 px-4 sm:px-6 rounded-2xl sm:rounded-xl
                     shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all duration-300
                     hover:from-teal-600 hover:to-cyan-600 hover:-translate-y-0.5
                     disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0
                     flex items-center justify-center gap-2.5 sm:gap-3 group text-base sm:text-base touch-feedback
                     active:scale-[0.98] active:shadow-md"
          >
            {isCalculating ? (
              <>
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 rounded-full border-2 border-white/30" />
                  <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
                <span>Analyzing Market Data...</span>
              </>
            ) : (
              <>
                <span>Calculate Deal Terms</span>
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs text-neutral-500 mt-4">
            Free tier includes upfront payment and total deal value estimates
          </p>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-8 animate-fade-in results-container">
          <Results
            result={result}
            tier={tier}
            onUpgrade={onUpgrade}
            inputs={{
              modality,
              phase,
              indication,
              territory,
            }}
            fullInputs={{
              phase,
              modality,
              indication,
              territory,
              biomarker,
              lineOfTherapy,
              combinationPotential,
              competitivePosition,
              dataQuality,
              regulatoryDesignations,
            }}
            onApplyNewInputs={handleSensitivityApply}
          />
        </div>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => {
          markOnboardingSkipped();
          setShowOnboarding(false);
          setOnboardingStep(null);
        }}
        onComplete={() => {
          markOnboardingComplete();
          setShowOnboarding(false);
          setOnboardingStep(null);
        }}
        onStepChange={setOnboardingStep}
      />
    </div>
  );
}
