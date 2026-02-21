import { useReducer, useCallback, useMemo } from 'react';
import type {
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
import type { DealTemplate } from './types';

// ── State shape ──────────────────────────────────────────────────────────────

export interface CalculatorFormState {
  // Core form fields
  therapeuticArea: TherapeuticArea;
  phase: Phase;
  modality: Modality;
  indication: Indication;
  territory: Territory;
  biomarker: BiomarkerStatus;
  lineOfTherapy: LineOfTherapy;
  treatmentApproach: TreatmentApproach;
  combinationPotential: CombinationPotential;
  competitivePosition: CompetitivePosition;
  dataQuality: DataQuality;
  regulatoryDesignations: RegulatoryDesignations;
  // Neurology-specific
  bbbPenetration: BBBPenetration;
  diseaseProgression: DiseaseProgression;
  biomarkerValidation: BiomarkerValidation;
  // Immunology-specific
  immuneResetPotential: ImmuneResetPotential;
  targetSpecificity: TargetSpecificity;
  diseaseSeverity: DiseaseSeverity;
  treatmentGoal: ImmunologyTreatmentGoal;
  // Metabolic-specific
  mechanismDifferentiation: MechanismDifferentiation;
  weightLossEfficacy: WeightLossEfficacy;
  routeOfAdministration: RouteOfAdministration;
  comorbidityBreadth: ComorbidityBreadth;
  metabolicTreatmentApproach: MetabolicTreatmentApproach;
  // UI state
  wizardStep: number;
  quickMode: boolean;
  showTemplates: boolean;
  highlightedFields: Set<string>;
}

export const INITIAL_STATE: CalculatorFormState = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'smallMolecule',
  indication: 'lung_nsclc',
  territory: 'global',
  biomarker: 'unselected',
  lineOfTherapy: '2L',
  treatmentApproach: 'symptomatic',
  combinationPotential: 'some',
  competitivePosition: 'racing',
  dataQuality: 'promising',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  bbbPenetration: 'unproven',
  diseaseProgression: 'moderateProgressive',
  biomarkerValidation: 'noBiomarker',
  immuneResetPotential: 'chronicTreatment',
  targetSpecificity: 'pathwayTargeted',
  diseaseSeverity: 'moderateSevere',
  treatmentGoal: 'remissionInduction',
  mechanismDifferentiation: 'incretinBased',
  weightLossEfficacy: 'competitiveEfficacy',
  routeOfAdministration: 'injectable',
  comorbidityBreadth: 'obesityPrimary',
  metabolicTreatmentApproach: 'chronicWeightMgmt',
  wizardStep: 0,
  quickMode: true,
  showTemplates: true,
  highlightedFields: new Set(),
};

// ── Actions ──────────────────────────────────────────────────────────────────

type CalculatorAction =
  | { type: 'SET_FIELD'; field: keyof CalculatorFormState; value: CalculatorFormState[keyof CalculatorFormState] }
  | { type: 'SET_THERAPEUTIC_AREA'; area: TherapeuticArea }
  | { type: 'APPLY_TEMPLATE'; template: DealTemplate }
  | { type: 'SET_STEP'; step: number }
  | { type: 'TOGGLE_REGULATORY'; designation: keyof RegulatoryDesignations }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'BULK_SET'; fields: Partial<CalculatorFormState> }
  | { type: 'RESET' };

