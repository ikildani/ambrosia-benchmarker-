'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type {
  TherapeuticArea,
  Phase,
  DealType,
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
  CVOutcomeBenefit,
  CVTrialEndpoint,
  CVPopulationRisk,
  ResistanceProfile,
  InfectionChronicity,
  PublicHealthPriority,
  OcularDelivery,
  TreatmentDurability,
  VisionImpact,
  WHTargetPopulation,
  WHUnmetNeed,
  WHRegulatory,
  OrphanDesignation,
  PatientPopulationSize,
  GeneticBasis,
  HemeLineage,
  TransplantEligibility,
  MRDStatus,
  SkinSeverity,
  ChronicityProfile,
  TopicalVsSystemic,
  GISegment,
  BiologicExperience,
  EndoscopicEndpoint,
} from '@/lib/calculations';
import {
  calculateDealTerms, phaseOptions, dealTypeOptions,
  modalityOptions, neurologyModalityOptions, immunologyModalityOptions,
  metabolicModalityOptions, cardiovascularModalityOptions, infectiousDiseaseModalityOptions,
  ophthalmologyModalityOptions, womensHealthModalityOptions, rareDiseaseModalityOptions,
  hematologyModalityOptions, dermatologyModalityOptions, gastroenterologyModalityOptions,
  indicationOptions, neurologyIndicationOptions, immunologyIndicationOptions,
  metabolicIndicationOptions, cardiovascularIndicationOptions, infectiousDiseaseIndicationOptions,
  ophthalmologyIndicationOptions, womensHealthIndicationOptions, rareDiseaseIndicationOptions,
  hematologyIndicationOptions, dermatologyIndicationOptions, gastroenterologyIndicationOptions,
} from '@/lib/calculations';
import type { GroupedOption } from './calculator/SearchableCombobox';
import { BENCHMARK_VERSION } from '@/lib/config/constants';
import { useTracking } from './TrackingProvider';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import ResultsSkeleton from './skeletons/ResultsSkeleton';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
import type { OnboardingStep } from './OnboardingModal';
const PaywallModal = dynamic(() => import('./PaywallModal'), { ssr: false });
const OnboardingModal = dynamic(() => import('./OnboardingModal'), { ssr: false });
import { shouldShowOnboarding, markOnboardingComplete, markOnboardingSkipped } from '@/lib/onboarding';
import { DealTemplatesGrid, TherapeuticAreaSelector, AreaSwitchModal, AssetDetailsSection, AdvancedOptionsSection, LiveDealPreview, WizardStepper, ValidationWarnings } from './calculator/index';
import { getValidationWarnings } from '@/lib/validationWarnings';
import type { DealTemplate } from './calculator/index';
import type { WizardStep } from './calculator/index';

import { useCalculatorState } from './calculator/useCalculatorState';
import type { CalculatorFormState } from './calculator/useCalculatorState';
import { useCalculation, buildCalculationInput } from './calculator/useCalculation';

const Results = dynamic(() => import('./Results'), { ssr: false, loading: () => <ResultsSkeleton /> });

const FULL_STEPS: WizardStep[] = [
  { id: 'asset', label: 'Your Asset', shortLabel: 'Asset' },
  { id: 'target', label: 'Clinical Profile', shortLabel: 'Profile' },
  { id: 'competitive', label: 'Market Position', shortLabel: 'Market' },
  { id: 'deal', label: 'Deal Structure', shortLabel: 'Deal' },
];

const QUICK_STEPS: WizardStep[] = [
  { id: 'asset', label: 'Your Asset', shortLabel: 'Asset' },
  { id: 'competitive-deal', label: 'Market & Deal', shortLabel: 'Market' },
];

interface CalculatorProps {
  tier?: 'free' | 'pro' | 'report';
  onUpgrade?: () => void;
}

type EffectiveTier = 'free' | 'report' | 'pro';

