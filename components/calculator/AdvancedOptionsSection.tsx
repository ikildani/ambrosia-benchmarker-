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
} from '@/lib/calculations';
import {
  competitivePositionDescriptions, dataQualityDescriptions, combinationPotentialDescriptions,
  lineOfTherapyDescriptions, treatmentApproachDescriptions, bbbPenetrationDescriptions,
  diseaseProgressionDescriptions, biomarkerValidationDescriptions, treatmentGoalDescriptions,
  immuneResetDescriptions, targetSpecificityDescriptions, diseaseSeverityDescriptions,
  metabolicTreatmentApproachDescriptions, mechanismDifferentiationDescriptions,
  weightLossEfficacyDescriptions, routeOfAdministrationDescriptions, comorbidityBreadthDescriptions,
  sectionHelp,
} from '@/lib/optionDescriptions';
import { getMultiplierImpactBadge, type ImpactBadge } from '@/lib/impactBadges';
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
  column,
}: AdvancedOptionsSectionProps) {
  if (column === 'competitive') {
    return (
      <div className={onboardingStep === 'modifiers' ? 'onboarding-spotlight p-4 -m-4 bg-white rounded-xl' : ''}>
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-teal-500/50 text-white text-xs flex items-center justify-center">3</span>
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
            columns={3}
          />
        </div>
      </div>
    );
  }

  if (column === 'deal-scope') {
    return (
      <div>
        <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-teal-500/30 text-teal-700 text-xs flex items-center justify-center">4</span>
          Deal Scope
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Territory<InfoTooltip content={sectionHelp.territory} /></label>
            <select
              value={territory}
              onChange={(e) => onTerritoryChange(e.target.value as Territory)}
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
    );
  }

  if (column === 'right') {
    return (
      <>
        {/* Competitive Landscape Section */}
        <div className={onboardingStep === 'modifiers' ? 'onboarding-spotlight p-4 -m-4 bg-white rounded-xl' : ''}>
          <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500/50 text-white text-xs flex items-center justify-center">3</span>
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
            <span className="w-6 h-6 rounded-full bg-teal-500/30 text-teal-700 text-xs flex items-center justify-center">4</span>
            Deal Scope
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Territory<InfoTooltip content={sectionHelp.territory} /></label>
              <select
                value={territory}
                onChange={(e) => onTerritoryChange(e.target.value as Territory)}
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
          <span className="w-6 h-6 rounded-full bg-teal-500/70 text-white text-xs flex items-center justify-center">2</span>
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
              columns={3}
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
              columns={3}
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
              columns={3}
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
              columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
                columns={3}
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
            columns={3}
          />
        </div>
      </div>
    </>
  );
});

export default AdvancedOptionsSection;
