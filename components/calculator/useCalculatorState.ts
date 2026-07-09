import { useReducer, useCallback, useMemo, useEffect, useRef, useState } from 'react';
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
import type { DeliveryRoute } from '@/lib/financial/delivery-routes';
import { getFieldResets } from '@/lib/input-filters';

// ── State shape ──────────────────────────────────────────────────────────────

export interface CalculatorFormState {
  // Core form fields — empty string means "not yet selected" (fresh calculation)
  therapeuticArea: TherapeuticArea;
  phase: Phase | '';
  dealType: DealType | '';
  modality: Modality | '';
  indication: Indication | '';
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
  // Cardiovascular-specific
  cvOutcomeBenefit: CVOutcomeBenefit;
  cvTrialEndpoint: CVTrialEndpoint;
  cvPopulationRisk: CVPopulationRisk;
  // Infectious Disease-specific
  resistanceProfile: ResistanceProfile;
  infectionChronicity: InfectionChronicity;
  publicHealthPriority: PublicHealthPriority;
  // Ophthalmology-specific
  ocularDelivery: OcularDelivery;
  treatmentDurability: TreatmentDurability;
  visionImpact: VisionImpact;
  // Women's Health-specific
  whTargetPopulation: WHTargetPopulation;
  whUnmetNeed: WHUnmetNeed;
  whRegulatory: WHRegulatory;
  // Rare Disease-specific
  orphanDesignation: OrphanDesignation;
  patientPopulationSize: PatientPopulationSize;
  geneticBasis: GeneticBasis;
  // Hematology-specific
  hemeLineage: HemeLineage;
  transplantEligibility: TransplantEligibility;
  mrdStatus: MRDStatus;
  // Dermatology-specific
  skinSeverity: SkinSeverity;
  chronicityProfile: ChronicityProfile;
  topicalVsSystemic: TopicalVsSystemic;
  // Gastroenterology-specific
  giSegment: GISegment;
  biologicExperience: BiologicExperience;
  endoscopicEndpoint: EndoscopicEndpoint;
  // Cross-TA: molecular targets and delivery route
  molecularTargets: string[];
  deliveryRoute: DeliveryRoute | '';

  // Asset differentiation factors — additive premium on competitive position.
  // Array of selected DifferentiationKey values from differentiation-profiles.ts.
  differentiationFactors: string[];

  // Round 23 (2026-04-13): Asset-specific peak sales override.
  // When set (>0), this value replaces the engine's indication-based peak
  // anchor. BD users who have their own analyst consensus peak should
  // enter it here — it propagates to the engine as `peakSalesEstimate.median`.
  // null/undefined or 0 = use engine default based on indication/TA.
  peakSalesOverrideM: number | null;

  // R63 (2026-04-14): Asset name — used to look up brand/INN in the
  // ASSET_PEAK_SALES_TABLE (222 curated blockbuster + pipeline assets).
  // When matched, the calculator surfaces "{brand}: $X peak" and offers a
  // one-click Use-consensus action. Optional — empty string means user
  // didn't provide a specific asset.
  assetName: string;

  // UI state
  wizardStep: number;
  quickMode: boolean;
  /** @deprecated Templates removed — kept for backwards compatibility with serialized state */
  showTemplates: boolean;
  highlightedFields: Set<string>;
}

export const INITIAL_STATE: CalculatorFormState = {
  therapeuticArea: 'oncology', // TA must be set for form rendering; user picks from selector
  phase: '',          // Not yet selected — user must choose
  dealType: '',       // Not yet selected — user must choose
  modality: '',       // Not yet selected — user must choose
  indication: '',     // Not yet selected — user must choose
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
  cvOutcomeBenefit: 'hospitalizationReduction',
  cvTrialEndpoint: 'surrogateBiomarker',
  cvPopulationRisk: 'moderateRisk',
  resistanceProfile: 'existingClassImproved',
  infectionChronicity: 'acute',
  publicHealthPriority: 'standard',
  ocularDelivery: 'intravitreal',
  treatmentDurability: 'chronicInjection',
  visionImpact: 'visionImpairing',
  whTargetPopulation: 'reproductiveAge',
  whUnmetNeed: 'inadequateOptions',
  whRegulatory: 'standardPathway',
  orphanDesignation: 'none',
  patientPopulationSize: 'rare_1k_10k',
  geneticBasis: 'unknown_genetic',
  hemeLineage: 'lymphoid',
  transplantEligibility: 'transplant_eligible',
  mrdStatus: 'standard_response',
  skinSeverity: 'moderate',
  chronicityProfile: 'chronic_relapsing',
  topicalVsSystemic: 'systemic_only',
  giSegment: 'colonic',
  biologicExperience: 'biologic_naive',
  endoscopicEndpoint: 'endoscopic_improvement',
  molecularTargets: [],   // No targets selected by default — engine uses neutral modifier
  deliveryRoute: '',      // Empty = engine infers from modality or uses neutral
  differentiationFactors: [],  // No differentiation factors selected by default
  peakSalesOverrideM: null,  // R23: null = use engine default
  assetName: '',  // R63: empty = no branded lookup
  wizardStep: 0,
  quickMode: true,
  showTemplates: false,
  highlightedFields: new Set(),
};

