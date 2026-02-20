'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  TherapeuticArea,
  Phase,
  Modality,
  Indication,
  Territory,
  BiomarkerStatus,
  LineOfTherapy,
  TreatmentApproach,
  CombinationPotential,
  CompetitivePosition,
  DataQuality,
  RegulatoryDesignations,
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  BBBPenetration,
  DiseaseProgression,
  BiomarkerValidation,
  ImmuneResetPotential,
  TargetSpecificity,
  DiseaseSeverity,
  ImmunologyTreatmentGoal,
  MechanismDifferentiation,
  WeightLossEfficacy,
  RouteOfAdministration,
  ComorbidityBreadth,
  MetabolicTreatmentApproach,
} from '@/lib/calculations';
import { canUseCalculator, incrementUsage, getUsage, FREE_LIMIT, syncUsageFromDatabase } from '@/lib/usage';
import { addToHistory } from '@/lib/history';
import { PRICING, DEAL_STATS, BENCHMARK_VERSION } from '@/lib/config/constants';
import { useTracking } from './TrackingProvider';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import ResultsSkeleton from './skeletons/ResultsSkeleton';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
import PaywallModal from './PaywallModal';
import OnboardingModal, { type OnboardingStep } from './OnboardingModal';

// Dynamic import: Results is only rendered after calculation completes
const Results = dynamic(() => import('./Results'), { ssr: false, loading: () => <ResultsSkeleton /> });
import { shouldShowOnboarding, markOnboardingComplete, markOnboardingSkipped } from '@/lib/onboarding';

import { DealTemplatesGrid, TherapeuticAreaSelector, AreaSwitchModal, AssetDetailsSection, AdvancedOptionsSection } from './calculator/index';
import type { DealTemplate } from './calculator/index';

interface CalculatorProps {
  tier?: 'free' | 'pro';
  onUpgrade?: () => void;
}

type EffectiveTier = 'free' | 'report' | 'pro';

