import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  type Phase,
  type DealType,
  type Modality,
  type Indication,
} from '@/lib/calculations';
import { incrementUsage, getUsage } from '@/lib/usage';
import { addToHistory } from '@/lib/history';
import type { CalculatorFormState } from './useCalculatorState';
import { clearSavedFormState } from './useCalculatorState';
import type { UserTier } from '@/types/tier';

/** Check if minimum fields are filled for quick-calc (phase + modality required).
 *  dealType and indication will use smart defaults if not explicitly set. */
export function isReadyToCalculate(s: CalculatorFormState): boolean {
  return s.phase !== '' && s.modality !== '';
}

/** Default indication per therapeutic area for quick-calc when user hasn't selected one. */
const DEFAULT_INDICATION: Record<string, string> = {
  oncology: 'lung_nsclc', neurology: 'alzheimers', immunology: 'ulcerativeColitis',
  metabolic: 'obesity', cardiovascular: 'heartFailure', infectiousDisease: 'hepatitisB',
  ophthalmology: 'wetAmd', womensHealth: 'endometriosis', rareDisease: 'spinalMuscularAtrophy',
  hematology: 'dlbcl', dermatology: 'atopicDermatitis', gastroenterology: 'ulcerativeColitis',
};

/** Build a CalculationInput from the full form state.
 *  Casts fields with safe fallbacks — isReadyToCalculate should be checked first. */
export function buildCalculationInput(s: CalculatorFormState): CalculationInput {
  return {
    therapeuticArea: s.therapeuticArea,
    phase: (s.phase || 'phase2') as Phase,
    dealType: (s.dealType || 'licensing') as DealType,
    modality: (s.modality || 'smallMolecule') as Modality,
    indication: (s.indication || DEFAULT_INDICATION[s.therapeuticArea] || 'lung_nsclc') as Indication,
    territory: s.territory,
    biomarker: s.biomarker,
    lineOfTherapy: s.lineOfTherapy,
    treatmentApproach: s.treatmentApproach,
    combinationPotential: s.combinationPotential,
    competitivePosition: s.competitivePosition,
    dataQuality: s.dataQuality,
    regulatoryDesignations: s.regulatoryDesignations,
    molecularTargets: s.molecularTargets.length > 0 ? s.molecularTargets : undefined,
    deliveryRoute: s.deliveryRoute || undefined,
    differentiationFactors: s.differentiationFactors.length > 0 ? s.differentiationFactors : undefined,
    peakSalesOverrideM: s.peakSalesOverrideM,  // R23
    ...(s.therapeuticArea === 'neurology' ? { bbbPenetration: s.bbbPenetration, diseaseProgression: s.diseaseProgression, biomarkerValidation: s.biomarkerValidation } : {}),
    ...(s.therapeuticArea === 'immunology' ? { immuneResetPotential: s.immuneResetPotential, targetSpecificity: s.targetSpecificity, diseaseSeverity: s.diseaseSeverity, treatmentGoal: s.treatmentGoal } : {}),
    ...(s.therapeuticArea === 'metabolic' ? { mechanismDifferentiation: s.mechanismDifferentiation, weightLossEfficacy: s.weightLossEfficacy, routeOfAdministration: s.routeOfAdministration, comorbidityBreadth: s.comorbidityBreadth, metabolicTreatmentApproach: s.metabolicTreatmentApproach } : {}),
    ...(s.therapeuticArea === 'cardiovascular' ? { cvOutcomeBenefit: s.cvOutcomeBenefit, cvTrialEndpoint: s.cvTrialEndpoint, cvPopulationRisk: s.cvPopulationRisk } : {}),
    ...(s.therapeuticArea === 'infectiousDisease' ? { resistanceProfile: s.resistanceProfile, infectionChronicity: s.infectionChronicity, publicHealthPriority: s.publicHealthPriority } : {}),
    ...(s.therapeuticArea === 'ophthalmology' ? { ocularDelivery: s.ocularDelivery, treatmentDurability: s.treatmentDurability, visionImpact: s.visionImpact } : {}),
    ...(s.therapeuticArea === 'womensHealth' ? { whTargetPopulation: s.whTargetPopulation, whUnmetNeed: s.whUnmetNeed, whRegulatory: s.whRegulatory } : {}),
    ...(s.therapeuticArea === 'rareDisease' ? { orphanDesignation: s.orphanDesignation, patientPopulationSize: s.patientPopulationSize, geneticBasis: s.geneticBasis } : {}),
    ...(s.therapeuticArea === 'hematology' ? { hemeLineage: s.hemeLineage, transplantEligibility: s.transplantEligibility, mrdStatus: s.mrdStatus } : {}),
    ...(s.therapeuticArea === 'dermatology' ? { skinSeverity: s.skinSeverity, chronicityProfile: s.chronicityProfile, topicalVsSystemic: s.topicalVsSystemic } : {}),
    ...(s.therapeuticArea === 'gastroenterology' ? { giSegment: s.giSegment, biologicExperience: s.biologicExperience, endoscopicEndpoint: s.endoscopicEndpoint } : {}),
  };
}