// ── Actions ──────────────────────────────────────────────────────────────────

type CalculatorAction =
  | { type: 'SET_FIELD'; field: keyof CalculatorFormState; value: CalculatorFormState[keyof CalculatorFormState] }
  | { type: 'SET_THERAPEUTIC_AREA'; area: TherapeuticArea }
  | { type: 'SET_STEP'; step: number }
  | { type: 'TOGGLE_REGULATORY'; designation: keyof RegulatoryDesignations }
  | { type: 'TOGGLE_DIFFERENTIATION'; key: string }
  | { type: 'CLEAR_HIGHLIGHTS' }
  | { type: 'BULK_SET'; fields: Partial<CalculatorFormState> }
  | { type: 'RESET' };

function reducer(state: CalculatorFormState, action: CalculatorAction): CalculatorFormState {
  switch (action.type) {
    case 'SET_FIELD': {
      let next = { ...state, [action.field]: action.value };
      // Auto-reset dependent fields when dealType or phase changes
      if (action.field === 'dealType' || action.field === 'phase') {
        const resets = getFieldResets(
          action.field as 'dealType' | 'phase',
          action.value as string,
          { phase: next.phase, dealType: next.dealType, territory: next.territory },
        );
        if (resets) {
          next = { ...next, ...resets };
        }
      }
      return next;
    }

    case 'SET_THERAPEUTIC_AREA': {
      const base: Partial<CalculatorFormState> = {
        therapeuticArea: action.area,
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
      if (action.area === 'cardiovascular') {
        return {
          ...state, ...base,
          indication: 'heartFailure' as Indication,
          modality: 'smallMolecule' as Modality,
          cvOutcomeBenefit: 'hospitalizationReduction',
          cvTrialEndpoint: 'surrogateBiomarker',
          cvPopulationRisk: 'moderateRisk',
        };
      }
      if (action.area === 'infectiousDisease') {
        return {
          ...state, ...base,
          indication: 'hepatitisB' as Indication,
          modality: 'antiviral' as Modality,
          resistanceProfile: 'existingClassImproved',
          infectionChronicity: 'chronic',
          publicHealthPriority: 'standard',
        };
      }
      if (action.area === 'ophthalmology') {
        return {
          ...state, ...base,
          indication: 'wetAmd' as Indication,
          modality: 'antiVegf' as Modality,
          ocularDelivery: 'intravitreal',
          treatmentDurability: 'chronicInjection',
          visionImpact: 'visionThreatening',
        };
      }
      if (action.area === 'womensHealth') {
        return {
          ...state, ...base,
          indication: 'endometriosis' as Indication,
          modality: 'gnrhAntagonist' as Modality,
          whTargetPopulation: 'reproductiveAge',
          whUnmetNeed: 'inadequateOptions',
          whRegulatory: 'standardPathway',
        };
      }
      if (action.area === 'rareDisease') {
        return {
          ...state, ...base,
          indication: 'spinalMuscularAtrophy' as Indication,
          modality: 'geneTherapy' as Modality,
          orphanDesignation: 'both_orphan',
          patientPopulationSize: 'rare_1k_10k',
          geneticBasis: 'monogenic_validated',
        };
      }
      if (action.area === 'hematology') {
        return {
          ...state, ...base,
          indication: 'dlbcl' as Indication,
          modality: 'carT_heme' as Modality,
          hemeLineage: 'lymphoid',
          transplantEligibility: 'transplant_eligible',
          mrdStatus: 'standard_response',
        };
      }
      if (action.area === 'dermatology') {
        return {
          ...state, ...base,
          indication: 'atopicDermatitis' as Indication,
          modality: 'mab' as Modality,
          skinSeverity: 'moderate',
          chronicityProfile: 'chronic_relapsing',
          topicalVsSystemic: 'systemic_only',
        };
      }
      if (action.area === 'gastroenterology') {
        return {
          ...state, ...base,
          indication: 'ulcerativeColitis' as Indication,
          modality: 'mab' as Modality,
          giSegment: 'colonic',
          biologicExperience: 'biologic_naive',
          endoscopicEndpoint: 'endoscopic_improvement',
        };
      }
      // oncology
      return { ...state, ...base, indication: 'lung_nsclc' as Indication, modality: 'smallMolecule', lineOfTherapy: '2L' };
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

    case 'TOGGLE_DIFFERENTIATION': {
      const current = state.differentiationFactors;
      const key = action.key;
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...state, differentiationFactors: next };
    }

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
  setDealType: (v: DealType) => void;
  setModality: (v: Modality) => void;
  setIndication: (v: Indication) => void;
  setTerritory: (v: Territory) => void;
  setBiomarker: (v: BiomarkerStatus) => void;
  setLineOfTherapy: (v: LineOfTherapy) => void;
  setTreatmentApproach: (v: TreatmentApproach) => void;
  setCombinationPotential: (v: CombinationPotential) => void;
  setCompetitivePosition: (v: CompetitivePosition) => void;
  setDataQuality: (v: DataQuality) => void;
  /** Toggle a differentiation factor on/off. */
  toggleDifferentiationFactor: (key: string) => void;
  /** R23: Set asset-specific peak sales override in $M. null = use engine default. */
  setPeakSalesOverrideM: (v: number | null) => void;
  /** R63: Set asset name for branded-asset lookup (ASSET_PEAK_SALES_TABLE). */
  setAssetName: (v: string) => void;
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
  setCvOutcomeBenefit: (v: CVOutcomeBenefit) => void;
  setCvTrialEndpoint: (v: CVTrialEndpoint) => void;
  setCvPopulationRisk: (v: CVPopulationRisk) => void;
  setResistanceProfile: (v: ResistanceProfile) => void;
  setInfectionChronicity: (v: InfectionChronicity) => void;
  setPublicHealthPriority: (v: PublicHealthPriority) => void;
  setOcularDelivery: (v: OcularDelivery) => void;
  setTreatmentDurability: (v: TreatmentDurability) => void;
  setVisionImpact: (v: VisionImpact) => void;
  setWhTargetPopulation: (v: WHTargetPopulation) => void;
  setWhUnmetNeed: (v: WHUnmetNeed) => void;
  setWhRegulatory: (v: WHRegulatory) => void;
  setOrphanDesignation: (v: OrphanDesignation) => void;
  setPatientPopulationSize: (v: PatientPopulationSize) => void;
  setGeneticBasis: (v: GeneticBasis) => void;
  setHemeLineage: (v: HemeLineage) => void;
  setTransplantEligibility: (v: TransplantEligibility) => void;
  setMrdStatus: (v: MRDStatus) => void;
  setSkinSeverity: (v: SkinSeverity) => void;
  setChronicityProfile: (v: ChronicityProfile) => void;
  setTopicalVsSystemic: (v: TopicalVsSystemic) => void;
  setGiSegment: (v: GISegment) => void;
  setBiologicExperience: (v: BiologicExperience) => void;
  setEndoscopicEndpoint: (v: EndoscopicEndpoint) => void;
  setWizardStep: (v: number) => void;
  setQuickMode: (v: boolean) => void;
  setShowTemplates: (v: boolean) => void;
  toggleRegulatory: (designation: keyof RegulatoryDesignations) => void;
  clearHighlights: () => void;
  bulkSet: (fields: Partial<CalculatorFormState>) => void;
  switchTherapeuticArea: (area: TherapeuticArea) => void;
  reset: () => void;
  dispatch: React.Dispatch<CalculatorAction>;
}

// ── localStorage persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'calculator-form-state';

/** Fields to persist — excludes UI-only state. */
const FORM_FIELDS: (keyof CalculatorFormState)[] = [
  'therapeuticArea', 'phase', 'dealType', 'modality', 'indication', 'territory',
  'biomarker', 'lineOfTherapy', 'treatmentApproach', 'combinationPotential',
  'competitivePosition', 'dataQuality', 'regulatoryDesignations',
  'bbbPenetration', 'diseaseProgression', 'biomarkerValidation',
  'immuneResetPotential', 'targetSpecificity', 'diseaseSeverity', 'treatmentGoal',
  'mechanismDifferentiation', 'weightLossEfficacy', 'routeOfAdministration',
  'comorbidityBreadth', 'metabolicTreatmentApproach',
  'cvOutcomeBenefit', 'cvTrialEndpoint', 'cvPopulationRisk',
  'resistanceProfile', 'infectionChronicity', 'publicHealthPriority',
  'ocularDelivery', 'treatmentDurability', 'visionImpact',
  'whTargetPopulation', 'whUnmetNeed', 'whRegulatory',
  'orphanDesignation', 'patientPopulationSize', 'geneticBasis',
  'hemeLineage', 'transplantEligibility', 'mrdStatus',
  'skinSeverity', 'chronicityProfile', 'topicalVsSystemic',
  'giSegment', 'biologicExperience', 'endoscopicEndpoint',
  'differentiationFactors',
  'peakSalesOverrideM', 'assetName',
];

function loadSavedState(): Partial<CalculatorFormState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate it's an object with at least one expected field
    if (parsed && typeof parsed === 'object' && ('therapeuticArea' in parsed || 'phase' in parsed)) {
      return parsed;
    }
  } catch { /* corrupt data */ }
  return null;
}

