'use client';

import { useState, useEffect, useRef } from 'react';
import { Circle, Star, Hexagon, Dna, Globe2, CheckCircle } from 'lucide-react';
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
  therapeuticAreaOptions,
  phaseOptions,
  modalityOptions,
  neurologyModalityOptions,
  indicationOptions,
  neurologyIndicationOptions,
  territoryOptions,
  biomarkerOptions,
  lineOfTherapyOptions,
  treatmentApproachOptions,
  combinationPotentialOptions,
  competitivePositionOptions,
  dataQualityOptions,
  regulatoryDesignationOptions,
  BBBPenetration,
  DiseaseProgression,
  BiomarkerValidation,
  bbbPenetrationOptions,
  diseaseProgressionOptions,
  biomarkerValidationOptions,
  immunologyModalityOptions,
  immunologyIndicationOptions,
  ImmuneResetPotential,
  TargetSpecificity,
  DiseaseSeverity,
  ImmunologyTreatmentGoal,
  immuneResetOptions,
  targetSpecificityOptions,
  diseaseSeverityOptions,
  treatmentGoalOptions,
} from '@/lib/calculations';
import { canUseCalculator, incrementUsage, getUsage, FREE_LIMIT, syncUsageFromDatabase } from '@/lib/usage';
import { addToHistory } from '@/lib/history';
import { PRICING, DEAL_STATS, BENCHMARK_VERSION } from '@/lib/config/constants';
import { useTracking } from './TrackingProvider';
import { useAuth } from '@/contexts/AuthContext';
import Results, { ResultsSkeleton } from './Results';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
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

const NEUROLOGY_TEMPLATES: DealTemplate[] = [
  {
    id: 'neuro-alzheimers-bbb',
    name: "Alzheimer's BBB Platform",
    description: 'High-value CNS delivery',
    icon: 'highValue',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase1',
      modality: 'bbbPlatform' as Modality,
      indication: 'alzheimers' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'neuro-phase2-depression',
    name: 'Phase 2 Depression',
    description: 'Psychiatry pipeline',
    icon: 'standard',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase2',
      modality: 'smallMolecule',
      indication: 'depression' as Indication,
      territory: 'global',
      treatmentApproach: 'symptomatic' as TreatmentApproach,
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'neuro-rare-gene-therapy',
    name: 'Rare Neuro Gene Therapy',
    description: 'Orphan + gene therapy premium',
    icon: 'platform',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase1',
      modality: 'geneTherapy',
      indication: 'rareNeuro' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'neuro-parkinsons-bestinclass',
    name: "Parkinson's Best-in-Class",
    description: 'Disease-modifying potential',
    icon: 'premium',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase2',
      modality: 'mab',
      indication: 'parkinsons' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'neuro-schizophrenia-novel',
    name: 'Schizophrenia Novel MOA',
    description: 'KarXT-era paradigm shift',
    icon: 'premium',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase2',
      modality: 'smallMolecule',
      indication: 'schizophrenia' as Indication,
      territory: 'global',
      treatmentApproach: 'symptomatic' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'neuro-epilepsy-aso',
    name: 'Epilepsy ASO',
    description: 'Genetic epilepsy target',
    icon: 'platform',
    values: {
      therapeuticArea: 'neurology',
      phase: 'preclinical',
      modality: 'aso' as Modality,
      indication: 'epilepsy' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'limited',
    },
  },
];

