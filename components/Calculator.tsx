'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
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
import CustomSelect from './calculator/CustomSelect';
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
import { TherapeuticAreaSelector, AreaSwitchModal, AssetDetailsSection, AdvancedOptionsSection, LiveDealPreview, WizardStepper, ValidationWarnings } from './calculator/index';
import { AssetDifferentiationSection } from './calculator/AssetDifferentiationSection';
import { MolecularTargetSelector } from './calculator/MolecularTargetSelector';
import PeakSalesOverrideInput from './calculator/PeakSalesOverrideInput';
import { getIndicationTypicalAssetPeak } from '@/lib/financial/index-drugs';
import { getValidationWarnings } from '@/lib/validationWarnings';
import type { WizardStep } from './calculator/index';

import { useCalculatorState } from './calculator/useCalculatorState';
import type { CalculatorFormState } from './calculator/useCalculatorState';
import { useCalculation, buildCalculationInput } from './calculator/useCalculation';
import { UsageCounter } from './calculator/UsageCounter';
import type { UserTier } from '@/types/tier';

const Results = dynamic(() => import('./Results'), { ssr: false, loading: () => <ResultsSkeleton /> });
const DealQuery = dynamic(() => import('./DealQuery'), { ssr: false });

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
  tier?: UserTier;
  onUpgrade?: () => void;
}

type EffectiveTier = UserTier;