function saveFormState(state: CalculatorFormState) {
  if (typeof window === 'undefined') return;
  try {
    const toSave: Record<string, unknown> = {};
    for (const key of FORM_FIELDS) {
      toSave[key] = state[key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* storage full or unavailable */ }
}

export function clearSavedFormState() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCalculatorState(): [CalculatorFormState, CalculatorActions, boolean] {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [wasRestored, setWasRestored] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = loadSavedState();
    if (saved && Object.keys(saved).length > 0) {
      // Only restore if at least one meaningful field was set
      const hasContent = saved.phase || saved.modality || saved.dealType;
      if (hasContent) {
        dispatch({ type: 'BULK_SET', fields: saved });
        setWasRestored(true);
      }
    }
  }, []);

  // Debounce-save to localStorage on every state change (300ms)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveFormState(state), 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [state]);

  const actions: CalculatorActions = useMemo(() => ({
    setTherapeuticArea: (v) => dispatch({ type: 'SET_FIELD', field: 'therapeuticArea', value: v }),
    setPhase: (v) => dispatch({ type: 'SET_FIELD', field: 'phase', value: v }),
    setDealType: (v) => dispatch({ type: 'SET_FIELD', field: 'dealType', value: v }),
    setModality: (v) => dispatch({ type: 'SET_FIELD', field: 'modality', value: v }),
    setIndication: (v) => dispatch({ type: 'SET_FIELD', field: 'indication', value: v }),
    setTerritory: (v) => dispatch({ type: 'SET_FIELD', field: 'territory', value: v }),
    setBiomarker: (v) => dispatch({ type: 'SET_FIELD', field: 'biomarker', value: v }),
    setLineOfTherapy: (v) => dispatch({ type: 'SET_FIELD', field: 'lineOfTherapy', value: v }),
    setTreatmentApproach: (v) => dispatch({ type: 'SET_FIELD', field: 'treatmentApproach', value: v }),
    setCombinationPotential: (v) => dispatch({ type: 'SET_FIELD', field: 'combinationPotential', value: v }),
    setCompetitivePosition: (v) => dispatch({ type: 'SET_FIELD', field: 'competitivePosition', value: v }),
    setDataQuality: (v) => dispatch({ type: 'SET_FIELD', field: 'dataQuality', value: v }),
    setMolecularTargets: (v: string[]) => dispatch({ type: 'SET_FIELD', field: 'molecularTargets', value: v }),
    setDeliveryRoute: (v: string) => dispatch({ type: 'SET_FIELD', field: 'deliveryRoute', value: v }),
    toggleMolecularTarget: (slug: string) => {
      const current = state.molecularTargets;
      const next = current.includes(slug)
        ? current.filter(t => t !== slug)
        : current.length < 4 ? [...current, slug] : current;
      dispatch({ type: 'SET_FIELD', field: 'molecularTargets', value: next });
    },
    toggleDifferentiationFactor: (key) => dispatch({ type: 'TOGGLE_DIFFERENTIATION', key }),
    setPeakSalesOverrideM: (v) => dispatch({ type: 'SET_FIELD', field: 'peakSalesOverrideM', value: v }),
    setAssetName: (v) => dispatch({ type: 'SET_FIELD', field: 'assetName', value: v }),
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
    setCvOutcomeBenefit: (v) => dispatch({ type: 'SET_FIELD', field: 'cvOutcomeBenefit', value: v }),
    setCvTrialEndpoint: (v) => dispatch({ type: 'SET_FIELD', field: 'cvTrialEndpoint', value: v }),
    setCvPopulationRisk: (v) => dispatch({ type: 'SET_FIELD', field: 'cvPopulationRisk', value: v }),
    setResistanceProfile: (v) => dispatch({ type: 'SET_FIELD', field: 'resistanceProfile', value: v }),
    setInfectionChronicity: (v) => dispatch({ type: 'SET_FIELD', field: 'infectionChronicity', value: v }),
    setPublicHealthPriority: (v) => dispatch({ type: 'SET_FIELD', field: 'publicHealthPriority', value: v }),
    setOcularDelivery: (v) => dispatch({ type: 'SET_FIELD', field: 'ocularDelivery', value: v }),
    setTreatmentDurability: (v) => dispatch({ type: 'SET_FIELD', field: 'treatmentDurability', value: v }),
    setVisionImpact: (v) => dispatch({ type: 'SET_FIELD', field: 'visionImpact', value: v }),
    setWhTargetPopulation: (v) => dispatch({ type: 'SET_FIELD', field: 'whTargetPopulation', value: v }),
    setWhUnmetNeed: (v) => dispatch({ type: 'SET_FIELD', field: 'whUnmetNeed', value: v }),
    setWhRegulatory: (v) => dispatch({ type: 'SET_FIELD', field: 'whRegulatory', value: v }),
    setOrphanDesignation: (v) => dispatch({ type: 'SET_FIELD', field: 'orphanDesignation', value: v }),
    setPatientPopulationSize: (v) => dispatch({ type: 'SET_FIELD', field: 'patientPopulationSize', value: v }),
    setGeneticBasis: (v) => dispatch({ type: 'SET_FIELD', field: 'geneticBasis', value: v }),
    setHemeLineage: (v) => dispatch({ type: 'SET_FIELD', field: 'hemeLineage', value: v }),
    setTransplantEligibility: (v) => dispatch({ type: 'SET_FIELD', field: 'transplantEligibility', value: v }),
    setMrdStatus: (v) => dispatch({ type: 'SET_FIELD', field: 'mrdStatus', value: v }),
    setSkinSeverity: (v) => dispatch({ type: 'SET_FIELD', field: 'skinSeverity', value: v }),
    setChronicityProfile: (v) => dispatch({ type: 'SET_FIELD', field: 'chronicityProfile', value: v }),
    setTopicalVsSystemic: (v) => dispatch({ type: 'SET_FIELD', field: 'topicalVsSystemic', value: v }),
    setGiSegment: (v) => dispatch({ type: 'SET_FIELD', field: 'giSegment', value: v }),
    setBiologicExperience: (v) => dispatch({ type: 'SET_FIELD', field: 'biologicExperience', value: v }),
    setEndoscopicEndpoint: (v) => dispatch({ type: 'SET_FIELD', field: 'endoscopicEndpoint', value: v }),
    setWizardStep: (v) => dispatch({ type: 'SET_STEP', step: v }),
    setQuickMode: (v) => dispatch({ type: 'SET_FIELD', field: 'quickMode', value: v }),
    setShowTemplates: (v) => dispatch({ type: 'SET_FIELD', field: 'showTemplates', value: v }),
    toggleRegulatory: (d) => dispatch({ type: 'TOGGLE_REGULATORY', designation: d }),
    clearHighlights: () => dispatch({ type: 'CLEAR_HIGHLIGHTS' }),
    bulkSet: (fields) => dispatch({ type: 'BULK_SET', fields }),
    switchTherapeuticArea: (area) => dispatch({ type: 'SET_THERAPEUTIC_AREA', area }),
    reset: () => { clearSavedFormState(); dispatch({ type: 'RESET' }); },
    dispatch,
  }), [dispatch]);

  return [state, actions, wasRestored];
}
