import React from 'react';
import type {
  TherapeuticArea,
  Territory,
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
import {
  territoryOptions,
  lineOfTherapyOptions,
  treatmentApproachOptions,
  combinationPotentialOptions,
  competitivePositionOptions,
  dataQualityOptions,
  regulatoryDesignationOptions,
  bbbPenetrationOptions,
  diseaseProgressionOptions,
  biomarkerValidationOptions,
  immuneResetOptions,
  targetSpecificityOptions,
  diseaseSeverityOptions,
  treatmentGoalOptions,
  mechanismDifferentiationOptions,
  weightLossEfficacyOptions,
  routeOfAdministrationOptions,
  comorbidityBreadthOptions,
  metabolicTreatmentApproachOptions,
  cvOutcomeBenefitOptions,
  cvTrialEndpointOptions,
  cvPopulationRiskOptions,
  resistanceProfileOptions,
  infectionChronicityOptions,
  publicHealthPriorityOptions,
  ocularDeliveryOptions,
  treatmentDurabilityOptions,
  visionImpactOptions,
  whTargetPopulationOptions,
  whUnmetNeedOptions,
  whRegulatoryOptions,
  orphanDesignationOptions,
  patientPopulationSizeOptions,
  geneticBasisOptions,
  hemeLineageOptions,
  transplantEligibilityOptions,
  mrdStatusOptions,
  skinSeverityOptions,
  chronicityProfileOptions,
  topicalVsSystemicOptions,
  giSegmentOptions,
  biologicExperienceOptions,
  endoscopicEndpointOptions,
} from '@/lib/calculations';
import {
  competitivePositionDescriptions, dataQualityDescriptions, combinationPotentialDescriptions,
  lineOfTherapyDescriptions, treatmentApproachDescriptions, bbbPenetrationDescriptions,
  diseaseProgressionDescriptions, biomarkerValidationDescriptions, treatmentGoalDescriptions,
  immuneResetDescriptions, targetSpecificityDescriptions, diseaseSeverityDescriptions,
  metabolicTreatmentApproachDescriptions, mechanismDifferentiationDescriptions,
  weightLossEfficacyDescriptions, routeOfAdministrationDescriptions, comorbidityBreadthDescriptions,
  cvOutcomeBenefitDescriptions, cvTrialEndpointDescriptions, cvPopulationRiskDescriptions,
  resistanceProfileDescriptions, infectionChronicityDescriptions, publicHealthPriorityDescriptions,
  ocularDeliveryDescriptions, treatmentDurabilityDescriptions, visionImpactDescriptions,
  whTargetPopulationDescriptions, whUnmetNeedDescriptions, whRegulatoryDescriptions,
  orphanDesignationDescriptions, patientPopulationSizeDescriptions, geneticBasisDescriptions,
  hemeLineageDescriptions, transplantEligibilityDescriptions, mrdStatusDescriptions,
  skinSeverityDescriptions, chronicityProfileDescriptions, topicalVsSystemicDescriptions,
  giSegmentDescriptions, biologicExperienceDescriptions, endoscopicEndpointDescriptions,
  territoryDescriptions, sectionHelp,
} from '@/lib/optionDescriptions';
import { getMultiplierImpactBadge, getTerritoryImpactBadge, type ImpactBadge } from '@/lib/impactBadges';
import { STEP_ACCENTS } from '@/lib/areaAccents';
import OptionCardGroup from './OptionCardGroup';
import InfoTooltip from './InfoTooltip';
import type { OnboardingStep } from '../OnboardingModal';

// Static badges — multiplier values don't change at runtime
const competitiveBadges: Record<string, ImpactBadge> = {};
competitivePositionOptions.forEach(opt => {
  competitiveBadges[opt.value] = getMultiplierImpactBadge('competitivePosition', opt.value);
});
const dataQualityBadges: Record<string, ImpactBadge> = {};
dataQualityOptions.forEach(opt => {
  dataQualityBadges[opt.value] = getMultiplierImpactBadge('dataQuality', opt.value);
});
const combinationBadges: Record<string, ImpactBadge> = {};
combinationPotentialOptions.forEach(opt => {
  combinationBadges[opt.value] = getMultiplierImpactBadge('combinationPotential', opt.value);
});

// Target Profile badges — oncology
const lineOfTherapyBadges: Record<string, ImpactBadge> = {};
lineOfTherapyOptions.forEach(opt => {
  lineOfTherapyBadges[opt.value] = getMultiplierImpactBadge('lineOfTherapy', opt.value);
});

// Target Profile badges — neurology
const treatmentApproachBadges: Record<string, ImpactBadge> = {};
treatmentApproachOptions.forEach(opt => {
  treatmentApproachBadges[opt.value] = getMultiplierImpactBadge('treatmentApproach', opt.value);
});
const bbbPenetrationBadges: Record<string, ImpactBadge> = {};
bbbPenetrationOptions.forEach(opt => {
  bbbPenetrationBadges[opt.value] = getMultiplierImpactBadge('bbbPenetration', opt.value);
});
const diseaseProgressionBadges: Record<string, ImpactBadge> = {};
diseaseProgressionOptions.forEach(opt => {
  diseaseProgressionBadges[opt.value] = getMultiplierImpactBadge('diseaseProgression', opt.value);
});
const biomarkerValidationBadges: Record<string, ImpactBadge> = {};
biomarkerValidationOptions.forEach(opt => {
  biomarkerValidationBadges[opt.value] = getMultiplierImpactBadge('biomarkerValidation', opt.value);
});

// Target Profile badges — immunology
const treatmentGoalBadges: Record<string, ImpactBadge> = {};
treatmentGoalOptions.forEach(opt => {
  treatmentGoalBadges[opt.value] = getMultiplierImpactBadge('treatmentGoal', opt.value);
});
const immuneResetBadges: Record<string, ImpactBadge> = {};
immuneResetOptions.forEach(opt => {
  immuneResetBadges[opt.value] = getMultiplierImpactBadge('immuneResetPotential', opt.value);
});
const targetSpecificityBadges: Record<string, ImpactBadge> = {};
targetSpecificityOptions.forEach(opt => {
  targetSpecificityBadges[opt.value] = getMultiplierImpactBadge('targetSpecificity', opt.value);
});
const diseaseSeverityBadges: Record<string, ImpactBadge> = {};
diseaseSeverityOptions.forEach(opt => {
  diseaseSeverityBadges[opt.value] = getMultiplierImpactBadge('diseaseSeverity', opt.value);
});

// Target Profile badges — metabolic
const metabolicTreatmentApproachBadges: Record<string, ImpactBadge> = {};
metabolicTreatmentApproachOptions.forEach(opt => {
  metabolicTreatmentApproachBadges[opt.value] = getMultiplierImpactBadge('metabolicTreatmentApproach', opt.value);
});
const mechanismDifferentiationBadges: Record<string, ImpactBadge> = {};
mechanismDifferentiationOptions.forEach(opt => {
  mechanismDifferentiationBadges[opt.value] = getMultiplierImpactBadge('mechanismDifferentiation', opt.value);
});
const weightLossEfficacyBadges: Record<string, ImpactBadge> = {};
weightLossEfficacyOptions.forEach(opt => {
  weightLossEfficacyBadges[opt.value] = getMultiplierImpactBadge('weightLossEfficacy', opt.value);
});
const routeOfAdministrationBadges: Record<string, ImpactBadge> = {};
routeOfAdministrationOptions.forEach(opt => {
  routeOfAdministrationBadges[opt.value] = getMultiplierImpactBadge('routeOfAdministration', opt.value);
});
const comorbidityBreadthBadges: Record<string, ImpactBadge> = {};
comorbidityBreadthOptions.forEach(opt => {
  comorbidityBreadthBadges[opt.value] = getMultiplierImpactBadge('comorbidityBreadth', opt.value);
});

// Target Profile badges — cardiovascular
const cvOutcomeBenefitBadges: Record<string, ImpactBadge> = {};
cvOutcomeBenefitOptions.forEach(opt => {
  cvOutcomeBenefitBadges[opt.value] = getMultiplierImpactBadge('cvOutcomeBenefit', opt.value);
});
const cvTrialEndpointBadges: Record<string, ImpactBadge> = {};
cvTrialEndpointOptions.forEach(opt => {
  cvTrialEndpointBadges[opt.value] = getMultiplierImpactBadge('cvTrialEndpoint', opt.value);
});
const cvPopulationRiskBadges: Record<string, ImpactBadge> = {};
cvPopulationRiskOptions.forEach(opt => {
  cvPopulationRiskBadges[opt.value] = getMultiplierImpactBadge('cvPopulationRisk', opt.value);
});

// Target Profile badges — infectious disease
const resistanceProfileBadges: Record<string, ImpactBadge> = {};
resistanceProfileOptions.forEach(opt => {
  resistanceProfileBadges[opt.value] = getMultiplierImpactBadge('resistanceProfile', opt.value);
});
const infectionChronicityBadges: Record<string, ImpactBadge> = {};
infectionChronicityOptions.forEach(opt => {
  infectionChronicityBadges[opt.value] = getMultiplierImpactBadge('infectionChronicity', opt.value);
});
const publicHealthPriorityBadges: Record<string, ImpactBadge> = {};
publicHealthPriorityOptions.forEach(opt => {
  publicHealthPriorityBadges[opt.value] = getMultiplierImpactBadge('publicHealthPriority', opt.value);
});

// Target Profile badges — ophthalmology
const ocularDeliveryBadges: Record<string, ImpactBadge> = {};
ocularDeliveryOptions.forEach(opt => {
  ocularDeliveryBadges[opt.value] = getMultiplierImpactBadge('ocularDelivery', opt.value);
});
const treatmentDurabilityBadges: Record<string, ImpactBadge> = {};
treatmentDurabilityOptions.forEach(opt => {
  treatmentDurabilityBadges[opt.value] = getMultiplierImpactBadge('treatmentDurability', opt.value);
});
const visionImpactBadges: Record<string, ImpactBadge> = {};
visionImpactOptions.forEach(opt => {
  visionImpactBadges[opt.value] = getMultiplierImpactBadge('visionImpact', opt.value);
});

// Target Profile badges — women's health
const whTargetPopulationBadges: Record<string, ImpactBadge> = {};
whTargetPopulationOptions.forEach(opt => {
  whTargetPopulationBadges[opt.value] = getMultiplierImpactBadge('whTargetPopulation', opt.value);
});
const whUnmetNeedBadges: Record<string, ImpactBadge> = {};
whUnmetNeedOptions.forEach(opt => {
  whUnmetNeedBadges[opt.value] = getMultiplierImpactBadge('whUnmetNeed', opt.value);
});
const whRegulatoryBadges: Record<string, ImpactBadge> = {};
whRegulatoryOptions.forEach(opt => {
  whRegulatoryBadges[opt.value] = getMultiplierImpactBadge('whRegulatory', opt.value);
});

// Target Profile badges — rare disease
const orphanDesignationBadges: Record<string, ImpactBadge> = {};
orphanDesignationOptions.forEach(opt => {
  orphanDesignationBadges[opt.value] = getMultiplierImpactBadge('orphanDesignation', opt.value);
});
const patientPopulationSizeBadges: Record<string, ImpactBadge> = {};
patientPopulationSizeOptions.forEach(opt => {
  patientPopulationSizeBadges[opt.value] = getMultiplierImpactBadge('patientPopulationSize', opt.value);
});
const geneticBasisBadges: Record<string, ImpactBadge> = {};
geneticBasisOptions.forEach(opt => {
  geneticBasisBadges[opt.value] = getMultiplierImpactBadge('geneticBasis', opt.value);
});

// Target Profile badges — hematology
const hemeLineageBadges: Record<string, ImpactBadge> = {};
hemeLineageOptions.forEach(opt => {
  hemeLineageBadges[opt.value] = getMultiplierImpactBadge('hemeLineage', opt.value);
});
const transplantEligibilityBadges: Record<string, ImpactBadge> = {};
transplantEligibilityOptions.forEach(opt => {
  transplantEligibilityBadges[opt.value] = getMultiplierImpactBadge('transplantEligibility', opt.value);
});
const mrdStatusBadges: Record<string, ImpactBadge> = {};
mrdStatusOptions.forEach(opt => {
  mrdStatusBadges[opt.value] = getMultiplierImpactBadge('mrdStatus', opt.value);
});

// Target Profile badges — dermatology
const skinSeverityBadges: Record<string, ImpactBadge> = {};
skinSeverityOptions.forEach(opt => {
  skinSeverityBadges[opt.value] = getMultiplierImpactBadge('skinSeverity', opt.value);
});
const chronicityProfileBadges: Record<string, ImpactBadge> = {};
chronicityProfileOptions.forEach(opt => {
  chronicityProfileBadges[opt.value] = getMultiplierImpactBadge('chronicityProfile', opt.value);
});
const topicalVsSystemicBadges: Record<string, ImpactBadge> = {};
topicalVsSystemicOptions.forEach(opt => {
  topicalVsSystemicBadges[opt.value] = getMultiplierImpactBadge('topicalVsSystemic', opt.value);
});

// Target Profile badges — gastroenterology
const giSegmentBadges: Record<string, ImpactBadge> = {};
giSegmentOptions.forEach(opt => {
  giSegmentBadges[opt.value] = getMultiplierImpactBadge('giSegment', opt.value);
});
const biologicExperienceBadges: Record<string, ImpactBadge> = {};
biologicExperienceOptions.forEach(opt => {
  biologicExperienceBadges[opt.value] = getMultiplierImpactBadge('biologicExperience', opt.value);
});
const endoscopicEndpointBadges: Record<string, ImpactBadge> = {};
endoscopicEndpointOptions.forEach(opt => {
  endoscopicEndpointBadges[opt.value] = getMultiplierImpactBadge('endoscopicEndpoint', opt.value);
});

// Deal Scope badges
const territoryBadges: Record<string, ImpactBadge> = {};
territoryOptions.forEach(opt => {
  territoryBadges[opt.value] = getTerritoryImpactBadge(opt.value);
});

interface AdvancedOptionsSectionProps {
  therapeuticArea: TherapeuticArea;
  territory: Territory;
  lineOfTherapy: LineOfTherapy;
  treatmentApproach: TreatmentApproach;
  combinationPotential: CombinationPotential;
  competitivePosition: CompetitivePosition;
  dataQuality: DataQuality;
  regulatoryDesignations: RegulatoryDesignations;
  highlightedFields: Set<string>;
  onboardingStep: OnboardingStep | null;
  /** Which column portion to render: 'left' = Target Profile, 'right' = Competitive Landscape + Deal Scope, 'competitive' = Competitive only, 'deal-scope' = Deal Scope only */
  column: 'left' | 'right' | 'competitive' | 'deal-scope';
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
  // Change handlers
  onTerritoryChange: (value: Territory) => void;
  onLineOfTherapyChange: (value: LineOfTherapy) => void;
  onTreatmentApproachChange: (value: TreatmentApproach) => void;
  onCombinationPotentialChange: (value: CombinationPotential) => void;
  onCompetitivePositionChange: (value: CompetitivePosition) => void;
  onDataQualityChange: (value: DataQuality) => void;
  onRegulatoryChange: (designation: keyof RegulatoryDesignations) => void;
  // Neurology handlers
  onBbbPenetrationChange: (value: BBBPenetration) => void;
  onDiseaseProgressionChange: (value: DiseaseProgression) => void;
  onBiomarkerValidationChange: (value: BiomarkerValidation) => void;
  // Immunology handlers
  onImmuneResetPotentialChange: (value: ImmuneResetPotential) => void;
  onTargetSpecificityChange: (value: TargetSpecificity) => void;
  onDiseaseSeverityChange: (value: DiseaseSeverity) => void;
  onTreatmentGoalChange: (value: ImmunologyTreatmentGoal) => void;
  // Metabolic handlers
  onMechanismDifferentiationChange: (value: MechanismDifferentiation) => void;
  onWeightLossEfficacyChange: (value: WeightLossEfficacy) => void;
  onRouteOfAdministrationChange: (value: RouteOfAdministration) => void;
  onComorbidityBreadthChange: (value: ComorbidityBreadth) => void;
  onMetabolicTreatmentApproachChange: (value: MetabolicTreatmentApproach) => void;
  // Cardiovascular-specific
  cvOutcomeBenefit: CVOutcomeBenefit;
  cvTrialEndpoint: CVTrialEndpoint;
  cvPopulationRisk: CVPopulationRisk;
  onCvOutcomeBenefitChange: (value: CVOutcomeBenefit) => void;
  onCvTrialEndpointChange: (value: CVTrialEndpoint) => void;
  onCvPopulationRiskChange: (value: CVPopulationRisk) => void;
  // Infectious Disease-specific
  resistanceProfile: ResistanceProfile;
  infectionChronicity: InfectionChronicity;
  publicHealthPriority: PublicHealthPriority;
  onResistanceProfileChange: (value: ResistanceProfile) => void;
  onInfectionChronicityChange: (value: InfectionChronicity) => void;
  onPublicHealthPriorityChange: (value: PublicHealthPriority) => void;
  // Ophthalmology-specific
  ocularDelivery: OcularDelivery;
  treatmentDurability: TreatmentDurability;
  visionImpact: VisionImpact;
  onOcularDeliveryChange: (value: OcularDelivery) => void;
  onTreatmentDurabilityChange: (value: TreatmentDurability) => void;
  onVisionImpactChange: (value: VisionImpact) => void;
  // Women's Health-specific
  whTargetPopulation: WHTargetPopulation;
  whUnmetNeed: WHUnmetNeed;
  whRegulatory: WHRegulatory;
  onWhTargetPopulationChange: (value: WHTargetPopulation) => void;
  onWhUnmetNeedChange: (value: WHUnmetNeed) => void;
  onWhRegulatoryChange: (value: WHRegulatory) => void;
  // Rare Disease-specific
  orphanDesignation: OrphanDesignation;
  patientPopulationSize: PatientPopulationSize;
  geneticBasis: GeneticBasis;
  onOrphanDesignationChange: (value: OrphanDesignation) => void;
  onPatientPopulationSizeChange: (value: PatientPopulationSize) => void;
  onGeneticBasisChange: (value: GeneticBasis) => void;
  // Hematology-specific
  hemeLineage: HemeLineage;
  transplantEligibility: TransplantEligibility;
  mrdStatus: MRDStatus;
  onHemeLineageChange: (value: HemeLineage) => void;
  onTransplantEligibilityChange: (value: TransplantEligibility) => void;
  onMrdStatusChange: (value: MRDStatus) => void;
  // Dermatology-specific
  skinSeverity: SkinSeverity;
  chronicityProfile: ChronicityProfile;
  topicalVsSystemic: TopicalVsSystemic;
  onSkinSeverityChange: (value: SkinSeverity) => void;
  onChronicityProfileChange: (value: ChronicityProfile) => void;
  onTopicalVsSystemicChange: (value: TopicalVsSystemic) => void;
  // Gastroenterology-specific
  giSegment: GISegment;
  biologicExperience: BiologicExperience;
  endoscopicEndpoint: EndoscopicEndpoint;
  onGiSegmentChange: (value: GISegment) => void;
  onBiologicExperienceChange: (value: BiologicExperience) => void;
  onEndoscopicEndpointChange: (value: EndoscopicEndpoint) => void;
}

const AdvancedOptionsSection = React.memo(function AdvancedOptionsSection({
  therapeuticArea,
  territory,
  lineOfTherapy,
  treatmentApproach,
  combinationPotential,
  competitivePosition,
  dataQuality,
  regulatoryDesignations,
  highlightedFields,
  onboardingStep,
  bbbPenetration,
  diseaseProgression,
  biomarkerValidation,
  immuneResetPotential,
  targetSpecificity,
  diseaseSeverity,
  treatmentGoal,
  mechanismDifferentiation,
  weightLossEfficacy,
  routeOfAdministration,
  comorbidityBreadth,
  metabolicTreatmentApproach,
  onTerritoryChange,
  onLineOfTherapyChange,
  onTreatmentApproachChange,
  onCombinationPotentialChange,
  onCompetitivePositionChange,
  onDataQualityChange,
  onRegulatoryChange,
  onBbbPenetrationChange,
  onDiseaseProgressionChange,
  onBiomarkerValidationChange,
  onImmuneResetPotentialChange,
  onTargetSpecificityChange,
  onDiseaseSeverityChange,
  onTreatmentGoalChange,
  onMechanismDifferentiationChange,
  onWeightLossEfficacyChange,
  onRouteOfAdministrationChange,
  onComorbidityBreadthChange,
  onMetabolicTreatmentApproachChange,
  cvOutcomeBenefit,
  cvTrialEndpoint,
  cvPopulationRisk,
  onCvOutcomeBenefitChange,
  onCvTrialEndpointChange,
  onCvPopulationRiskChange,
  resistanceProfile,
  infectionChronicity,
  publicHealthPriority,
  onResistanceProfileChange,
  onInfectionChronicityChange,
  onPublicHealthPriorityChange,
  ocularDelivery,
  treatmentDurability,
  visionImpact,
  onOcularDeliveryChange,
  onTreatmentDurabilityChange,
  onVisionImpactChange,
  whTargetPopulation,
  whUnmetNeed,
  whRegulatory,
  onWhTargetPopulationChange,
  onWhUnmetNeedChange,
  onWhRegulatoryChange,
  orphanDesignation,
  patientPopulationSize,
  geneticBasis,
  onOrphanDesignationChange,
  onPatientPopulationSizeChange,
  onGeneticBasisChange,
  hemeLineage,
  transplantEligibility,
  mrdStatus,
  onHemeLineageChange,
  onTransplantEligibilityChange,
  onMrdStatusChange,
  skinSeverity,
  chronicityProfile,
  topicalVsSystemic,
  onSkinSeverityChange,
  onChronicityProfileChange,
  onTopicalVsSystemicChange,
  giSegment,
  biologicExperience,
  endoscopicEndpoint,
  onGiSegmentChange,
  onBiologicExperienceChange,
  onEndoscopicEndpointChange,
  column,
}: AdvancedOptionsSectionProps) {
  const accent = STEP_ACCENTS[therapeuticArea];

  if (column === 'competitive') {
    return (
      <div className={onboardingStep === 'modifiers' ? 'onboarding-spotlight p-4 -m-4 bg-white dark:bg-slate-800 rounded-xl' : ''}>
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full ${accent.bg50} text-white text-xs flex items-center justify-center transition-colors duration-300`}>3</span>
          Competitive Landscape
        </h3>
        <div className="space-y-4">
          <OptionCardGroup
            id="competitive-position-select"
            label="Competitive Position"
            helpText={sectionHelp.competitivePosition}
            options={competitivePositionOptions}
            descriptions={competitivePositionDescriptions}
            impactBadges={competitiveBadges}
            value={competitivePosition}
            onChange={onCompetitivePositionChange}
            highlighted={highlightedFields.has('competitivePosition')}
            columns={6}
          />
          <OptionCardGroup
            id="data-quality-select"
            label="Data Quality"
            helpText={sectionHelp.dataQuality}
            options={dataQualityOptions}
            descriptions={dataQualityDescriptions}
            impactBadges={dataQualityBadges}
            value={dataQuality}
            onChange={onDataQualityChange}
            highlighted={highlightedFields.has('dataQuality')}
            columns={5}
          />
          <OptionCardGroup
            id="combination-potential-select"
            label="Combination Potential"
            helpText={sectionHelp.combinationPotential}
            options={combinationPotentialOptions}
            descriptions={combinationPotentialDescriptions}
            impactBadges={combinationBadges}
            value={combinationPotential}
            onChange={onCombinationPotentialChange}
            highlighted={highlightedFields.has('combinationPotential')}
            columns={5}
          />
        </div>
      </div>
    );
  }

  if (column === 'deal-scope') {
    return (
      <div>
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full ${accent.bg30} ${accent.text30} text-xs flex items-center justify-center transition-colors duration-300`}>4</span>
          Deal Scope
        </h3>
        <div className="space-y-4">
          <OptionCardGroup
            id="territory-select"
            label="Territory"
            helpText={sectionHelp.territory}
            options={territoryOptions}
            descriptions={territoryDescriptions}
            impactBadges={territoryBadges}
            value={territory}
            onChange={onTerritoryChange}
            highlighted={highlightedFields.has('territory')}
            columns={5}
          />
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Regulatory Designations</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {regulatoryDesignationOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 px-4 py-3.5 sm:py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 touch-feedback min-h-[52px] ${
                    regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-sm'
                      : 'border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-teal-300 dark:hover:border-teal-600 active:bg-teal-50/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={regulatoryDesignations[option.value as keyof RegulatoryDesignations]}
                    onChange={() => onRegulatoryChange(option.value as keyof RegulatoryDesignations)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                    regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-neutral-300 dark:border-slate-500'
                  }`}>
                    {regulatoryDesignations[option.value as keyof RegulatoryDesignations] && (
                      <svg className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm sm:text-sm font-medium ${
                    regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                      ? 'text-teal-700 dark:text-teal-400'
                      : 'text-neutral-700 dark:text-slate-300'
                  }`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (column === 'right') {
    return (
      <>
        {/* Competitive Landscape Section */}
        <div className={onboardingStep === 'modifiers' ? 'onboarding-spotlight p-4 -m-4 bg-white dark:bg-slate-800 rounded-xl' : ''}>
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full ${accent.bg50} text-white text-xs flex items-center justify-center transition-colors duration-300`}>3</span>
            Competitive Landscape
          </h3>
          <div className="space-y-4">
            <OptionCardGroup
              id="competitive-position-select"
              label="Competitive Position"
              helpText={sectionHelp.competitivePosition}
              options={competitivePositionOptions}
              descriptions={competitivePositionDescriptions}
              impactBadges={competitiveBadges}
              value={competitivePosition}
              onChange={onCompetitivePositionChange}
              highlighted={highlightedFields.has('competitivePosition')}
              columns={6}
            />

            <OptionCardGroup
              id="data-quality-select"
              label="Data Quality"
              helpText={sectionHelp.dataQuality}
              options={dataQualityOptions}
              descriptions={dataQualityDescriptions}
              impactBadges={dataQualityBadges}
              value={dataQuality}
              onChange={onDataQualityChange}
              highlighted={highlightedFields.has('dataQuality')}
              columns={5}
            />
          </div>
        </div>

        {/* Deal Scope Section */}
        <div>
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full ${accent.bg30} ${accent.text30} text-xs flex items-center justify-center transition-colors duration-300`}>4</span>
            Deal Scope
          </h3>
          <div className="space-y-4">
            <OptionCardGroup
              id="territory-select-right"
              label="Territory"
              helpText={sectionHelp.territory}
              options={territoryOptions}
              descriptions={territoryDescriptions}
              impactBadges={territoryBadges}
              value={territory}
              onChange={onTerritoryChange}
              highlighted={highlightedFields.has('territory')}
              columns={5}
            />

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
                      onChange={() => onRegulatoryChange(option.value as keyof RegulatoryDesignations)}
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
      </>
    );
  }

  return (
    <>
      {/* Target Profile Section */}
      <div>
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full ${accent.bg70} text-white text-xs flex items-center justify-center transition-colors duration-300`}>2</span>
          Target Profile
        </h3>
        <div className="space-y-4">
          {therapeuticArea === 'neurology' ? (
            <OptionCardGroup
              id="treatment-approach-select"
              label="Treatment Approach"
              helpText={sectionHelp.treatmentApproach}
              options={treatmentApproachOptions}
              descriptions={treatmentApproachDescriptions}
              impactBadges={treatmentApproachBadges}
              value={treatmentApproach}
              onChange={onTreatmentApproachChange}
              highlighted={highlightedFields.has('treatmentApproach')}
              columns={5}
            />
          ) : therapeuticArea === 'metabolic' ? (
            <OptionCardGroup
              id="metabolic-treatment-approach-select"
              label="Treatment Approach"
              helpText={sectionHelp.metabolicTreatmentApproach}
              options={metabolicTreatmentApproachOptions}
              descriptions={metabolicTreatmentApproachDescriptions}
              impactBadges={metabolicTreatmentApproachBadges}
              value={metabolicTreatmentApproach}
              onChange={onMetabolicTreatmentApproachChange}
              columns={5}
            />
          ) : therapeuticArea === 'immunology' ? (
            <OptionCardGroup
              id="treatment-goal-select"
              label="Treatment Goal"
              helpText={sectionHelp.treatmentGoal}
              options={treatmentGoalOptions}
              descriptions={treatmentGoalDescriptions}
              impactBadges={treatmentGoalBadges}
              value={treatmentGoal}
              onChange={onTreatmentGoalChange}
              columns={5}
            />
          ) : therapeuticArea === 'cardiovascular' ? (
            <OptionCardGroup
              id="cv-outcome-benefit-select"
              label="CV Outcome Benefit"
              helpText={sectionHelp.cvOutcomeBenefit}
              options={cvOutcomeBenefitOptions}
              descriptions={cvOutcomeBenefitDescriptions}
              impactBadges={cvOutcomeBenefitBadges}
              value={cvOutcomeBenefit}
              onChange={onCvOutcomeBenefitChange}
              columns={5}
            />
          ) : therapeuticArea === 'infectiousDisease' ? (
            <OptionCardGroup
              id="resistance-profile-select"
              label="Resistance Profile"
              helpText={sectionHelp.resistanceProfile}
              options={resistanceProfileOptions}
              descriptions={resistanceProfileDescriptions}
              impactBadges={resistanceProfileBadges}
              value={resistanceProfile}
              onChange={onResistanceProfileChange}
              columns={5}
            />
          ) : therapeuticArea === 'ophthalmology' ? (
            <OptionCardGroup
              id="ocular-delivery-select"
              label="Ocular Delivery"
              helpText={sectionHelp.ocularDelivery}
              options={ocularDeliveryOptions}
              descriptions={ocularDeliveryDescriptions}
              impactBadges={ocularDeliveryBadges}
              value={ocularDelivery}
              onChange={onOcularDeliveryChange}
              columns={5}
            />
          ) : therapeuticArea === 'womensHealth' ? (
            <OptionCardGroup
              id="wh-target-population-select"
              label="Target Population"
              helpText={sectionHelp.whTargetPopulation}
              options={whTargetPopulationOptions}
              descriptions={whTargetPopulationDescriptions}
              impactBadges={whTargetPopulationBadges}
              value={whTargetPopulation}
              onChange={onWhTargetPopulationChange}
              columns={5}
            />
          ) : therapeuticArea === 'rareDisease' ? (
            <OptionCardGroup
              id="orphan-designation-select"
              label="Orphan Designation"
              helpText={sectionHelp.orphanDesignation}
              options={orphanDesignationOptions}
              descriptions={orphanDesignationDescriptions}
              impactBadges={orphanDesignationBadges}
              value={orphanDesignation}
              onChange={onOrphanDesignationChange}
              columns={4}
            />
          ) : therapeuticArea === 'hematology' ? (
            <OptionCardGroup
              id="heme-lineage-select"
              label="Heme Lineage"
              helpText={sectionHelp.hemeLineage}
              options={hemeLineageOptions}
              descriptions={hemeLineageDescriptions}
              impactBadges={hemeLineageBadges}
              value={hemeLineage}
              onChange={onHemeLineageChange}
              columns={4}
            />
          ) : therapeuticArea === 'dermatology' ? (
            <OptionCardGroup
              id="skin-severity-select"
              label="Skin Severity"
              helpText={sectionHelp.skinSeverity}
              options={skinSeverityOptions}
              descriptions={skinSeverityDescriptions}
              impactBadges={skinSeverityBadges}
              value={skinSeverity}
              onChange={onSkinSeverityChange}
              columns={4}
            />
          ) : therapeuticArea === 'gastroenterology' ? (
            <OptionCardGroup
              id="gi-segment-select"
              label="GI Segment"
              helpText={sectionHelp.giSegment}
              options={giSegmentOptions}
              descriptions={giSegmentDescriptions}
              impactBadges={giSegmentBadges}
              value={giSegment}
              onChange={onGiSegmentChange}
              columns={4}
            />
          ) : (
            <OptionCardGroup
              id="line-of-therapy-select"
              label="Line of Therapy"
              helpText={sectionHelp.lineOfTherapy}
              options={lineOfTherapyOptions}
              descriptions={lineOfTherapyDescriptions}
              impactBadges={lineOfTherapyBadges}
              value={lineOfTherapy}
              onChange={onLineOfTherapyChange}
              highlighted={highlightedFields.has('lineOfTherapy')}
              columns={5}
            />
          )}

          {therapeuticArea === 'neurology' && (
            <>
              <OptionCardGroup
                id="bbb-penetration-select"
                label="BBB Penetration"
                helpText={sectionHelp.bbbPenetration}
                options={bbbPenetrationOptions}
                descriptions={bbbPenetrationDescriptions}
                impactBadges={bbbPenetrationBadges}
                value={bbbPenetration}
                onChange={onBbbPenetrationChange}
                columns={5}
              />
              <OptionCardGroup
                id="disease-progression-select"
                label="Disease Progression"
                helpText={sectionHelp.diseaseProgression}
                options={diseaseProgressionOptions}
                descriptions={diseaseProgressionDescriptions}
                impactBadges={diseaseProgressionBadges}
                value={diseaseProgression}
                onChange={onDiseaseProgressionChange}
                columns={5}
              />
              <OptionCardGroup
                id="biomarker-validation-select"
                label="Biomarker Validation"
                helpText={sectionHelp.biomarkerValidation}
                options={biomarkerValidationOptions}
                descriptions={biomarkerValidationDescriptions}
                impactBadges={biomarkerValidationBadges}
                value={biomarkerValidation}
                onChange={onBiomarkerValidationChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'immunology' && (
            <>
              <OptionCardGroup
                id="immune-reset-select"
                label="Immune Reset Potential"
                helpText={sectionHelp.immuneResetPotential}
                options={immuneResetOptions}
                descriptions={immuneResetDescriptions}
                impactBadges={immuneResetBadges}
                value={immuneResetPotential}
                onChange={onImmuneResetPotentialChange}
                columns={5}
              />
              <OptionCardGroup
                id="target-specificity-select"
                label="Target Specificity"
                helpText={sectionHelp.targetSpecificity}
                options={targetSpecificityOptions}
                descriptions={targetSpecificityDescriptions}
                impactBadges={targetSpecificityBadges}
                value={targetSpecificity}
                onChange={onTargetSpecificityChange}
                columns={5}
              />
              <OptionCardGroup
                id="disease-severity-select"
                label="Disease Severity"
                helpText={sectionHelp.diseaseSeverity}
                options={diseaseSeverityOptions}
                descriptions={diseaseSeverityDescriptions}
                impactBadges={diseaseSeverityBadges}
                value={diseaseSeverity}
                onChange={onDiseaseSeverityChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'metabolic' && (
            <>
              <OptionCardGroup
                id="mechanism-differentiation-select"
                label="Mechanism Differentiation"
                helpText={sectionHelp.mechanismDifferentiation}
                options={mechanismDifferentiationOptions}
                descriptions={mechanismDifferentiationDescriptions}
                impactBadges={mechanismDifferentiationBadges}
                value={mechanismDifferentiation}
                onChange={onMechanismDifferentiationChange}
                columns={5}
              />
              <OptionCardGroup
                id="weight-loss-efficacy-select"
                label="Weight Loss Efficacy"
                helpText={sectionHelp.weightLossEfficacy}
                options={weightLossEfficacyOptions}
                descriptions={weightLossEfficacyDescriptions}
                impactBadges={weightLossEfficacyBadges}
                value={weightLossEfficacy}
                onChange={onWeightLossEfficacyChange}
                columns={5}
              />
              <OptionCardGroup
                id="route-of-administration-select"
                label="Route of Administration"
                helpText={sectionHelp.routeOfAdministration}
                options={routeOfAdministrationOptions}
                descriptions={routeOfAdministrationDescriptions}
                impactBadges={routeOfAdministrationBadges}
                value={routeOfAdministration}
                onChange={onRouteOfAdministrationChange}
                columns={5}
              />
              <OptionCardGroup
                id="comorbidity-breadth-select"
                label="Comorbidity Breadth"
                helpText={sectionHelp.comorbidityBreadth}
                options={comorbidityBreadthOptions}
                descriptions={comorbidityBreadthDescriptions}
                impactBadges={comorbidityBreadthBadges}
                value={comorbidityBreadth}
                onChange={onComorbidityBreadthChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'cardiovascular' && (
            <>
              <OptionCardGroup
                id="cv-trial-endpoint-select"
                label="Trial Endpoint"
                helpText={sectionHelp.cvTrialEndpoint}
                options={cvTrialEndpointOptions}
                descriptions={cvTrialEndpointDescriptions}
                impactBadges={cvTrialEndpointBadges}
                value={cvTrialEndpoint}
                onChange={onCvTrialEndpointChange}
                columns={5}
              />
              <OptionCardGroup
                id="cv-population-risk-select"
                label="Population Risk"
                helpText={sectionHelp.cvPopulationRisk}
                options={cvPopulationRiskOptions}
                descriptions={cvPopulationRiskDescriptions}
                impactBadges={cvPopulationRiskBadges}
                value={cvPopulationRisk}
                onChange={onCvPopulationRiskChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'infectiousDisease' && (
            <>
              <OptionCardGroup
                id="infection-chronicity-select"
                label="Infection Chronicity"
                helpText={sectionHelp.infectionChronicity}
                options={infectionChronicityOptions}
                descriptions={infectionChronicityDescriptions}
                impactBadges={infectionChronicityBadges}
                value={infectionChronicity}
                onChange={onInfectionChronicityChange}
                columns={5}
              />
              <OptionCardGroup
                id="public-health-priority-select"
                label="Public Health Priority"
                helpText={sectionHelp.publicHealthPriority}
                options={publicHealthPriorityOptions}
                descriptions={publicHealthPriorityDescriptions}
                impactBadges={publicHealthPriorityBadges}
                value={publicHealthPriority}
                onChange={onPublicHealthPriorityChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'ophthalmology' && (
            <>
              <OptionCardGroup
                id="treatment-durability-select"
                label="Treatment Durability"
                helpText={sectionHelp.treatmentDurability}
                options={treatmentDurabilityOptions}
                descriptions={treatmentDurabilityDescriptions}
                impactBadges={treatmentDurabilityBadges}
                value={treatmentDurability}
                onChange={onTreatmentDurabilityChange}
                columns={5}
              />
              <OptionCardGroup
                id="vision-impact-select"
                label="Vision Impact"
                helpText={sectionHelp.visionImpact}
                options={visionImpactOptions}
                descriptions={visionImpactDescriptions}
                impactBadges={visionImpactBadges}
                value={visionImpact}
                onChange={onVisionImpactChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'womensHealth' && (
            <>
              <OptionCardGroup
                id="wh-unmet-need-select"
                label="Unmet Need"
                helpText={sectionHelp.whUnmetNeed}
                options={whUnmetNeedOptions}
                descriptions={whUnmetNeedDescriptions}
                impactBadges={whUnmetNeedBadges}
                value={whUnmetNeed}
                onChange={onWhUnmetNeedChange}
                columns={5}
              />
              <OptionCardGroup
                id="wh-regulatory-select"
                label="Regulatory Pathway"
                helpText={sectionHelp.whRegulatory}
                options={whRegulatoryOptions}
                descriptions={whRegulatoryDescriptions}
                impactBadges={whRegulatoryBadges}
                value={whRegulatory}
                onChange={onWhRegulatoryChange}
                columns={5}
              />
            </>
          )}

          {therapeuticArea === 'rareDisease' && (
            <>
              <OptionCardGroup
                id="patient-population-size-select"
                label="Patient Population Size"
                helpText={sectionHelp.patientPopulationSize}
                options={patientPopulationSizeOptions}
                descriptions={patientPopulationSizeDescriptions}
                impactBadges={patientPopulationSizeBadges}
                value={patientPopulationSize}
                onChange={onPatientPopulationSizeChange}
                columns={4}
              />
              <OptionCardGroup
                id="genetic-basis-select"
                label="Genetic Basis"
                helpText={sectionHelp.geneticBasis}
                options={geneticBasisOptions}
                descriptions={geneticBasisDescriptions}
                impactBadges={geneticBasisBadges}
                value={geneticBasis}
                onChange={onGeneticBasisChange}
                columns={4}
              />
            </>
          )}

          {therapeuticArea === 'hematology' && (
            <>
              <OptionCardGroup
                id="transplant-eligibility-select"
                label="Transplant Eligibility"
                helpText={sectionHelp.transplantEligibility}
                options={transplantEligibilityOptions}
                descriptions={transplantEligibilityDescriptions}
                impactBadges={transplantEligibilityBadges}
                value={transplantEligibility}
                onChange={onTransplantEligibilityChange}
                columns={3}
              />
              <OptionCardGroup
                id="mrd-status-select"
                label="MRD Status"
                helpText={sectionHelp.mrdStatus}
                options={mrdStatusOptions}
                descriptions={mrdStatusDescriptions}
                impactBadges={mrdStatusBadges}
                value={mrdStatus}
                onChange={onMrdStatusChange}
                columns={3}
              />
            </>
          )}

          {therapeuticArea === 'dermatology' && (
            <>
              <OptionCardGroup
                id="chronicity-profile-select"
                label="Chronicity Profile"
                helpText={sectionHelp.chronicityProfile}
                options={chronicityProfileOptions}
                descriptions={chronicityProfileDescriptions}
                impactBadges={chronicityProfileBadges}
                value={chronicityProfile}
                onChange={onChronicityProfileChange}
                columns={3}
              />
              <OptionCardGroup
                id="topical-vs-systemic-select"
                label="Topical vs Systemic"
                helpText={sectionHelp.topicalVsSystemic}
                options={topicalVsSystemicOptions}
                descriptions={topicalVsSystemicDescriptions}
                impactBadges={topicalVsSystemicBadges}
                value={topicalVsSystemic}
                onChange={onTopicalVsSystemicChange}
                columns={3}
              />
            </>
          )}

          {therapeuticArea === 'gastroenterology' && (
            <>
              <OptionCardGroup
                id="biologic-experience-select"
                label="Biologic Experience"
                helpText={sectionHelp.biologicExperience}
                options={biologicExperienceOptions}
                descriptions={biologicExperienceDescriptions}
                impactBadges={biologicExperienceBadges}
                value={biologicExperience}
                onChange={onBiologicExperienceChange}
                columns={3}
              />
              <OptionCardGroup
                id="endoscopic-endpoint-select"
                label="Endoscopic Endpoint"
                helpText={sectionHelp.endoscopicEndpoint}
                options={endoscopicEndpointOptions}
                descriptions={endoscopicEndpointDescriptions}
                impactBadges={endoscopicEndpointBadges}
                value={endoscopicEndpoint}
                onChange={onEndoscopicEndpointChange}
                columns={3}
              />
            </>
          )}

          <OptionCardGroup
            id="combination-potential-select"
            label="Combination Potential"
            helpText={sectionHelp.combinationPotential}
            options={combinationPotentialOptions}
            descriptions={combinationPotentialDescriptions}
            impactBadges={combinationBadges}
            value={combinationPotential}
            onChange={onCombinationPotentialChange}
            highlighted={highlightedFields.has('combinationPotential')}
            columns={5}
          />
        </div>
      </div>
    </>
  );
});

export default AdvancedOptionsSection;