const IMMUNOLOGY_TEMPLATES: DealTemplate[] = [
  {
    id: 'immuno-tl1a-ibd',
    name: 'Phase 2 Anti-TL1A (IBD)',
    description: 'Hottest autoimmune target',
    icon: 'highValue',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase2',
      modality: 'tl1aInhibitor' as Modality,
      indication: 'crohns' as Indication,
      territory: 'global',
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'immuno-cart-lupus',
    name: 'Autoimmune CAR-T (Lupus)',
    description: 'Curative potential',
    icon: 'platform',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase1',
      modality: 'carT_autoimmune' as Modality,
      indication: 'sle_lupus' as Indication,
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'immuno-oral-integrin',
    name: 'Oral Integrin (UC)',
    description: 'Oral vedolizumab thesis',
    icon: 'premium',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase2',
      modality: 'oralIntegrin' as Modality,
      indication: 'ulcerativeColitis' as Indication,
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'immuno-fcrn-mg',
    name: 'FcRn Antagonist (MG)',
    description: 'Validated platform',
    icon: 'commercial',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase2',
      modality: 'fcrnAntagonist' as Modality,
      indication: 'myastheniaGravis' as Indication,
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
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
              setSaveError('Unable to save calculation. Your results are shown but may not be synced.');
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
                  {therapeuticArea === 'neurology' ? 'Neurology / CNS' : therapeuticArea === 'immunology' ? 'Immunology / Autoimmune' : 'Oncology'} Deal Terms Calculator
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
          <div className="p-4 sm:p-6 lg:p-8 border-b border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-navy-800 dark:text-white">Start with a template</h3>
              <p className="text-sm text-neutral-500 dark:text-slate-400">
                {therapeuticArea === 'neurology' ? `Based on ${DEAL_STATS.NEUROLOGY_DEALS} ${DEAL_STATS.NEUROLOGY_DEALS_DESCRIPTION}` : therapeuticArea === 'immunology' ? `Based on 48 immunology/autoimmune R&D partnerships (2019-2026)` : `Based on ${DEAL_STATS.TOTAL_DEALS} analyzed deals`}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {(therapeuticArea === 'neurology' ? NEUROLOGY_TEMPLATES : therapeuticArea === 'immunology' ? IMMUNOLOGY_TEMPLATES : DEAL_TEMPLATES).map((template) => {
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
          {/* Therapeutic Area Selector */}
          <div className="mb-6 lg:mb-8">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2">Therapeutic Area</label>
            <div className="grid grid-cols-3 gap-3">
              {therapeuticAreaOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    const newArea = option.value as TherapeuticArea;
                    if (newArea !== therapeuticArea) {
                      if (result) {
                        setPendingAreaSwitch(newArea);
                      } else {
                        performAreaSwitch(newArea);
                      }
                    }
                  }}
                  className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                    therapeuticArea === option.value
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 shadow-sm'
                      : 'border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:border-teal-300 dark:hover:border-teal-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`grid ${quickMode ? 'max-w-xl mx-auto' : 'lg:grid-cols-2'} gap-6 lg:gap-8`}>
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
                      {(therapeuticArea === 'neurology' ? neurologyModalityOptions : therapeuticArea === 'immunology' ? immunologyModalityOptions : modalityOptions).map((group) => (
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
                      {(therapeuticArea === 'neurology' ? neurologyIndicationOptions : therapeuticArea === 'immunology' ? immunologyIndicationOptions : indicationOptions).map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {quickMode && (
                    <button
                      onClick={() => setQuickMode(false)}
                      className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium mt-1 group"
                    >
                      <span>Show Advanced Options</span>
                      <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}

                  {!quickMode && (
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
                  )}
                </div>
              </div>

              {!quickMode && (
              <>
              {/* Target Profile Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/70 text-white text-xs flex items-center justify-center">2</span>
                  Target Profile
                </h3>
                <div className="space-y-4">
                  {therapeuticArea === 'neurology' ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Treatment Approach</label>
                      <select
                        value={treatmentApproach}
                        onChange={(e) => {
                          const newValue = e.target.value as TreatmentApproach;
                          trackParameterChange('treatmentApproach', treatmentApproach, newValue);
                          setTreatmentApproach(newValue);
                        }}
                        className={`select-field transition-all duration-300 ${highlightedFields.has('treatmentApproach') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
                      >
                        {treatmentApproachOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : therapeuticArea === 'immunology' ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                        Treatment Goal
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold tracking-wider align-middle">IMMUNO</span>
                      </label>
                      <select
                        value={treatmentGoal}
                        onChange={(e) => {
                          const newValue = e.target.value as ImmunologyTreatmentGoal;
                          trackParameterChange('treatmentGoal', treatmentGoal, newValue);
                          setTreatmentGoal(newValue);
                        }}
                        className="select-field"
                      >
                        {treatmentGoalOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
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
                  )}

                  {therapeuticArea === 'neurology' && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                          BBB Penetration
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold tracking-wider align-middle">NEURO</span>
                        </label>
                        <select
                          value={bbbPenetration}
                          onChange={(e) => {
                            const newValue = e.target.value as BBBPenetration;
                            trackParameterChange('bbbPenetration', bbbPenetration, newValue);
                            setBbbPenetration(newValue);
                          }}
                          className="select-field"
                        >
                          {bbbPenetrationOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                          Disease Progression
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold tracking-wider align-middle">NEURO</span>
                        </label>
                        <select
                          value={diseaseProgression}
                          onChange={(e) => {
                            const newValue = e.target.value as DiseaseProgression;
                            trackParameterChange('diseaseProgression', diseaseProgression, newValue);
                            setDiseaseProgression(newValue);
                          }}
                          className="select-field"
                        >
                          {diseaseProgressionOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                          Biomarker Validation
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold tracking-wider align-middle">NEURO</span>
                        </label>
                        <select
                          value={biomarkerValidation}
                          onChange={(e) => {
                            const newValue = e.target.value as BiomarkerValidation;
                            trackParameterChange('biomarkerValidation', biomarkerValidation, newValue);
                            setBiomarkerValidation(newValue);
                          }}
                          className="select-field"
                        >
                          {biomarkerValidationOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {therapeuticArea === 'immunology' && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                          Immune Reset Potential
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold tracking-wider align-middle">IMMUNO</span>
                        </label>
                        <select
                          value={immuneResetPotential}
                          onChange={(e) => {
                            const newValue = e.target.value as ImmuneResetPotential;
                            trackParameterChange('immuneResetPotential', immuneResetPotential, newValue);
                            setImmuneResetPotential(newValue);
                          }}
                          className="select-field"
                        >
                          {immuneResetOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                          Target Specificity
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold tracking-wider align-middle">IMMUNO</span>
                        </label>
                        <select
                          value={targetSpecificity}
                          onChange={(e) => {
                            const newValue = e.target.value as TargetSpecificity;
                            trackParameterChange('targetSpecificity', targetSpecificity, newValue);
                            setTargetSpecificity(newValue);
                          }}
                          className="select-field"
                        >
                          {targetSpecificityOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                          Disease Severity
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold tracking-wider align-middle">IMMUNO</span>
                        </label>
                        <select
                          value={diseaseSeverity}
                          onChange={(e) => {
                            const newValue = e.target.value as DiseaseSeverity;
                            trackParameterChange('diseaseSeverity', diseaseSeverity, newValue);
                            setDiseaseSeverity(newValue);
                          }}
                          className="select-field"
                        >
                          {diseaseSeverityOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

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
              </>
              )}
            </div>

            {/* Right Column */}
            {!quickMode && (
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
            Free — unlimited calculations with headline estimates
          </p>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isCalculating && !result && (
        <div className="mt-8">
          <ResultsSkeleton />
        </div>
      )}

      {/* Results */}
      {result && (
        <WatchlistProvider tier={tier}>
        <div className="mt-8 animate-fade-in results-container">
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
            }}
            onApplyNewInputs={handleSensitivityApply}
          />
        </div>
        </WatchlistProvider>
      )}

      {/* Area Switch Confirmation */}
      {pendingAreaSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPendingAreaSwitch(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Switch Therapeutic Area?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Switching to <strong>{pendingAreaSwitch === 'neurology' ? 'Neurology / CNS' : 'Oncology'}</strong> will clear your current results. Your calculation history is still saved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingAreaSwitch(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  performAreaSwitch(pendingAreaSwitch);
                  setPendingAreaSwitch(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
              >
                Switch Area
              </button>
            </div>
          </div>
        </div>
      )}

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