export default function Calculator({ tier = 'free', onUpgrade }: CalculatorProps) {
  const [therapeuticArea, setTherapeuticArea] = useState<TherapeuticArea>('oncology');
  const [phase, setPhase] = useState<Phase>('phase2');
  const [modality, setModality] = useState<Modality>('smallMolecule');
  const [indication, setIndication] = useState<Indication>('lung_nsclc');
  const [territory, setTerritory] = useState<Territory>('global');
  const [biomarker, setBiomarker] = useState<BiomarkerStatus>('unselected');
  const [lineOfTherapy, setLineOfTherapy] = useState<LineOfTherapy>('2L');
  const [treatmentApproach, setTreatmentApproach] = useState<TreatmentApproach>('symptomatic');
  const [combinationPotential, setCombinationPotential] = useState<CombinationPotential>('some');
  const [competitivePosition, setCompetitivePosition] = useState<CompetitivePosition>('racing');
  const [dataQuality, setDataQuality] = useState<DataQuality>('promising');
  const [regulatoryDesignations, setRegulatoryDesignations] = useState<RegulatoryDesignations>({
    breakthrough: false,
    fastTrack: false,
    orphan: false,
    prime: false,
  });
  const [bbbPenetration, setBbbPenetration] = useState<BBBPenetration>('unproven');
  const [diseaseProgression, setDiseaseProgression] = useState<DiseaseProgression>('moderateProgressive');
  const [biomarkerValidation, setBiomarkerValidation] = useState<BiomarkerValidation>('noBiomarker');
  const [immuneResetPotential, setImmuneResetPotential] = useState<ImmuneResetPotential>('chronicTreatment');
  const [targetSpecificity, setTargetSpecificity] = useState<TargetSpecificity>('pathwayTargeted');
  const [diseaseSeverity, setDiseaseSeverity] = useState<DiseaseSeverity>('moderateSevere');
  const [treatmentGoal, setTreatmentGoal] = useState<ImmunologyTreatmentGoal>('remissionInduction');
  const [mechanismDifferentiation, setMechanismDifferentiation] = useState<MechanismDifferentiation>('incretinBased');
  const [weightLossEfficacy, setWeightLossEfficacy] = useState<WeightLossEfficacy>('competitiveEfficacy');
  const [routeOfAdministration, setRouteOfAdministration] = useState<RouteOfAdministration>('injectable');
  const [comorbidityBreadth, setComorbidityBreadth] = useState<ComorbidityBreadth>('obesityPrimary');
  const [metabolicTreatmentApproach, setMetabolicTreatmentApproach] = useState<MetabolicTreatmentApproach>('chronicWeightMgmt');

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'report_upsell' | 'pro_feature'>('report_upsell');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportPurchaseId, setReportPurchaseId] = useState<string | null>(null);
  const [reportVerified, setReportVerified] = useState(false);
  const [pendingAreaSwitch, setPendingAreaSwitch] = useState<TherapeuticArea | null>(null);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);

  // Template selection state
  const [showTemplates, setShowTemplates] = useState(true);
  const [quickMode, setQuickMode] = useState(true);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());

  // Tracking
  const { trackCalculation, trackParameterChange, trackPaywallHit, sessionId, anonymousId } = useTracking();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const calculationCountRef = useRef(0);
  // Ref for race condition prevention - checked immediately before async work
  const calculatingRef = useRef(false);
  const hadPrefillRef = useRef(false);

  // Check for report purchase from URL params (after Stripe redirect)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report');
    if (reportId) {
      setReportPurchaseId(reportId);
      fetch(`/api/report-purchase/${reportId}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'completed') {
            setReportVerified(true);
          }
        })
        .catch(() => {/* Report verification failed, stay on free tier */});
    }
  }, []);

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
      hadPrefillRef.current = true;
      try {
        const inputs = JSON.parse(prefill);
        if (inputs.therapeuticArea) setTherapeuticArea(inputs.therapeuticArea as TherapeuticArea);
        if (inputs.phase) setPhase(inputs.phase as Phase);
        if (inputs.modality) setModality(inputs.modality as Modality);
        if (inputs.indication) setIndication(inputs.indication as Indication);
        if (inputs.territory) setTerritory(inputs.territory as Territory);
        if (inputs.biomarker) setBiomarker(inputs.biomarker as BiomarkerStatus);
        if (inputs.lineOfTherapy) setLineOfTherapy(inputs.lineOfTherapy as LineOfTherapy);
        if (inputs.treatmentApproach) setTreatmentApproach(inputs.treatmentApproach as TreatmentApproach);
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

  // Read URL params (from LiveDemo CTA) and auto-calculate on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hadPrefillRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const urlPhase = params.get('phase');
    const urlModality = params.get('modality');
    const urlIndication = params.get('indication');

    if (urlPhase || urlModality || urlIndication) {
      if (urlPhase) setPhase(urlPhase as Phase);
      if (urlModality) setModality(urlModality as Modality);
      if (urlIndication) setIndication(urlIndication as Indication);
      setShowTemplates(false);
      setQuickMode(false);
      const input: CalculationInput = {
        therapeuticArea,
        phase: (urlPhase as Phase) || phase,
        modality: (urlModality as Modality) || modality,
        indication: (urlIndication as Indication) || indication,
        territory, biomarker, lineOfTherapy, treatmentApproach,
        combinationPotential, competitivePosition, dataQuality,
        regulatoryDesignations,
      };
      setResult(calculateDealTerms(input));
      return;
    }

    // Auto-calculate for first-time visitors with default values
    if (!sessionStorage.getItem('has_auto_calculated')) {
      sessionStorage.setItem('has_auto_calculated', 'true');
      const input: CalculationInput = {
        therapeuticArea, phase, modality, indication,
        territory, biomarker, lineOfTherapy, treatmentApproach,
        combinationPotential, competitivePosition, dataQuality,
        regulatoryDesignations,
      };
      setResult(calculateDealTerms(input));
      setShowTemplates(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalculate = () => {
    // Gate 2nd+ calculation behind account creation for anonymous users
    if (!isAuthenticated && getUsage().count >= 1) {
      openAuthModal('signup');
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
            therapeuticArea,
            phase,
            modality,
            indication,
            territory,
            biomarker,
            lineOfTherapy,
            treatmentApproach,
            combinationPotential,
            competitivePosition,
            dataQuality,
            regulatoryDesignations,
            ...(therapeuticArea === 'neurology' ? { bbbPenetration, diseaseProgression, biomarkerValidation } : {}),
            ...(therapeuticArea === 'immunology' ? { immuneResetPotential, targetSpecificity, diseaseSeverity, treatmentGoal } : {}),
            ...(therapeuticArea === 'metabolic' ? { mechanismDifferentiation, weightLossEfficacy, routeOfAdministration, comorbidityBreadth, metabolicTreatmentApproach } : {}),
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
              user_id: isAuthenticated && user?.id ? user.id : null,
              therapeutic_area: therapeuticArea,
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
              toast.warning('Unable to save calculation. Your results are shown but may not be synced.');
            });

      // Save to local history with ALL inputs for recalculation
      addToHistory({
        inputs: {
          therapeuticArea,
          phase,
          modality,
          indication,
          territory,
          biomarker,
          lineOfTherapy,
          treatmentApproach,
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
  const performAreaSwitch = (newArea: TherapeuticArea) => {
    trackParameterChange('therapeuticArea', therapeuticArea, newArea);
    setTherapeuticArea(newArea);
    if (newArea === 'neurology') {
      setIndication('alzheimers' as Indication);
      setModality('smallMolecule');
      setTreatmentApproach('symptomatic');
    } else if (newArea === 'immunology') {
      setIndication('ulcerativeColitis' as Indication);
      setModality('mab' as Modality);
      setTreatmentGoal('remissionInduction');
      setImmuneResetPotential('chronicTreatment');
      setTargetSpecificity('pathwayTargeted');
      setDiseaseSeverity('moderateSevere');
    } else if (newArea === 'metabolic') {
      setIndication('obesity' as Indication);
      setModality('glp1Agonist' as Modality);
      setMetabolicTreatmentApproach('chronicWeightMgmt');
      setMechanismDifferentiation('incretinBased');
      setWeightLossEfficacy('competitiveEfficacy');
      setRouteOfAdministration('injectable');
      setComorbidityBreadth('obesityPrimary');
    } else {
      setIndication('lung_nsclc' as Indication);
      setModality('smallMolecule');
      setLineOfTherapy('2L');
    }
    setResult(null);
    setShowTemplates(true);
  };

  const handleSensitivityApply = (newInputs: Partial<CalculationInput>) => {
    try {
      // Merge new inputs with current state values to get complete input
      const mergedInputs: CalculationInput = {
        therapeuticArea: (newInputs.therapeuticArea as TherapeuticArea) || therapeuticArea,
        phase: (newInputs.phase as Phase) || phase,
        modality: (newInputs.modality as Modality) || modality,
        indication: (newInputs.indication as Indication) || indication,
        territory: (newInputs.territory as Territory) || territory,
        biomarker: (newInputs.biomarker as BiomarkerStatus) || biomarker,
        lineOfTherapy: (newInputs.lineOfTherapy as LineOfTherapy) || lineOfTherapy,
        treatmentApproach: (newInputs.treatmentApproach as TreatmentApproach) || treatmentApproach,
        combinationPotential: (newInputs.combinationPotential as CombinationPotential) || combinationPotential,
        competitivePosition: (newInputs.competitivePosition as CompetitivePosition) || competitivePosition,
        dataQuality: (newInputs.dataQuality as DataQuality) || dataQuality,
        regulatoryDesignations: newInputs.regulatoryDesignations || regulatoryDesignations,
        ...(therapeuticArea === 'neurology' ? {
          bbbPenetration: (newInputs.bbbPenetration as BBBPenetration) || bbbPenetration,
          diseaseProgression: (newInputs.diseaseProgression as DiseaseProgression) || diseaseProgression,
          biomarkerValidation: (newInputs.biomarkerValidation as BiomarkerValidation) || biomarkerValidation,
        } : {}),
        ...(therapeuticArea === 'immunology' ? {
          immuneResetPotential: (newInputs.immuneResetPotential as ImmuneResetPotential) || immuneResetPotential,
          targetSpecificity: (newInputs.targetSpecificity as TargetSpecificity) || targetSpecificity,
          diseaseSeverity: (newInputs.diseaseSeverity as DiseaseSeverity) || diseaseSeverity,
          treatmentGoal: (newInputs.treatmentGoal as ImmunologyTreatmentGoal) || treatmentGoal,
        } : {}),
        ...(therapeuticArea === 'metabolic' ? {
          mechanismDifferentiation: (newInputs.mechanismDifferentiation as MechanismDifferentiation) || mechanismDifferentiation,
          weightLossEfficacy: (newInputs.weightLossEfficacy as WeightLossEfficacy) || weightLossEfficacy,
          routeOfAdministration: (newInputs.routeOfAdministration as RouteOfAdministration) || routeOfAdministration,
          comorbidityBreadth: (newInputs.comorbidityBreadth as ComorbidityBreadth) || comorbidityBreadth,
          metabolicTreatmentApproach: (newInputs.metabolicTreatmentApproach as MetabolicTreatmentApproach) || metabolicTreatmentApproach,
        } : {}),
      };

      // Update state variables for UI sync
      if (newInputs.therapeuticArea) setTherapeuticArea(newInputs.therapeuticArea as TherapeuticArea);
      if (newInputs.phase) setPhase(newInputs.phase as Phase);
      if (newInputs.modality) setModality(newInputs.modality as Modality);
      if (newInputs.indication) setIndication(newInputs.indication as Indication);
      if (newInputs.territory) setTerritory(newInputs.territory as Territory);
      if (newInputs.biomarker) setBiomarker(newInputs.biomarker as BiomarkerStatus);
      if (newInputs.lineOfTherapy) setLineOfTherapy(newInputs.lineOfTherapy as LineOfTherapy);
      if (newInputs.treatmentApproach) setTreatmentApproach(newInputs.treatmentApproach as TreatmentApproach);
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

    if (values.therapeuticArea) { setTherapeuticArea(values.therapeuticArea); fieldsSet.add('therapeuticArea'); }
    if (values.phase) { setPhase(values.phase); fieldsSet.add('phase'); }
    if (values.modality) { setModality(values.modality); fieldsSet.add('modality'); }
    if (values.indication) { setIndication(values.indication); fieldsSet.add('indication'); }
    if (values.territory) { setTerritory(values.territory); fieldsSet.add('territory'); }
    if (values.biomarker) { setBiomarker(values.biomarker); fieldsSet.add('biomarker'); }
    if (values.lineOfTherapy) { setLineOfTherapy(values.lineOfTherapy); fieldsSet.add('lineOfTherapy'); }
    if (values.treatmentApproach) { setTreatmentApproach(values.treatmentApproach); fieldsSet.add('treatmentApproach'); }
    if (values.combinationPotential) { setCombinationPotential(values.combinationPotential); fieldsSet.add('combinationPotential'); }
    if (values.competitivePosition) { setCompetitivePosition(values.competitivePosition); fieldsSet.add('competitivePosition'); }
    if (values.dataQuality) { setDataQuality(values.dataQuality); fieldsSet.add('dataQuality'); }
    if (values.regulatoryDesignations) { setRegulatoryDesignations(values.regulatoryDesignations); fieldsSet.add('regulatoryDesignations'); }

    setHighlightedFields(fieldsSet);
    setShowTemplates(false);
    setQuickMode(false);

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
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">
                  {therapeuticArea === 'metabolic' ? 'Metabolic / Obesity' : therapeuticArea === 'neurology' ? 'Neurology / CNS' : therapeuticArea === 'immunology' ? 'Immunology / Autoimmune' : 'Oncology'} Deal Terms Calculator
                </h2>
                <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
                  {BENCHMARK_VERSION.LABEL}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Template Selection */}
        {showTemplates && (
          <DealTemplatesGrid
            therapeuticArea={therapeuticArea}
            highlightedFields={highlightedFields}
            onApplyTemplate={applyTemplate}
            onHideTemplates={() => setShowTemplates(false)}
            isCalculating={isCalculating}
          />
        )}

        {/* Form */}
        <div className="p-4 sm:p-6 lg:p-8 bg-gradient-subtle">
          {/* Therapeutic Area Selector */}
          <TherapeuticAreaSelector
            therapeuticArea={therapeuticArea}
            onSelect={performAreaSwitch}
            onConfirmSwitch={(newArea) => setPendingAreaSwitch(newArea)}
            hasResult={!!result}
          />

          <div className={`grid ${quickMode ? 'max-w-xl mx-auto' : 'md:grid-cols-2'} gap-6 lg:gap-8`}>
            {/* Left Column */}
            <div className="space-y-6 lg:space-y-8">
              {/* Asset Details Section */}
              <AssetDetailsSection
                therapeuticArea={therapeuticArea}
                phase={phase}
                modality={modality}
                indication={indication}
                biomarker={biomarker}
                highlightedFields={highlightedFields}
                quickMode={quickMode}
                onboardingStep={onboardingStep}
                onPhaseChange={(newValue) => {
                  trackParameterChange('phase', phase, newValue);
                  setPhase(newValue);
                }}
                onModalityChange={(newValue) => {
                  trackParameterChange('modality', modality, newValue);
                  setModality(newValue);
                }}
                onIndicationChange={(newValue) => {
                  trackParameterChange('indication', indication, newValue);
                  setIndication(newValue);
                }}
                onBiomarkerChange={(newValue) => {
                  trackParameterChange('biomarker', biomarker, newValue);
                  setBiomarker(newValue);
                }}
                onShowAdvanced={() => setQuickMode(false)}
              />

              {!quickMode && (
                <AdvancedOptionsSection
                  column="left"
                  therapeuticArea={therapeuticArea}
                  territory={territory}
                  lineOfTherapy={lineOfTherapy}
                  treatmentApproach={treatmentApproach}
                  combinationPotential={combinationPotential}
                  competitivePosition={competitivePosition}
                  dataQuality={dataQuality}
                  regulatoryDesignations={regulatoryDesignations}
                  highlightedFields={highlightedFields}
                  onboardingStep={onboardingStep}
                  bbbPenetration={bbbPenetration}
                  diseaseProgression={diseaseProgression}
                  biomarkerValidation={biomarkerValidation}
                  immuneResetPotential={immuneResetPotential}
                  targetSpecificity={targetSpecificity}
                  diseaseSeverity={diseaseSeverity}
                  treatmentGoal={treatmentGoal}
                  mechanismDifferentiation={mechanismDifferentiation}
                  weightLossEfficacy={weightLossEfficacy}
                  routeOfAdministration={routeOfAdministration}
                  comorbidityBreadth={comorbidityBreadth}
                  metabolicTreatmentApproach={metabolicTreatmentApproach}
                  onTerritoryChange={(newValue) => {
                    trackParameterChange('territory', territory, newValue);
                    setTerritory(newValue);
                  }}
                  onLineOfTherapyChange={(newValue) => {
                    trackParameterChange('lineOfTherapy', lineOfTherapy, newValue);
                    setLineOfTherapy(newValue);
                  }}
                  onTreatmentApproachChange={(newValue) => {
                    trackParameterChange('treatmentApproach', treatmentApproach, newValue);
                    setTreatmentApproach(newValue);
                  }}
                  onCombinationPotentialChange={(newValue) => {
                    trackParameterChange('combinationPotential', combinationPotential, newValue);
                    setCombinationPotential(newValue);
                  }}
                  onCompetitivePositionChange={(newValue) => {
                    trackParameterChange('competitivePosition', competitivePosition, newValue);
                    setCompetitivePosition(newValue);
                  }}
                  onDataQualityChange={(newValue) => {
                    trackParameterChange('dataQuality', dataQuality, newValue);
                    setDataQuality(newValue);
                  }}
                  onRegulatoryChange={handleRegulatoryChange}
                  onBbbPenetrationChange={(newValue) => {
                    trackParameterChange('bbbPenetration', bbbPenetration, newValue);
                    setBbbPenetration(newValue);
                  }}
                  onDiseaseProgressionChange={(newValue) => {
                    trackParameterChange('diseaseProgression', diseaseProgression, newValue);
                    setDiseaseProgression(newValue);
                  }}
                  onBiomarkerValidationChange={(newValue) => {
                    trackParameterChange('biomarkerValidation', biomarkerValidation, newValue);
                    setBiomarkerValidation(newValue);
                  }}
                  onImmuneResetPotentialChange={(newValue) => {
                    trackParameterChange('immuneResetPotential', immuneResetPotential, newValue);
                    setImmuneResetPotential(newValue);
                  }}
                  onTargetSpecificityChange={(newValue) => {
                    trackParameterChange('targetSpecificity', targetSpecificity, newValue);
                    setTargetSpecificity(newValue);
                  }}
                  onDiseaseSeverityChange={(newValue) => {
                    trackParameterChange('diseaseSeverity', diseaseSeverity, newValue);
                    setDiseaseSeverity(newValue);
                  }}
                  onTreatmentGoalChange={(newValue) => {
                    trackParameterChange('treatmentGoal', treatmentGoal, newValue);
                    setTreatmentGoal(newValue);
                  }}
                  onMechanismDifferentiationChange={(newValue) => {
                    trackParameterChange('mechanismDifferentiation', mechanismDifferentiation, newValue);
                    setMechanismDifferentiation(newValue);
                  }}
                  onWeightLossEfficacyChange={(newValue) => {
                    trackParameterChange('weightLossEfficacy', weightLossEfficacy, newValue);
                    setWeightLossEfficacy(newValue);
                  }}
                  onRouteOfAdministrationChange={(newValue) => {
                    trackParameterChange('routeOfAdministration', routeOfAdministration, newValue);
                    setRouteOfAdministration(newValue);
                  }}
                  onComorbidityBreadthChange={(newValue) => {
                    trackParameterChange('comorbidityBreadth', comorbidityBreadth, newValue);
                    setComorbidityBreadth(newValue);
                  }}
                  onMetabolicTreatmentApproachChange={(newValue) => {
                    trackParameterChange('metabolicTreatmentApproach', metabolicTreatmentApproach, newValue);
                    setMetabolicTreatmentApproach(newValue);
                  }}
                />
              )}
            </div>

            {/* Right Column */}
            {!quickMode && (
            <div className="space-y-6 lg:space-y-8">
              <AdvancedOptionsSection
                column="right"
                therapeuticArea={therapeuticArea}
                territory={territory}
                lineOfTherapy={lineOfTherapy}
                treatmentApproach={treatmentApproach}
                combinationPotential={combinationPotential}
                competitivePosition={competitivePosition}
                dataQuality={dataQuality}
                regulatoryDesignations={regulatoryDesignations}
                highlightedFields={highlightedFields}
                onboardingStep={onboardingStep}
                bbbPenetration={bbbPenetration}
                diseaseProgression={diseaseProgression}
                biomarkerValidation={biomarkerValidation}
                immuneResetPotential={immuneResetPotential}
                targetSpecificity={targetSpecificity}
                diseaseSeverity={diseaseSeverity}
                treatmentGoal={treatmentGoal}
                mechanismDifferentiation={mechanismDifferentiation}
                weightLossEfficacy={weightLossEfficacy}
                routeOfAdministration={routeOfAdministration}
                comorbidityBreadth={comorbidityBreadth}
                metabolicTreatmentApproach={metabolicTreatmentApproach}
                onTerritoryChange={(newValue) => {
                  trackParameterChange('territory', territory, newValue);
                  setTerritory(newValue);
                }}
                onLineOfTherapyChange={(newValue) => {
                  trackParameterChange('lineOfTherapy', lineOfTherapy, newValue);
                  setLineOfTherapy(newValue);
                }}
                onTreatmentApproachChange={(newValue) => {
                  trackParameterChange('treatmentApproach', treatmentApproach, newValue);
                  setTreatmentApproach(newValue);
                }}
                onCombinationPotentialChange={(newValue) => {
                  trackParameterChange('combinationPotential', combinationPotential, newValue);
                  setCombinationPotential(newValue);
                }}
                onCompetitivePositionChange={(newValue) => {
                  trackParameterChange('competitivePosition', competitivePosition, newValue);
                  setCompetitivePosition(newValue);
                }}
                onDataQualityChange={(newValue) => {
                  trackParameterChange('dataQuality', dataQuality, newValue);
                  setDataQuality(newValue);
                }}
                onRegulatoryChange={handleRegulatoryChange}
                onBbbPenetrationChange={(newValue) => {
                  trackParameterChange('bbbPenetration', bbbPenetration, newValue);
                  setBbbPenetration(newValue);
                }}
                onDiseaseProgressionChange={(newValue) => {
                  trackParameterChange('diseaseProgression', diseaseProgression, newValue);
                  setDiseaseProgression(newValue);
                }}
                onBiomarkerValidationChange={(newValue) => {
                  trackParameterChange('biomarkerValidation', biomarkerValidation, newValue);
                  setBiomarkerValidation(newValue);
                }}
                onImmuneResetPotentialChange={(newValue) => {
                  trackParameterChange('immuneResetPotential', immuneResetPotential, newValue);
                  setImmuneResetPotential(newValue);
                }}
                onTargetSpecificityChange={(newValue) => {
                  trackParameterChange('targetSpecificity', targetSpecificity, newValue);
                  setTargetSpecificity(newValue);
                }}
                onDiseaseSeverityChange={(newValue) => {
                  trackParameterChange('diseaseSeverity', diseaseSeverity, newValue);
                  setDiseaseSeverity(newValue);
                }}
                onTreatmentGoalChange={(newValue) => {
                  trackParameterChange('treatmentGoal', treatmentGoal, newValue);
                  setTreatmentGoal(newValue);
                }}
                onMechanismDifferentiationChange={(newValue) => {
                  trackParameterChange('mechanismDifferentiation', mechanismDifferentiation, newValue);
                  setMechanismDifferentiation(newValue);
                }}
                onWeightLossEfficacyChange={(newValue) => {
                  trackParameterChange('weightLossEfficacy', weightLossEfficacy, newValue);
                  setWeightLossEfficacy(newValue);
                }}
                onRouteOfAdministrationChange={(newValue) => {
                  trackParameterChange('routeOfAdministration', routeOfAdministration, newValue);
                  setRouteOfAdministration(newValue);
                }}
                onComorbidityBreadthChange={(newValue) => {
                  trackParameterChange('comorbidityBreadth', comorbidityBreadth, newValue);
                  setComorbidityBreadth(newValue);
                }}
                onMetabolicTreatmentApproachChange={(newValue) => {
                  trackParameterChange('metabolicTreatmentApproach', metabolicTreatmentApproach, newValue);
                  setMetabolicTreatmentApproach(newValue);
                }}
              />
            </div>
            )}
          </div>

          {/* Removed: Usage counter — calculations are now unlimited */}

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
                     flex items-center justify-center gap-2.5 sm:gap-3 group text-base sm:text-base touch-feedback btn-press
                     active:scale-[0.97] active:shadow-md"
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
            Free — unlimited calculations with headline estimates
          </p>
        </div>
      </div>

      {/* Loading Skeleton */}
      <div aria-live="polite" aria-atomic="true">
        {isCalculating && !result && (
          <div className="mt-8">
            <ResultsSkeleton />
            <span className="sr-only">Analyzing market data, please wait...</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <WatchlistProvider tier={tier}>
        <div className="mt-8 animate-fade-in results-container" aria-live="polite">
          <Results
            result={result}
            tier={(tier === 'pro' ? 'pro' : (reportPurchaseId && reportVerified) ? 'report' : 'free') as EffectiveTier}
            onUpgrade={onUpgrade}
            onBuyReport={() => {
              setPaywallReason('report_upsell');
              setShowPaywall(true);
            }}
            reportId={reportPurchaseId || undefined}
            userId={user?.id}
            userEmail={user?.email}
            inputs={{
              modality,
              phase,
              indication,
              territory,
            }}
            fullInputs={{
              therapeuticArea,
              phase,
              modality,
              indication,
              territory,
              biomarker,
              lineOfTherapy,
              treatmentApproach,
              combinationPotential,
              competitivePosition,
              dataQuality,
              regulatoryDesignations,
              ...(therapeuticArea === 'neurology' ? { bbbPenetration, diseaseProgression, biomarkerValidation } : {}),
              ...(therapeuticArea === 'immunology' ? { immuneResetPotential, targetSpecificity, diseaseSeverity, treatmentGoal } : {}),
              ...(therapeuticArea === 'metabolic' ? { mechanismDifferentiation, weightLossEfficacy, routeOfAdministration, comorbidityBreadth, metabolicTreatmentApproach } : {}),
            }}
            onApplyNewInputs={handleSensitivityApply}
          />
        </div>
        </WatchlistProvider>
      )}

      {/* Area Switch Confirmation */}
      <AreaSwitchModal
        isOpen={!!pendingAreaSwitch}
        pendingArea={pendingAreaSwitch}
        onConfirm={() => {
          if (pendingAreaSwitch) {
            performAreaSwitch(pendingAreaSwitch);
            setPendingAreaSwitch(null);
          }
        }}
        onCancel={() => setPendingAreaSwitch(null)}
      />

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
        calculationData={result ? {
          inputs: {
            therapeuticArea, phase, modality, indication, territory,
            biomarker, lineOfTherapy, treatmentApproach,
            combinationPotential, competitivePosition, dataQuality,
            regulatoryDesignations,
            ...(therapeuticArea === 'neurology' ? { bbbPenetration, diseaseProgression, biomarkerValidation } : {}),
            ...(therapeuticArea === 'immunology' ? { immuneResetPotential, targetSpecificity, diseaseSeverity, treatmentGoal } : {}),
            ...(therapeuticArea === 'metabolic' ? { mechanismDifferentiation, weightLossEfficacy, routeOfAdministration, comorbidityBreadth, metabolicTreatmentApproach } : {}),
          },
          results: result,
        } : undefined}
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