function reducer(state: CalculatorFormState, action: CalculatorAction): CalculatorFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'SET_THERAPEUTIC_AREA': {
      const base: Partial<CalculatorFormState> = {
        therapeuticArea: action.area,
        showTemplates: true,
      };
      if (action.area === 'neurology') {
        return { ...state, ...base, indication: 'alzheimers' as Indication, modality: 'smallMolecule', treatmentApproach: 'symptomatic' };
      }
      if (action.area === 'immunology') {
        return {
          ...state, ...base,
          indication: 'ulcerativeColitis' as Indication,
          modality: 'mab' as Modality,
          treatmentGoal: 'remissionInduction',
          immuneResetPotential: 'chronicTreatment',
          targetSpecificity: 'pathwayTargeted',
          diseaseSeverity: 'moderateSevere',
        };
      }
      if (action.area === 'metabolic') {
        return {
          ...state, ...base,
          indication: 'obesity' as Indication,
          modality: 'glp1Agonist' as Modality,
          metabolicTreatmentApproach: 'chronicWeightMgmt',
          mechanismDifferentiation: 'incretinBased',
          weightLossEfficacy: 'competitiveEfficacy',
          routeOfAdministration: 'injectable',
          comorbidityBreadth: 'obesityPrimary',
        };
      }
      // oncology
      return { ...state, ...base, indication: 'lung_nsclc' as Indication, modality: 'smallMolecule', lineOfTherapy: '2L' };
    }

    case 'APPLY_TEMPLATE': {
      const { values } = action.template;
      const fieldsSet = new Set<string>();
      const patch: Partial<CalculatorFormState> = {};
      for (const [key, val] of Object.entries(values)) {
        if (val !== undefined) {
          (patch as Record<string, unknown>)[key] = val;
          fieldsSet.add(key);
        }
      }
      return {
        ...state,
        ...patch,
        highlightedFields: fieldsSet,
        showTemplates: false,
        quickMode: false,
        wizardStep: 0,
      };
    }

    case 'SET_STEP':
      return { ...state, wizardStep: action.step };

    case 'TOGGLE_REGULATORY':
      return {
        ...state,
        regulatoryDesignations: {
          ...state.regulatoryDesignations,
          [action.designation]: !state.regulatoryDesignations[action.designation],
        },
      };

    case 'CLEAR_HIGHLIGHTS':
      return { ...state, highlightedFields: new Set() };

    case 'BULK_SET': {
      const next = { ...state };
      for (const [key, val] of Object.entries(action.fields)) {
        if (val !== undefined) {
          (next as Record<string, unknown>)[key] = val;
        }
      }
      return next;
    }

    case 'RESET':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

// ── Hook return type ─────────────────────────────────────────────────────────