interface UseCalculationOptions {
  tier: UserTier;
  isAuthenticated: boolean;
  userId?: string;
  sessionId: string;
  anonymousId: string;
  trackCalculation: (
    params: { modality: string; development_phase: string; indication_category: string; indication_specific: string; territory_scope: string; deal_type?: string },
    outputs: { upfront_low: number; upfront_mid: number; upfront_high: number; milestones_total: number; royalty_low: number; royalty_high: number; total_deal_value_low: number; total_deal_value_high: number },
    count: number,
  ) => void;
  openAuthModal: (mode: 'signin' | 'signup') => void;
  onLimitReached?: () => void;
}

export interface UseCalculationReturn {
  result: CalculationResult | null;
  isCalculating: boolean;
  saveError: string | null;
  calculationError: string | null;
  setSaveError: (v: string | null) => void;
  setResult: (v: CalculationResult | null) => void;
  handleCalculate: (state: CalculatorFormState) => void;
  handleSensitivityApply: (
    state: CalculatorFormState,
    newInputs: Partial<CalculationInput>,
    bulkSet: (fields: Partial<CalculatorFormState>) => void,
  ) => void;
  calculationCountRef: React.MutableRefObject<number>;
  limitHit: boolean;
  remainingCalcs: number | null;
}

export function useCalculation(opts: UseCalculationOptions): UseCalculationReturn {
  const { tier, isAuthenticated, userId, sessionId, anonymousId, trackCalculation, openAuthModal, onLimitReached } = opts;

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const calculatingRef = useRef(false);
  const calculationCountRef = useRef(0);

  const calcLimit = tier === 'starter' ? 10 : tier === 'free' ? 3 : Infinity;
  const [limitHit, setLimitHit] = useState(false);
  const [remainingCalcs, setRemainingCalcs] = useState<number | null>(null);

  // Check limit on mount
  useEffect(() => {
    if (isAuthenticated && (tier === 'free' || tier === 'starter') && userId && calcLimit !== Infinity) {
      fetch(`/api/calculations?user_id=${userId}&count=true&month=true`)
        .then(r => r.json())
        .then(data => {
          const count = data.data?.count || 0;
          setRemainingCalcs(Math.max(0, calcLimit - count));
          if (count >= calcLimit) {
            setLimitHit(true);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, tier, userId]);

  const handleCalculate = useCallback((state: CalculatorFormState) => {
    // Require all primary fields to be selected
    if (!isReadyToCalculate(state)) {
      toast.error('Please select phase and modality before calculating.');
      return;
    }

    // Require authentication — no anonymous calculations
    if (!isAuthenticated) {
      toast.error('Create a free account to run calculations.', {
        duration: 6000,
        action: {
          label: 'Sign Up',
          onClick: () => openAuthModal('signup'),
        },
      });
      openAuthModal('signup');
      return;
    }

    // Hard block after 3 calculations for free users — triggers paywall
    if ((tier === 'free' || tier === 'starter') && limitHit) {
      onLimitReached?.();
      return;
    }

    // Prevent multiple clicks
    if (isCalculating || calculatingRef.current) return;

    calculatingRef.current = true;
    setIsCalculating(true);
    setSaveError(null);
    setCalculationError(null);

    try {
      const input = buildCalculationInput(state);
      const calculatedResult = calculateDealTerms(input);
      setResult(calculatedResult);

      calculationCountRef.current += 1;

      // Track calculation event (non-blocking)
      trackCalculation(
        {
          modality: state.modality || 'smallMolecule',
          development_phase: state.phase || 'phase2',
          indication_category: (state.indication || 'lung_nsclc').split('_')[0],
          indication_specific: state.indication || 'lung_nsclc',
          territory_scope: state.territory,
          deal_type: state.dealType || 'licensing',
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
        calculationCountRef.current,
      );

      // Save calculation to database (non-blocking background)
      fetch('/api/calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          anonymous_id: anonymousId,
          user_id: isAuthenticated && userId ? userId : null,
          therapeutic_area: state.therapeuticArea,
          modality: state.modality,
          development_phase: state.phase,
          indication_category: state.indication.split('_')[0],
          indication_specific: state.indication,
          territory_scope: state.territory,
          deal_type: state.dealType,
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

      // Track user TA/modality preferences for personalization
      try {
        const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{"tas":[],"modalities":[]}');
        prefs.tas.push(state.therapeuticArea);
        prefs.modalities.push(state.modality || 'smallMolecule');
        // Keep last 10 entries
        prefs.tas = prefs.tas.slice(-10);
        prefs.modalities = prefs.modalities.slice(-10);
        localStorage.setItem('user_prefs', JSON.stringify(prefs));
      } catch {
        // localStorage may be unavailable — non-fatal
      }

      // Save to local history (sync, fast)
      addToHistory({
        inputs: {
          therapeuticArea: state.therapeuticArea,
          phase: state.phase || 'phase2',
          modality: state.modality || 'smallMolecule',
          indication: state.indication || 'lung_nsclc',
          territory: state.territory,
          biomarker: state.biomarker,
          lineOfTherapy: state.lineOfTherapy,
          treatmentApproach: state.treatmentApproach,
          combinationPotential: state.combinationPotential,
          competitivePosition: state.competitivePosition,
          dataQuality: state.dataQuality,
          dealType: state.dealType || 'licensing',
          regulatoryDesignations: state.regulatoryDesignations,
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

      // Clear wizard progress and saved form state (fresh start next time)
      sessionStorage.removeItem('wizard_progress');
      clearSavedFormState();

      // Increment usage + check if limit reached (free tier only)
      if (tier === 'free' || tier === 'starter') {
        incrementUsage();
        calculationCountRef.current++;
        setRemainingCalcs(prev => prev !== null ? Math.max(0, prev - 1) : null);
        if (calculationCountRef.current >= calcLimit) {
          setLimitHit(true);
        }
      }

      // Scroll to results (deferred to next frame so DOM updates first)
      requestAnimationFrame(() => {
        document.querySelector('.results-container')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculationError('Calculation failed. Please check your inputs and try again.');
      toast.error('Calculation failed. Please try again.');
    } finally {
      setIsCalculating(false);
      calculatingRef.current = false;
    }
  }, [isAuthenticated, isCalculating, tier, sessionId, anonymousId, userId, trackCalculation, openAuthModal]);

  const handleSensitivityApply = useCallback((
    state: CalculatorFormState,
    newInputs: Partial<CalculationInput>,
    bulkSet: (fields: Partial<CalculatorFormState>) => void,
  ) => {
    try {
      // Merge new inputs with current state
      const mergedInputs: CalculationInput = {
        therapeuticArea: (newInputs.therapeuticArea ?? state.therapeuticArea),
        phase: (newInputs.phase ?? (state.phase || 'phase2')) as Phase,
        modality: (newInputs.modality ?? (state.modality || 'smallMolecule')) as Modality,
        indication: (newInputs.indication ?? (state.indication || 'lung_nsclc')) as Indication,
        territory: (newInputs.territory ?? state.territory),
        biomarker: (newInputs.biomarker ?? state.biomarker),
        lineOfTherapy: (newInputs.lineOfTherapy ?? state.lineOfTherapy),
        treatmentApproach: (newInputs.treatmentApproach ?? state.treatmentApproach),
        combinationPotential: (newInputs.combinationPotential ?? state.combinationPotential),
        competitivePosition: (newInputs.competitivePosition ?? state.competitivePosition),
        dataQuality: (newInputs.dataQuality ?? state.dataQuality),
        regulatoryDesignations: newInputs.regulatoryDesignations || state.regulatoryDesignations,
        ...(state.therapeuticArea === 'neurology' ? {
          bbbPenetration: (newInputs.bbbPenetration ?? state.bbbPenetration),
          diseaseProgression: (newInputs.diseaseProgression ?? state.diseaseProgression),
          biomarkerValidation: (newInputs.biomarkerValidation ?? state.biomarkerValidation),
        } : {}),
        ...(state.therapeuticArea === 'immunology' ? {
          immuneResetPotential: (newInputs.immuneResetPotential ?? state.immuneResetPotential),
          targetSpecificity: (newInputs.targetSpecificity ?? state.targetSpecificity),
          diseaseSeverity: (newInputs.diseaseSeverity ?? state.diseaseSeverity),
          treatmentGoal: (newInputs.treatmentGoal ?? state.treatmentGoal),
        } : {}),
        ...(state.therapeuticArea === 'metabolic' ? {
          mechanismDifferentiation: (newInputs.mechanismDifferentiation ?? state.mechanismDifferentiation),
          weightLossEfficacy: (newInputs.weightLossEfficacy ?? state.weightLossEfficacy),
          routeOfAdministration: (newInputs.routeOfAdministration ?? state.routeOfAdministration),
          comorbidityBreadth: (newInputs.comorbidityBreadth ?? state.comorbidityBreadth),
          metabolicTreatmentApproach: (newInputs.metabolicTreatmentApproach ?? state.metabolicTreatmentApproach),
        } : {}),
      };

      // Update form state to stay in sync
      bulkSet(newInputs as Partial<CalculatorFormState>);

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
          calculationCountRef.current,
        );
      } catch (trackError) {
        console.error('Error tracking sensitivity calculation:', trackError);
      }
    } catch (error) {
      console.error('Error applying sensitivity changes:', error);
    }
  }, [trackCalculation]);

  return {
    result,
    isCalculating,
    saveError,
    calculationError,
    setSaveError,
    setResult,
    handleCalculate,
    handleSensitivityApply,
    calculationCountRef,
    limitHit,
    remainingCalcs,
  };
}
