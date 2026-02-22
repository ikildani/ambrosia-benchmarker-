import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
} from '@/lib/calculations';
import { incrementUsage, getUsage } from '@/lib/usage';
import { addToHistory } from '@/lib/history';
import type { CalculatorFormState } from './useCalculatorState';

/** Build a CalculationInput from the full form state. */
export function buildCalculationInput(s: CalculatorFormState): CalculationInput {
  return {
    therapeuticArea: s.therapeuticArea,
    phase: s.phase,
    modality: s.modality,
    indication: s.indication,
    territory: s.territory,
    biomarker: s.biomarker,
    lineOfTherapy: s.lineOfTherapy,
    treatmentApproach: s.treatmentApproach,
    combinationPotential: s.combinationPotential,
    competitivePosition: s.competitivePosition,
    dataQuality: s.dataQuality,
    regulatoryDesignations: s.regulatoryDesignations,
    ...(s.therapeuticArea === 'neurology' ? { bbbPenetration: s.bbbPenetration, diseaseProgression: s.diseaseProgression, biomarkerValidation: s.biomarkerValidation } : {}),
    ...(s.therapeuticArea === 'immunology' ? { immuneResetPotential: s.immuneResetPotential, targetSpecificity: s.targetSpecificity, diseaseSeverity: s.diseaseSeverity, treatmentGoal: s.treatmentGoal } : {}),
    ...(s.therapeuticArea === 'metabolic' ? { mechanismDifferentiation: s.mechanismDifferentiation, weightLossEfficacy: s.weightLossEfficacy, routeOfAdministration: s.routeOfAdministration, comorbidityBreadth: s.comorbidityBreadth, metabolicTreatmentApproach: s.metabolicTreatmentApproach } : {}),
  };
}

interface UseCalculationOptions {
  tier: 'free' | 'pro' | 'report';
  isAuthenticated: boolean;
  userId?: string;
  sessionId: string;
  anonymousId: string;
  trackCalculation: (
    params: { modality: string; development_phase: string; indication_category: string; indication_specific: string; territory_scope: string },
    outputs: { upfront_low: number; upfront_mid: number; upfront_high: number; milestones_total: number; royalty_low: number; royalty_high: number; total_deal_value_low: number; total_deal_value_high: number },
    count: number,
  ) => void;
  openAuthModal: (mode: 'signin' | 'signup') => void;
}

export interface UseCalculationReturn {
  result: CalculationResult | null;
  isCalculating: boolean;
  saveError: string | null;
  setSaveError: (v: string | null) => void;
  setResult: (v: CalculationResult | null) => void;
  handleCalculate: (state: CalculatorFormState) => void;
  handleSensitivityApply: (
    state: CalculatorFormState,
    newInputs: Partial<CalculationInput>,
    bulkSet: (fields: Partial<CalculatorFormState>) => void,
  ) => void;
  calculationCountRef: React.MutableRefObject<number>;
}

export function useCalculation(opts: UseCalculationOptions): UseCalculationReturn {
  const { tier, isAuthenticated, userId, sessionId, anonymousId, trackCalculation, openAuthModal } = opts;

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const calculatingRef = useRef(false);
  const calculationCountRef = useRef(0);

  const handleCalculate = useCallback((state: CalculatorFormState) => {
    // Gate 4th+ calculation behind account creation for anonymous users
    if (!isAuthenticated && getUsage().count >= 3) {
      openAuthModal('signup');
      return;
    }

    // Prevent multiple clicks
    if (isCalculating || calculatingRef.current) return;

    calculatingRef.current = true;
    setIsCalculating(true);
    setSaveError(null);

    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          const input = buildCalculationInput(state);
          const calculatedResult = calculateDealTerms(input);
          setResult(calculatedResult);

          calculationCountRef.current += 1;

          // Track calculation event
          trackCalculation(
            {
              modality: state.modality,
              development_phase: state.phase,
              indication_category: state.indication.split('_')[0],
              indication_specific: state.indication,
              territory_scope: state.territory,
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

          // Save calculation to database (non-blocking)
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

          // Save to local history
          addToHistory({
            inputs: {
              therapeuticArea: state.therapeuticArea,
              phase: state.phase,
              modality: state.modality,
              indication: state.indication,
              territory: state.territory,
              biomarker: state.biomarker,
              lineOfTherapy: state.lineOfTherapy,
              treatmentApproach: state.treatmentApproach,
              combinationPotential: state.combinationPotential,
              competitivePosition: state.competitivePosition,
              dataQuality: state.dataQuality,
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

          // Clear wizard progress
          sessionStorage.removeItem('wizard_progress');

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
        phase: (newInputs.phase ?? state.phase),
        modality: (newInputs.modality ?? state.modality),
        indication: (newInputs.indication ?? state.indication),
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
    setSaveError,
    setResult,
    handleCalculate,
    handleSensitivityApply,
    calculationCountRef,
  };
}