export interface CalculatorActions {
  setTherapeuticArea: (v: TherapeuticArea) => void;
  setPhase: (v: Phase) => void;
  setModality: (v: Modality) => void;
  setIndication: (v: Indication) => void;
  setTerritory: (v: Territory) => void;
  setBiomarker: (v: BiomarkerStatus) => void;
  setLineOfTherapy: (v: LineOfTherapy) => void;
  setTreatmentApproach: (v: TreatmentApproach) => void;
  setCombinationPotential: (v: CombinationPotential) => void;
  setCompetitivePosition: (v: CompetitivePosition) => void;
  setDataQuality: (v: DataQuality) => void;
  setRegulatoryDesignations: (v: RegulatoryDesignations) => void;
  setBbbPenetration: (v: BBBPenetration) => void;
  setDiseaseProgression: (v: DiseaseProgression) => void;
  setBiomarkerValidation: (v: BiomarkerValidation) => void;
  setImmuneResetPotential: (v: ImmuneResetPotential) => void;
  setTargetSpecificity: (v: TargetSpecificity) => void;
  setDiseaseSeverity: (v: DiseaseSeverity) => void;
  setTreatmentGoal: (v: ImmunologyTreatmentGoal) => void;
  setMechanismDifferentiation: (v: MechanismDifferentiation) => void;
  setWeightLossEfficacy: (v: WeightLossEfficacy) => void;
  setRouteOfAdministration: (v: RouteOfAdministration) => void;
  setComorbidityBreadth: (v: ComorbidityBreadth) => void;
  setMetabolicTreatmentApproach: (v: MetabolicTreatmentApproach) => void;
  setWizardStep: (v: number) => void;
  setQuickMode: (v: boolean) => void;
  setShowTemplates: (v: boolean) => void;
  toggleRegulatory: (designation: keyof RegulatoryDesignations) => void;
  applyTemplate: (template: DealTemplate) => void;
  clearHighlights: () => void;
  bulkSet: (fields: Partial<CalculatorFormState>) => void;
  switchTherapeuticArea: (area: TherapeuticArea) => void;
  reset: () => void;
  dispatch: React.Dispatch<CalculatorAction>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCalculatorState(): [CalculatorFormState, CalculatorActions] {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const actions: CalculatorActions = useMemo(() => ({
    setTherapeuticArea: (v) => dispatch({ type: 'SET_FIELD', field: 'therapeuticArea', value: v }),
    setPhase: (v) => dispatch({ type: 'SET_FIELD', field: 'phase', value: v }),
    setModality: (v) => dispatch({ type: 'SET_FIELD', field: 'modality', value: v }),
    setIndication: (v) => dispatch({ type: 'SET_FIELD', field: 'indication', value: v }),
    setTerritory: (v) => dispatch({ type: 'SET_FIELD', field: 'territory', value: v }),
    setBiomarker: (v) => dispatch({ type: 'SET_FIELD', field: 'biomarker', value: v }),
    setLineOfTherapy: (v) => dispatch({ type: 'SET_FIELD', field: 'lineOfTherapy', value: v }),
    setTreatmentApproach: (v) => dispatch({ type: 'SET_FIELD', field: 'treatmentApproach', value: v }),
    setCombinationPotential: (v) => dispatch({ type: 'SET_FIELD', field: 'combinationPotential', value: v }),
    setCompetitivePosition: (v) => dispatch({ type: 'SET_FIELD', field: 'competitivePosition', value: v }),
    setDataQuality: (v) => dispatch({ type: 'SET_FIELD', field: 'dataQuality', value: v }),
    setRegulatoryDesignations: (v) => dispatch({ type: 'SET_FIELD', field: 'regulatoryDesignations', value: v }),
    setBbbPenetration: (v) => dispatch({ type: 'SET_FIELD', field: 'bbbPenetration', value: v }),
    setDiseaseProgression: (v) => dispatch({ type: 'SET_FIELD', field: 'diseaseProgression', value: v }),
    setBiomarkerValidation: (v) => dispatch({ type: 'SET_FIELD', field: 'biomarkerValidation', value: v }),
    setImmuneResetPotential: (v) => dispatch({ type: 'SET_FIELD', field: 'immuneResetPotential', value: v }),
    setTargetSpecificity: (v) => dispatch({ type: 'SET_FIELD', field: 'targetSpecificity', value: v }),
    setDiseaseSeverity: (v) => dispatch({ type: 'SET_FIELD', field: 'diseaseSeverity', value: v }),
    setTreatmentGoal: (v) => dispatch({ type: 'SET_FIELD', field: 'treatmentGoal', value: v }),
    setMechanismDifferentiation: (v) => dispatch({ type: 'SET_FIELD', field: 'mechanismDifferentiation', value: v }),
    setWeightLossEfficacy: (v) => dispatch({ type: 'SET_FIELD', field: 'weightLossEfficacy', value: v }),
    setRouteOfAdministration: (v) => dispatch({ type: 'SET_FIELD', field: 'routeOfAdministration', value: v }),
    setComorbidityBreadth: (v) => dispatch({ type: 'SET_FIELD', field: 'comorbidityBreadth', value: v }),
    setMetabolicTreatmentApproach: (v) => dispatch({ type: 'SET_FIELD', field: 'metabolicTreatmentApproach', value: v }),
    setWizardStep: (v) => dispatch({ type: 'SET_STEP', step: v }),
    setQuickMode: (v) => dispatch({ type: 'SET_FIELD', field: 'quickMode', value: v }),
    setShowTemplates: (v) => dispatch({ type: 'SET_FIELD', field: 'showTemplates', value: v }),
    toggleRegulatory: (d) => dispatch({ type: 'TOGGLE_REGULATORY', designation: d }),
    applyTemplate: (t) => dispatch({ type: 'APPLY_TEMPLATE', template: t }),
    clearHighlights: () => dispatch({ type: 'CLEAR_HIGHLIGHTS' }),
    bulkSet: (fields) => dispatch({ type: 'BULK_SET', fields }),
    switchTherapeuticArea: (area) => dispatch({ type: 'SET_THERAPEUTIC_AREA', area }),
    reset: () => dispatch({ type: 'RESET' }),
    dispatch,
  }), [dispatch]);

  return [state, actions];
}