export default function Calculator({ tier = 'free', onUpgrade }: CalculatorProps) {
  // ── Custom hooks ───────────────────────────────────────────────────────────
  const [state, actions, wasRestored] = useCalculatorState();
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
    onLimitReached: () => {
      setPaywallReason('pro_feature');
      setShowPaywall(true);
    },
  });

  // ── Local UI state (not form-related) ──────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'report_upsell' | 'pro_feature'>('report_upsell');
  const [reportPurchaseId, setReportPurchaseId] = useState<string | null>(null);
  const [reportVerified, setReportVerified] = useState(false);
  const [pendingAreaSwitch, setPendingAreaSwitch] = useState<TherapeuticArea | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hadPrefillRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevResultRef = useRef(calc.result);

  // Show toast when form was restored from localStorage
  useEffect(() => {
    if (wasRestored) {
      toast.info('Form restored from your last session', { duration: 3000 });
    }
  }, [wasRestored]);

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
  // Also load share token data to pre-fill the calculator
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report');
    const shareToken = params.get('token');

    if (reportId) {
      setReportPurchaseId(reportId);
      fetch(`/api/report-purchase/${reportId}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'completed') {
            setReportVerified(true);
            // Pre-fill from purchased report's calculation inputs and auto-calculate
            if (data.calculationInputs) {
              const inp = data.calculationInputs;
              const patch: Record<string, unknown> = { showTemplates: false, quickMode: false };
              if (inp.therapeuticArea) patch.therapeuticArea = inp.therapeuticArea;
              if (inp.modality) patch.modality = inp.modality;
              if (inp.phase) patch.phase = inp.phase;
              if (inp.indication) patch.indication = inp.indication;
              if (inp.territory) patch.territory = inp.territory;
              if (inp.dealType) patch.dealType = inp.dealType;
              if (Object.keys(patch).length > 1) {
                actions.bulkSet(patch as Partial<typeof state>);
                // Auto-calculate after pre-fill so the report buyer sees results immediately
                try {
                  const fullState = { ...state, ...patch };
                  const calcInput = buildCalculationInput(fullState as typeof state);
                  calc.setResult(calculateDealTerms(calcInput));
                } catch { /* Calculation will be triggered manually */ }
              }
            }
          }
        })
        .catch(() => {/* Report verification failed */});
    }

    // Pre-fill from share token (for cold email recipients)
    if (shareToken && !reportId) {
      fetch(`/api/share/${shareToken}`)
        .then(r => r.json())
        .then(data => {
          if (data.inputs) {
            const inp = data.inputs;
            const patch: Record<string, unknown> = {};
            if (inp.therapeuticArea) patch.therapeuticArea = inp.therapeuticArea;
            if (inp.modality) patch.modality = inp.modality;
            if (inp.phase) patch.phase = inp.phase;
            if (inp.indication) patch.indication = inp.indication;
            if (inp.territory) patch.territory = inp.territory;
            if (inp.dealType) patch.dealType = inp.dealType;
            if (Object.keys(patch).length > 0) {
              actions.bulkSet(patch as Partial<typeof state>);
            }
          }
        })
        .catch(() => {/* Share token fetch failed */});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Reset form to fresh state — no pre-selected TA, show templates
        actions.reset();
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
    const urlTA = params.get('therapeuticArea');
    const urlDealType = params.get('dealType');

    if (urlPhase || urlModality || urlIndication) {
      const patch: Partial<CalculatorFormState> = { showTemplates: false, quickMode: false };
      if (urlTA) patch.therapeuticArea = urlTA as TherapeuticArea;
      if (urlPhase) patch.phase = urlPhase as Phase;
      if (urlDealType) patch.dealType = urlDealType as DealType;
      if (urlModality) patch.modality = urlModality as Modality;
      if (urlIndication) patch.indication = urlIndication as Indication;
      actions.bulkSet(patch);

      const patchedState = {
        ...state,
        ...(urlTA ? { therapeuticArea: urlTA as TherapeuticArea } : {}),
        ...(urlPhase ? { phase: urlPhase as Phase } : {}),
        ...(urlDealType ? { dealType: urlDealType as DealType } : {}),
        ...(urlModality ? { modality: urlModality as Modality } : {}),
        ...(urlIndication ? { indication: urlIndication as Indication } : {}),
      };
      calc.setResult(calculateDealTerms(buildCalculationInput(patchedState)));

      // Clean up URL params after applying
      const url = new URL(window.location.href);
      ['therapeuticArea', 'phase', 'dealType', 'modality', 'indication'].forEach(p => url.searchParams.delete(p));
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
      return;
    }

    // First-time visitors see templates/TA selection — no auto-calculation.
    // Users must select their therapeutic area and inputs before seeing results.
    // Auto-calculation only happens when restoring from session storage (line 289+)
    // or when applying a template (handleApplyTemplate).
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
                  {state.therapeuticArea === 'metabolic' ? 'Metabolic / Obesity' : state.therapeuticArea === 'neurology' ? 'Neurology / CNS' : state.therapeuticArea === 'immunology' ? 'Immunology / Autoimmune' : state.therapeuticArea === 'rareDisease' ? 'Rare Disease' : state.therapeuticArea === 'hematology' ? 'Hematology' : state.therapeuticArea === 'dermatology' ? 'Dermatology' : state.therapeuticArea === 'gastroenterology' ? 'Gastroenterology / IBD' : 'Oncology'} Solidus
                </h2>
                <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
                  {BENCHMARK_VERSION.LABEL}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-gradient-subtle">
          {/* Usage Counter */}
          <div className="mb-4">
            <UsageCounter
              remaining={calc.remainingCalcs}
              tier={tier}
              onUpgrade={() => { setPaywallReason('pro_feature'); setShowPaywall(true); }}
            />
          </div>

          {/* Therapeutic Area Selector */}
          <TherapeuticAreaSelector
            therapeuticArea={state.therapeuticArea}
            onSelect={performAreaSwitch}
            onConfirmSwitch={(newArea) => setPendingAreaSwitch(newArea)}
            hasResult={!!calc.result}
          />

          {/* Quick-Calc: 3 prominent fields + Calculate button */}
          {!showAdvanced && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <CustomSelect
                  label="Phase"
                  value={state.phase}
                  onChange={(v) => { trackParameterChange('phase', state.phase, v); actions.setPhase(v as Phase); }}
                  options={phaseOptions}
                  placeholder="Select phase..."
                />
                <CustomSelect
                  label="Modality"
                  value={state.modality}
                  onChange={(v) => { trackParameterChange('modality', state.modality, v); actions.setModality(v as Modality); }}
                  groupedOptions={(() => {
                    const modalityMap: Record<TherapeuticArea, GroupedOption[]> = {
                      oncology: modalityOptions, neurology: neurologyModalityOptions, immunology: immunologyModalityOptions,
                      metabolic: metabolicModalityOptions, cardiovascular: cardiovascularModalityOptions,
                      infectiousDisease: infectiousDiseaseModalityOptions, ophthalmology: ophthalmologyModalityOptions,
                      womensHealth: womensHealthModalityOptions, rareDisease: rareDiseaseModalityOptions,
                      hematology: hematologyModalityOptions, dermatology: dermatologyModalityOptions,
                      gastroenterology: gastroenterologyModalityOptions,
                    };
                    return modalityMap[state.therapeuticArea] || modalityOptions;
                  })()}
                  placeholder="Select modality..."
                />
                <CustomSelect
                  label="Deal Type"
                  value={state.dealType}
                  onChange={(v) => { trackParameterChange('dealType', state.dealType, v); actions.setDealType(v as DealType); }}
                  options={dealTypeOptions}
                  placeholder="Select deal type..."
                />
              </div>

              {/* Calculate button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => calc.handleCalculate(state)}
                  disabled={calc.isCalculating || (state.phase === '' && state.modality === '')}
                  className="flex-1 sm:flex-none px-8 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {calc.isCalculating ? 'Calculating...' : 'Calculate Deal Terms'}
                </button>
                <button
                  onClick={() => setShowAdvanced(true)}
                  className="text-sm text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Advanced options
                </button>
              </div>

              {/* Live preview strip */}
              <LiveDealPreview
                totalDealValue={previewResult.terms.totalDealValue}
                upfront={previewResult.terms.upfront}
              />
            </div>
          )}

          {/* Advanced: Full wizard + Live Preview layout */}
          {showAdvanced && (
          <>
          <div className="mb-4">
            <button
              onClick={() => setShowAdvanced(false)}
              className="text-sm text-slate-400 hover:text-teal-400 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to quick calculator
            </button>
          </div>
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
                  dealType: (state.dealType || 'licensing') as DealType,
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
                      <>
                        <AssetDetailsSection
                          therapeuticArea={state.therapeuticArea}
                          phase={(state.phase || '') as Phase}
                          dealType={(state.dealType || '') as DealType}
                          modality={(state.modality || '') as Modality}
                          indication={(state.indication || '') as Indication}
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
                          deliveryRoute={state.deliveryRoute}
                          onDeliveryRouteChange={(newValue) => { actions.setDeliveryRoute(newValue); }}
                        />
                        {/* R23 (2026-04-13): BD-facing peak sales override. Renders only when
                            indication is selected so users see the engine default to compare against. */}
                        {state.indication && (
                          <PeakSalesOverrideInput
                            value={state.peakSalesOverrideM}
                            onChange={actions.setPeakSalesOverrideM}
                            indicationName={state.indication}
                            engineDefaultM={getIndicationTypicalAssetPeak(state.indication) ?? undefined}
                            // R60d: cohort lookup via /api/deals/peak-sales-consensus
                            therapeuticArea={state.therapeuticArea}
                            indicationSlug={state.indication}
                            phase={state.phase || undefined}
                            // R63: branded-asset lookup (Enhertu, Ozempic etc.)
                            assetName={state.assetName}
                            onAssetNameChange={actions.setAssetName}
                          />
                        )}
                      </>
                    );
                    break;
                  case 'target':
                    stepContent = <AdvancedOptionsSection column="left" {...advancedProps} />;
                    break;
                  case 'competitive':
                    stepContent = (
                      <div className="space-y-6">
                        <AdvancedOptionsSection column="competitive" {...advancedProps} />
                        <MolecularTargetSelector
                          therapeuticArea={state.therapeuticArea}
                          indication={state.indication}
                          modality={state.modality}
                          selectedTargets={state.molecularTargets}
                          onToggle={actions.toggleMolecularTarget}
                        />
                        <AssetDifferentiationSection
                          selectedFactors={state.differentiationFactors}
                          onToggle={actions.toggleDifferentiationFactor}
                          phase={state.phase}
                        />
                      </div>
                    );
                    break;
                  case 'deal':
                    stepContent = <AdvancedOptionsSection column="deal-scope" {...advancedProps} />;
                    break;
                  case 'competitive-deal':
                    stepContent = (
                      <div className="space-y-8">
                        <AdvancedOptionsSection column="competitive" {...advancedProps} />
                        <MolecularTargetSelector
                          therapeuticArea={state.therapeuticArea}
                          indication={state.indication}
                          modality={state.modality}
                          selectedTargets={state.molecularTargets}
                          onToggle={actions.toggleMolecularTarget}
                        />
                        <AssetDifferentiationSection
                          selectedFactors={state.differentiationFactors}
                          onToggle={actions.toggleDifferentiationFactor}
                          phase={state.phase}
                        />
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
          </>
          )}

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
            Free account — 3 calculations with deal term estimates. <a href="/pro" className="underline hover:text-teal-400 transition-colors">Upgrade to Pro</a> for unlimited access, rNPV, Monte Carlo, and partner matching.
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

      {/* Calculation Error */}
      {calc.calculationError && !calc.isCalculating && !calc.result && (
        <div className="mt-8 p-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">Calculation Failed</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{calc.calculationError}</p>
              <button
                onClick={() => calc.handleCalculate(state)}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry Calculation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state — before first calculation */}
      {!calc.result && !calc.isCalculating && !calc.calculationError && (
        <div className="mt-8 p-8 sm:p-12 rounded-2xl border border-slate-700/50 bg-slate-800/30 text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-teal-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-3">Your deal analysis will appear here</h3>
          <ul className="space-y-2 text-sm text-slate-500 max-w-xs mx-auto text-left">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-500/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Upfront payment benchmarks
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-500/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Comparable deal analysis
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-500/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Negotiation playbook
            </li>
          </ul>
        </div>
      )}

      {/* Deal Intelligence Query */}
      <div className="mt-8">
        <DealQuery
          showBlurredPreview={true}
          onUpgrade={() => { setPaywallReason('pro_feature'); setShowPaywall(true); }}
          compact={false}
        />
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
            <div ref={resultsRef} className="mt-8 results-container scroll-mt-24 relative" aria-live="polite">
              {/* Recalculation overlay — dims old results while new ones compute */}
              {calc.isCalculating && calc.result && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                  <div className="text-teal-400 animate-pulse text-lg font-medium">Recalculating...</div>
                </div>
              )}
              <Results
                result={calc.result}
                tier={(tier === 'pro' || tier === 'portfolio' ? tier : (tier === 'report' || (reportPurchaseId && reportVerified)) ? 'report' : 'free') as EffectiveTier}
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