export default function Calculator({ tier = 'free', onUpgrade }: CalculatorProps) {
  // ── Custom hooks ───────────────────────────────────────────────────────────
  const [state, actions] = useCalculatorState();
  const { trackCalculation, trackParameterChange, sessionId, anonymousId } = useTracking();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const calc = useCalculation({
    tier,
    isAuthenticated,
    userId: user?.id,
    sessionId,
    anonymousId,
    trackCalculation,
    openAuthModal,
  });

  // ── Local UI state (not form-related) ──────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'report_upsell' | 'pro_feature'>('report_upsell');
  const [reportPurchaseId, setReportPurchaseId] = useState<string | null>(null);
  const [reportVerified, setReportVerified] = useState(false);
  const [pendingAreaSwitch, setPendingAreaSwitch] = useState<TherapeuticArea | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);

  const hadPrefillRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevResultRef = useRef(calc.result);

  // Scroll to results when they first appear
  useEffect(() => {
    if (calc.result && !prevResultRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300); // Allow animation to begin before scrolling
    }
    prevResultRef.current = calc.result;
  }, [calc.result]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeSteps = state.quickMode ? QUICK_STEPS : FULL_STEPS;

  // Live preview: recalculate deal terms on every input change (~1ms, pure sync)
  const previewResult = useMemo(() => {
    return calculateDealTerms(buildCalculationInput(state));
  }, [state]);

  // Selection summary chips for wizard context
  const selectionSummary = useMemo(() => {
    const phaseLabel = phaseOptions.find(o => o.value === state.phase)?.label || state.phase;
    const shortPhase = phaseLabel.replace(/\s*\(.*\)/, '');
    const dealLabel = dealTypeOptions.find(o => o.value === state.dealType)?.label || state.dealType;

    // Resolve modality label from TA-specific grouped options
    const modalityMap: Record<TherapeuticArea, GroupedOption[]> = {
      oncology: modalityOptions, neurology: neurologyModalityOptions, immunology: immunologyModalityOptions,
      metabolic: metabolicModalityOptions, cardiovascular: cardiovascularModalityOptions,
      infectiousDisease: infectiousDiseaseModalityOptions, ophthalmology: ophthalmologyModalityOptions,
      womensHealth: womensHealthModalityOptions, rareDisease: rareDiseaseModalityOptions,
      hematology: hematologyModalityOptions, dermatology: dermatologyModalityOptions,
      gastroenterology: gastroenterologyModalityOptions,
    };
    const indicationMap: Record<TherapeuticArea, GroupedOption[]> = {
      oncology: indicationOptions, neurology: neurologyIndicationOptions, immunology: immunologyIndicationOptions,
      metabolic: metabolicIndicationOptions, cardiovascular: cardiovascularIndicationOptions,
      infectiousDisease: infectiousDiseaseIndicationOptions, ophthalmology: ophthalmologyIndicationOptions,
      womensHealth: womensHealthIndicationOptions, rareDisease: rareDiseaseIndicationOptions,
      hematology: hematologyIndicationOptions, dermatology: dermatologyIndicationOptions,
      gastroenterology: gastroenterologyIndicationOptions,
    };
    const findLabel = (groups: GroupedOption[], val: string) => {
      for (const g of groups) {
        const found = g.options.find(o => o.value === val);
        if (found) return found.label;
      }
      return val;
    };
    const modalityLabel = findLabel(modalityMap[state.therapeuticArea] || modalityOptions, state.modality);
    const indicationLabel = findLabel(indicationMap[state.therapeuticArea] || indicationOptions, state.indication);

    return [
      { label: 'Phase', value: shortPhase },
      { label: 'Deal', value: dealLabel },
      { label: 'Modality', value: modalityLabel },
      { label: 'Indication', value: indicationLabel },
    ];
  }, [state.phase, state.dealType, state.modality, state.indication, state.therapeuticArea]);

  // Smart validation: detect contradictory inputs
  const validationWarnings = useMemo(() => {
    return getValidationWarnings({
      phase: state.phase, dataQuality: state.dataQuality, competitivePosition: state.competitivePosition,
      combinationPotential: state.combinationPotential, biomarker: state.biomarker,
      modality: state.modality, territory: state.territory,
    });
  }, [state.phase, state.dataQuality, state.competitivePosition, state.combinationPotential, state.biomarker, state.modality, state.territory]);

  // ── Effects ────────────────────────────────────────────────────────────────

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
        actions.bulkSet({
          ...(inputs.therapeuticArea ? { therapeuticArea: inputs.therapeuticArea } : {}),
          ...(inputs.phase ? { phase: inputs.phase } : {}),
          ...(inputs.modality ? { modality: inputs.modality } : {}),
          ...(inputs.indication ? { indication: inputs.indication } : {}),
          ...(inputs.territory ? { territory: inputs.territory } : {}),
          ...(inputs.biomarker ? { biomarker: inputs.biomarker } : {}),
          ...(inputs.lineOfTherapy ? { lineOfTherapy: inputs.lineOfTherapy } : {}),
          ...(inputs.treatmentApproach ? { treatmentApproach: inputs.treatmentApproach } : {}),
          ...(inputs.combinationPotential ? { combinationPotential: inputs.combinationPotential } : {}),
          ...(inputs.competitivePosition ? { competitivePosition: inputs.competitivePosition } : {}),
          ...(inputs.dataQuality ? { dataQuality: inputs.dataQuality } : {}),
          ...(inputs.regulatoryDesignations ? { regulatoryDesignations: inputs.regulatoryDesignations } : {}),
          ...(inputs.dealType ? { dealType: inputs.dealType } : {}),
          showTemplates: false,
        });
        sessionStorage.removeItem('prefill_calculation');
      } catch {
        // Ignore invalid prefill data
      }
    }
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore wizard progress from sessionStorage (if no prefill or URL params)
  // If ?new=true is present, clear saved state to start fresh
  useEffect(() => {
    if (hadPrefillRef.current) return;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true') {
        sessionStorage.removeItem('wizard_progress');
        sessionStorage.removeItem('has_auto_calculated');
        calc.setResult(null);
        // Clean up the URL parameter without triggering navigation
        const url = new URL(window.location.href);
        url.searchParams.delete('new');
        window.history.replaceState({}, '', url.pathname + url.search);
        return;
      }
    }

    const saved = sessionStorage.getItem('wizard_progress');
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      const patch: Partial<CalculatorFormState> = {};
      if (s.therapeuticArea) patch.therapeuticArea = s.therapeuticArea;
      if (s.phase) patch.phase = s.phase;
      if (s.dealType) patch.dealType = s.dealType;
      if (s.modality) patch.modality = s.modality;
      if (s.indication) patch.indication = s.indication;
      if (s.territory) patch.territory = s.territory;
      if (s.biomarker) patch.biomarker = s.biomarker;
      if (s.lineOfTherapy) patch.lineOfTherapy = s.lineOfTherapy;
      if (s.treatmentApproach) patch.treatmentApproach = s.treatmentApproach;
      if (s.combinationPotential) patch.combinationPotential = s.combinationPotential;
      if (s.competitivePosition) patch.competitivePosition = s.competitivePosition;
      if (s.dataQuality) patch.dataQuality = s.dataQuality;
      if (s.regulatoryDesignations) patch.regulatoryDesignations = s.regulatoryDesignations;
      if (s.bbbPenetration) patch.bbbPenetration = s.bbbPenetration;
      if (s.diseaseProgression) patch.diseaseProgression = s.diseaseProgression;
      if (s.biomarkerValidation) patch.biomarkerValidation = s.biomarkerValidation;
      if (s.immuneResetPotential) patch.immuneResetPotential = s.immuneResetPotential;
      if (s.targetSpecificity) patch.targetSpecificity = s.targetSpecificity;
      if (s.diseaseSeverity) patch.diseaseSeverity = s.diseaseSeverity;
      if (s.treatmentGoal) patch.treatmentGoal = s.treatmentGoal;
      if (s.mechanismDifferentiation) patch.mechanismDifferentiation = s.mechanismDifferentiation;
      if (s.weightLossEfficacy) patch.weightLossEfficacy = s.weightLossEfficacy;
      if (s.routeOfAdministration) patch.routeOfAdministration = s.routeOfAdministration;
      if (s.comorbidityBreadth) patch.comorbidityBreadth = s.comorbidityBreadth;
      if (s.metabolicTreatmentApproach) patch.metabolicTreatmentApproach = s.metabolicTreatmentApproach;
      if (typeof s.wizardStep === 'number') patch.wizardStep = s.wizardStep;
      if (typeof s.quickMode === 'boolean') patch.quickMode = s.quickMode;
      if (s.showTemplates === false) patch.showTemplates = false;
      actions.bulkSet(patch);
    } catch {
      // Ignore invalid saved state
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist wizard progress to sessionStorage on every input change
  useEffect(() => {
    const { highlightedFields, ...persistable } = state;
    sessionStorage.setItem('wizard_progress', JSON.stringify(persistable));
  }, [state]);

  // Read URL params (from LiveDemo CTA) and auto-calculate on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hadPrefillRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const urlPhase = params.get('phase');
    const urlModality = params.get('modality');
    const urlIndication = params.get('indication');

    if (urlPhase || urlModality || urlIndication) {
      const patch: Partial<CalculatorFormState> = { showTemplates: false, quickMode: false };
      if (urlPhase) patch.phase = urlPhase as Phase;
      if (urlModality) patch.modality = urlModality as Modality;
      if (urlIndication) patch.indication = urlIndication as Indication;
      actions.bulkSet(patch);

      const patchedState = {
        ...state,
        ...(urlPhase ? { phase: urlPhase as Phase } : {}),
        ...(urlModality ? { modality: urlModality as Modality } : {}),
        ...(urlIndication ? { indication: urlIndication as Indication } : {}),
      };
      calc.setResult(calculateDealTerms(buildCalculationInput(patchedState)));
      return;
    }

    // Auto-calculate for first-time visitors with default values
    if (!sessionStorage.getItem('has_auto_calculated')) {
      sessionStorage.setItem('has_auto_calculated', 'true');
      calc.setResult(calculateDealTerms(buildCalculationInput(state)));
      actions.setShowTemplates(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Unsaved changes warning ────────────────────────────────────────────────
  // Warn users who change inputs after seeing results, before navigating away
  const lastCalcInputHashRef = useRef<string>('');

  // Snapshot input state when a new calculation result arrives
  useEffect(() => {
    if (calc.result) {
      lastCalcInputHashRef.current = JSON.stringify({
        ta: state.therapeuticArea, p: state.phase, m: state.modality,
        i: state.indication, t: state.territory, b: state.biomarker,
        cp: state.competitivePosition, dq: state.dataQuality,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc.result]);

  useEffect(() => {
    if (!calc.result || !lastCalcInputHashRef.current) return;

    const currentHash = JSON.stringify({
      ta: state.therapeuticArea, p: state.phase, m: state.modality,
      i: state.indication, t: state.territory, b: state.biomarker,
      cp: state.competitivePosition, dq: state.dataQuality,
    });

    const isDirty = currentHash !== lastCalcInputHashRef.current;

    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };

    if (isDirty) {
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [calc.result, state.therapeuticArea, state.phase, state.modality, state.indication, state.territory, state.biomarker, state.competitivePosition, state.dataQuality]);

  // ── Keyboard shortcut: Cmd/Ctrl+Enter to calculate ─────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        calc.handleCalculate(state);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [calc, state]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const performAreaSwitch = (newArea: TherapeuticArea) => {
    trackParameterChange('therapeuticArea', state.therapeuticArea, newArea);
    actions.switchTherapeuticArea(newArea);
    calc.setResult(null);
  };

  const handleApplyTemplate = (template: DealTemplate) => {
    actions.applyTemplate(template);
    // Clear highlight after animation
    setTimeout(() => actions.clearHighlights(), 2000);
    trackParameterChange('template', 'none', template.id);
  };

  const onSensitivityApply = (newInputs: Partial<CalculationInput>) => {
    calc.handleSensitivityApply(state, newInputs, actions.bulkSet);
  };

  // Build fullInputs for Results and PaywallModal
  const fullInputs = buildCalculationInput(state);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div id="calculator" className="w-full max-w-6xl xl:max-w-7xl mx-auto scroll-mt-24 pb-20 md:pb-0">
      <div className="card-elevated overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 lg:py-8 xl:py-10 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(14, 165, 165, 0.5) 1px, transparent 0)`,
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
                <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold font-display text-white truncate">
                  {state.therapeuticArea === 'metabolic' ? 'Metabolic / Obesity' : state.therapeuticArea === 'neurology' ? 'Neurology / CNS' : state.therapeuticArea === 'immunology' ? 'Immunology / Autoimmune' : state.therapeuticArea === 'rareDisease' ? 'Rare Disease' : state.therapeuticArea === 'hematology' ? 'Hematology' : state.therapeuticArea === 'dermatology' ? 'Dermatology' : state.therapeuticArea === 'gastroenterology' ? 'Gastroenterology / IBD' : 'Oncology'} Deal Terms Calculator
                </h2>
                <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
                  {BENCHMARK_VERSION.LABEL}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Template Selection */}
        {state.showTemplates && (
          <DealTemplatesGrid
            therapeuticArea={state.therapeuticArea}
            highlightedFields={state.highlightedFields}
            onApplyTemplate={handleApplyTemplate}
            onHideTemplates={() => actions.setShowTemplates(false)}
            isCalculating={calc.isCalculating}
          />
        )}

        {/* Form */}
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-gradient-subtle">
          {/* Therapeutic Area Selector */}
          <TherapeuticAreaSelector
            therapeuticArea={state.therapeuticArea}
            onSelect={performAreaSwitch}
            onConfirmSwitch={(newArea) => setPendingAreaSwitch(newArea)}
            hasResult={!!calc.result}
          />

          {/* Wizard + Live Preview layout */}
          <div className="grid md:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-6 lg:gap-8 xl:gap-10">
            <WizardStepper
              steps={activeSteps}
              currentStep={state.wizardStep}
              onStepChange={actions.setWizardStep}
              onCalculate={() => calc.handleCalculate(state)}
              isCalculating={calc.isCalculating}
              selectionSummary={selectionSummary}
            >
              {(() => {
                const stepId = activeSteps[state.wizardStep]?.id;

                // Shared AdvancedOptionsSection props
                const advancedProps = {
                  therapeuticArea: state.therapeuticArea,
                  dealType: state.dealType,
                  territory: state.territory,
                  lineOfTherapy: state.lineOfTherapy,
                  treatmentApproach: state.treatmentApproach,
                  combinationPotential: state.combinationPotential,
                  competitivePosition: state.competitivePosition,
                  dataQuality: state.dataQuality,
                  regulatoryDesignations: state.regulatoryDesignations,
                  highlightedFields: state.highlightedFields,
                  onboardingStep,
                  bbbPenetration: state.bbbPenetration,
                  diseaseProgression: state.diseaseProgression,
                  biomarkerValidation: state.biomarkerValidation,
                  immuneResetPotential: state.immuneResetPotential,
                  targetSpecificity: state.targetSpecificity,
                  diseaseSeverity: state.diseaseSeverity,
                  treatmentGoal: state.treatmentGoal,
                  mechanismDifferentiation: state.mechanismDifferentiation,
                  weightLossEfficacy: state.weightLossEfficacy,
                  routeOfAdministration: state.routeOfAdministration,
                  comorbidityBreadth: state.comorbidityBreadth,
                  metabolicTreatmentApproach: state.metabolicTreatmentApproach,
                  onTerritoryChange: (newValue: Territory) => { trackParameterChange('territory', state.territory, newValue); actions.setTerritory(newValue); },
                  onLineOfTherapyChange: (newValue: LineOfTherapy) => { trackParameterChange('lineOfTherapy', state.lineOfTherapy, newValue); actions.setLineOfTherapy(newValue); },
                  onTreatmentApproachChange: (newValue: TreatmentApproach) => { trackParameterChange('treatmentApproach', state.treatmentApproach, newValue); actions.setTreatmentApproach(newValue); },
                  onCombinationPotentialChange: (newValue: CombinationPotential) => { trackParameterChange('combinationPotential', state.combinationPotential, newValue); actions.setCombinationPotential(newValue); },
                  onCompetitivePositionChange: (newValue: CompetitivePosition) => { trackParameterChange('competitivePosition', state.competitivePosition, newValue); actions.setCompetitivePosition(newValue); },
                  onDataQualityChange: (newValue: DataQuality) => { trackParameterChange('dataQuality', state.dataQuality, newValue); actions.setDataQuality(newValue); },
                  onRegulatoryChange: actions.toggleRegulatory,
                  onBbbPenetrationChange: (newValue: BBBPenetration) => { trackParameterChange('bbbPenetration', state.bbbPenetration, newValue); actions.setBbbPenetration(newValue); },
                  onDiseaseProgressionChange: (newValue: DiseaseProgression) => { trackParameterChange('diseaseProgression', state.diseaseProgression, newValue); actions.setDiseaseProgression(newValue); },
                  onBiomarkerValidationChange: (newValue: BiomarkerValidation) => { trackParameterChange('biomarkerValidation', state.biomarkerValidation, newValue); actions.setBiomarkerValidation(newValue); },
                  onImmuneResetPotentialChange: (newValue: ImmuneResetPotential) => { trackParameterChange('immuneResetPotential', state.immuneResetPotential, newValue); actions.setImmuneResetPotential(newValue); },
                  onTargetSpecificityChange: (newValue: TargetSpecificity) => { trackParameterChange('targetSpecificity', state.targetSpecificity, newValue); actions.setTargetSpecificity(newValue); },
                  onDiseaseSeverityChange: (newValue: DiseaseSeverity) => { trackParameterChange('diseaseSeverity', state.diseaseSeverity, newValue); actions.setDiseaseSeverity(newValue); },
                  onTreatmentGoalChange: (newValue: ImmunologyTreatmentGoal) => { trackParameterChange('treatmentGoal', state.treatmentGoal, newValue); actions.setTreatmentGoal(newValue); },
                  onMechanismDifferentiationChange: (newValue: MechanismDifferentiation) => { trackParameterChange('mechanismDifferentiation', state.mechanismDifferentiation, newValue); actions.setMechanismDifferentiation(newValue); },
                  onWeightLossEfficacyChange: (newValue: WeightLossEfficacy) => { trackParameterChange('weightLossEfficacy', state.weightLossEfficacy, newValue); actions.setWeightLossEfficacy(newValue); },
                  onRouteOfAdministrationChange: (newValue: RouteOfAdministration) => { trackParameterChange('routeOfAdministration', state.routeOfAdministration, newValue); actions.setRouteOfAdministration(newValue); },
                  onComorbidityBreadthChange: (newValue: ComorbidityBreadth) => { trackParameterChange('comorbidityBreadth', state.comorbidityBreadth, newValue); actions.setComorbidityBreadth(newValue); },
                  onMetabolicTreatmentApproachChange: (newValue: MetabolicTreatmentApproach) => { trackParameterChange('metabolicTreatmentApproach', state.metabolicTreatmentApproach, newValue); actions.setMetabolicTreatmentApproach(newValue); },
                  // Cardiovascular
                  cvOutcomeBenefit: state.cvOutcomeBenefit,
                  cvTrialEndpoint: state.cvTrialEndpoint,
                  cvPopulationRisk: state.cvPopulationRisk,
                  onCvOutcomeBenefitChange: (newValue: CVOutcomeBenefit) => { trackParameterChange('cvOutcomeBenefit', state.cvOutcomeBenefit, newValue); actions.setCvOutcomeBenefit(newValue); },
                  onCvTrialEndpointChange: (newValue: CVTrialEndpoint) => { trackParameterChange('cvTrialEndpoint', state.cvTrialEndpoint, newValue); actions.setCvTrialEndpoint(newValue); },
                  onCvPopulationRiskChange: (newValue: CVPopulationRisk) => { trackParameterChange('cvPopulationRisk', state.cvPopulationRisk, newValue); actions.setCvPopulationRisk(newValue); },
                  // Infectious Disease
                  resistanceProfile: state.resistanceProfile,
                  infectionChronicity: state.infectionChronicity,
                  publicHealthPriority: state.publicHealthPriority,
                  onResistanceProfileChange: (newValue: ResistanceProfile) => { trackParameterChange('resistanceProfile', state.resistanceProfile, newValue); actions.setResistanceProfile(newValue); },
                  onInfectionChronicityChange: (newValue: InfectionChronicity) => { trackParameterChange('infectionChronicity', state.infectionChronicity, newValue); actions.setInfectionChronicity(newValue); },
                  onPublicHealthPriorityChange: (newValue: PublicHealthPriority) => { trackParameterChange('publicHealthPriority', state.publicHealthPriority, newValue); actions.setPublicHealthPriority(newValue); },
                  // Ophthalmology
                  ocularDelivery: state.ocularDelivery,
                  treatmentDurability: state.treatmentDurability,
                  visionImpact: state.visionImpact,
                  onOcularDeliveryChange: (newValue: OcularDelivery) => { trackParameterChange('ocularDelivery', state.ocularDelivery, newValue); actions.setOcularDelivery(newValue); },
                  onTreatmentDurabilityChange: (newValue: TreatmentDurability) => { trackParameterChange('treatmentDurability', state.treatmentDurability, newValue); actions.setTreatmentDurability(newValue); },
                  onVisionImpactChange: (newValue: VisionImpact) => { trackParameterChange('visionImpact', state.visionImpact, newValue); actions.setVisionImpact(newValue); },
                  // Women's Health
                  whTargetPopulation: state.whTargetPopulation,
                  whUnmetNeed: state.whUnmetNeed,
                  whRegulatory: state.whRegulatory,
                  onWhTargetPopulationChange: (newValue: WHTargetPopulation) => { trackParameterChange('whTargetPopulation', state.whTargetPopulation, newValue); actions.setWhTargetPopulation(newValue); },
                  onWhUnmetNeedChange: (newValue: WHUnmetNeed) => { trackParameterChange('whUnmetNeed', state.whUnmetNeed, newValue); actions.setWhUnmetNeed(newValue); },
                  onWhRegulatoryChange: (newValue: WHRegulatory) => { trackParameterChange('whRegulatory', state.whRegulatory, newValue); actions.setWhRegulatory(newValue); },
                  // Rare Disease
                  orphanDesignation: state.orphanDesignation,
                  patientPopulationSize: state.patientPopulationSize,
                  geneticBasis: state.geneticBasis,
                  onOrphanDesignationChange: (newValue: OrphanDesignation) => { trackParameterChange('orphanDesignation', state.orphanDesignation, newValue); actions.setOrphanDesignation(newValue); },
                  onPatientPopulationSizeChange: (newValue: PatientPopulationSize) => { trackParameterChange('patientPopulationSize', state.patientPopulationSize, newValue); actions.setPatientPopulationSize(newValue); },
                  onGeneticBasisChange: (newValue: GeneticBasis) => { trackParameterChange('geneticBasis', state.geneticBasis, newValue); actions.setGeneticBasis(newValue); },
                  // Hematology
                  hemeLineage: state.hemeLineage,
                  transplantEligibility: state.transplantEligibility,
                  mrdStatus: state.mrdStatus,
                  onHemeLineageChange: (newValue: HemeLineage) => { trackParameterChange('hemeLineage', state.hemeLineage, newValue); actions.setHemeLineage(newValue); },
                  onTransplantEligibilityChange: (newValue: TransplantEligibility) => { trackParameterChange('transplantEligibility', state.transplantEligibility, newValue); actions.setTransplantEligibility(newValue); },
                  onMrdStatusChange: (newValue: MRDStatus) => { trackParameterChange('mrdStatus', state.mrdStatus, newValue); actions.setMrdStatus(newValue); },
                  // Dermatology
                  skinSeverity: state.skinSeverity,
                  chronicityProfile: state.chronicityProfile,
                  topicalVsSystemic: state.topicalVsSystemic,
                  onSkinSeverityChange: (newValue: SkinSeverity) => { trackParameterChange('skinSeverity', state.skinSeverity, newValue); actions.setSkinSeverity(newValue); },
                  onChronicityProfileChange: (newValue: ChronicityProfile) => { trackParameterChange('chronicityProfile', state.chronicityProfile, newValue); actions.setChronicityProfile(newValue); },
                  onTopicalVsSystemicChange: (newValue: TopicalVsSystemic) => { trackParameterChange('topicalVsSystemic', state.topicalVsSystemic, newValue); actions.setTopicalVsSystemic(newValue); },
                  // Gastroenterology
                  giSegment: state.giSegment,
                  biologicExperience: state.biologicExperience,
                  endoscopicEndpoint: state.endoscopicEndpoint,
                  onGiSegmentChange: (newValue: GISegment) => { trackParameterChange('giSegment', state.giSegment, newValue); actions.setGiSegment(newValue); },
                  onBiologicExperienceChange: (newValue: BiologicExperience) => { trackParameterChange('biologicExperience', state.biologicExperience, newValue); actions.setBiologicExperience(newValue); },
                  onEndoscopicEndpointChange: (newValue: EndoscopicEndpoint) => { trackParameterChange('endoscopicEndpoint', state.endoscopicEndpoint, newValue); actions.setEndoscopicEndpoint(newValue); },
                } as const;

                // Determine which fields are visible on this step for filtering warnings
                const stepFields: Record<string, string[]> = {
                  asset: ['phase', 'modality', 'biomarker'],
                  target: ['combinationPotential'],
                  competitive: ['competitivePosition', 'dataQuality', 'combinationPotential'],
                  deal: ['territory'],
                  'competitive-deal': ['competitivePosition', 'dataQuality', 'combinationPotential', 'territory'],
                };
                const currentStepFields = stepFields[stepId || ''] || [];
                const stepWarnings = validationWarnings.filter(w =>
                  w.fields.some(f => currentStepFields.includes(f))
                );

                let stepContent: React.ReactNode = null;

                switch (stepId) {
                  case 'asset':
                    stepContent = (
                      <AssetDetailsSection
                        therapeuticArea={state.therapeuticArea}
                        phase={state.phase}
                        dealType={state.dealType}
                        modality={state.modality}
                        indication={state.indication}
                        biomarker={state.biomarker}
                        highlightedFields={state.highlightedFields}
                        quickMode={false}
                        onboardingStep={onboardingStep}
                        onPhaseChange={(newValue) => { trackParameterChange('phase', state.phase, newValue); actions.setPhase(newValue); }}
                        onDealTypeChange={(newValue: DealType) => { trackParameterChange('dealType', state.dealType, newValue); actions.setDealType(newValue); }}
                        onModalityChange={(newValue) => { trackParameterChange('modality', state.modality, newValue); actions.setModality(newValue); }}
                        onIndicationChange={(newValue) => { trackParameterChange('indication', state.indication, newValue); actions.setIndication(newValue); }}
                        onBiomarkerChange={(newValue) => { trackParameterChange('biomarker', state.biomarker, newValue); actions.setBiomarker(newValue); }}
                        onShowAdvanced={() => { actions.setQuickMode(false); actions.setWizardStep(0); }}
                      />
                    );
                    break;
                  case 'target':
                    stepContent = <AdvancedOptionsSection column="left" {...advancedProps} />;
                    break;
                  case 'competitive':
                    stepContent = <AdvancedOptionsSection column="competitive" {...advancedProps} />;
                    break;
                  case 'deal':
                    stepContent = <AdvancedOptionsSection column="deal-scope" {...advancedProps} />;
                    break;
                  case 'competitive-deal':
                    stepContent = (
                      <div className="space-y-8">
                        <AdvancedOptionsSection column="competitive" {...advancedProps} />
                        <AdvancedOptionsSection column="deal-scope" {...advancedProps} />
                      </div>
                    );
                    break;
                }

                return (
                  <div className="space-y-4">
                    {stepContent}
                    <ValidationWarnings warnings={stepWarnings} />
                  </div>
                );
              })()}
            </WizardStepper>

            {/* Desktop: Live preview sidebar */}
            <div className="hidden md:block">
              <LiveDealPreview
                totalDealValue={previewResult.terms.totalDealValue}
                upfront={previewResult.terms.upfront}
              />
            </div>
          </div>

          {/* Mobile: Live preview bottom bar */}
          <div className="md:hidden">
            <LiveDealPreview
              totalDealValue={previewResult.terms.totalDealValue}
              upfront={previewResult.terms.upfront}
            />
          </div>

          {/* Save Error Warning */}
          {calc.saveError && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-700 flex-1">{calc.saveError}</span>
              <button
                onClick={() => calc.setSaveError(null)}
                className="text-amber-600 hover:text-amber-800 p-1"
                aria-label="Dismiss warning"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <p className="text-center text-xs text-neutral-500 mt-4">
            Free — unlimited calculations with headline estimates
          </p>
        </div>
      </div>

      {/* Loading Skeleton */}
      <div aria-live="polite" aria-atomic="true">
        {calc.isCalculating && !calc.result && (
          <div className="mt-8">
            <ResultsSkeleton />
            <span className="sr-only">Analyzing market data, please wait...</span>
          </div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {calc.result && (
          <motion.div
            key="results"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          >
            <WatchlistProvider tier={tier}>
            <div ref={resultsRef} className="mt-8 results-container scroll-mt-24" aria-live="polite">
              <Results
                result={calc.result}
                tier={(tier === 'pro' ? 'pro' : (tier === 'report' || (reportPurchaseId && reportVerified)) ? 'report' : 'free') as EffectiveTier}
                onUpgrade={onUpgrade}
                onBuyReport={() => {
                  setPaywallReason('report_upsell');
                  setShowPaywall(true);
                }}
                reportId={reportPurchaseId || undefined}
                userId={user?.id}
                userEmail={user?.email}
                inputs={{
                  modality: state.modality,
                  phase: state.phase,
                  indication: state.indication,
                  territory: state.territory,
                }}
                fullInputs={fullInputs}
                onApplyNewInputs={onSensitivityApply}
              />
            </div>
            </WatchlistProvider>
          </motion.div>
        )}
      </AnimatePresence>

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
        calculationData={calc.result ? {
          inputs: fullInputs,
          results: calc.result,
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
