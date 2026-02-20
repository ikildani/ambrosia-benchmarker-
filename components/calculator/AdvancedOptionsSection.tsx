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
import { competitivePositionDescriptions, dataQualityDescriptions, combinationPotentialDescriptions } from '@/lib/optionDescriptions';
import OptionCardGroup from './OptionCardGroup';
import type { OnboardingStep } from '../OnboardingModal';

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
  /** Which column portion to render: 'left' = Target Profile, 'right' = Competitive Landscape + Deal Scope */
  column: 'left' | 'right';
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
              options={competitivePositionOptions}
              descriptions={competitivePositionDescriptions}
              value={competitivePosition}
              onChange={onCompetitivePositionChange}
              highlighted={highlightedFields.has('competitivePosition')}
              columns={6}
            />

            <OptionCardGroup
              id="data-quality-select"
              label="Data Quality"
              options={dataQualityOptions}
              descriptions={dataQualityDescriptions}
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
              <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Territory</label>
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
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Treatment Approach</label>
              <select
                value={treatmentApproach}
                onChange={(e) => onTreatmentApproachChange(e.target.value as TreatmentApproach)}
                className={`select-field transition-all duration-300 ${highlightedFields.has('treatmentApproach') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
              >
                {treatmentApproachOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          ) : therapeuticArea === 'metabolic' ? (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                Treatment Approach
                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold tracking-wider align-middle">METAB</span>
              </label>
              <select
                value={metabolicTreatmentApproach}
                onChange={(e) => onMetabolicTreatmentApproachChange(e.target.value as MetabolicTreatmentApproach)}
                className="select-field"
              >
                {metabolicTreatmentApproachOptions.map((option) => (
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
                onChange={(e) => onTreatmentGoalChange(e.target.value as ImmunologyTreatmentGoal)}
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
                onChange={(e) => onLineOfTherapyChange(e.target.value as LineOfTherapy)}
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
                  onChange={(e) => onBbbPenetrationChange(e.target.value as BBBPenetration)}
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
                  onChange={(e) => onDiseaseProgressionChange(e.target.value as DiseaseProgression)}
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
                  onChange={(e) => onBiomarkerValidationChange(e.target.value as BiomarkerValidation)}
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
                  onChange={(e) => onImmuneResetPotentialChange(e.target.value as ImmuneResetPotential)}
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
                  onChange={(e) => onTargetSpecificityChange(e.target.value as TargetSpecificity)}
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
                  onChange={(e) => onDiseaseSeverityChange(e.target.value as DiseaseSeverity)}
                  className="select-field"
                >
                  {diseaseSeverityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {therapeuticArea === 'metabolic' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                  Mechanism Differentiation
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold tracking-wider align-middle">METAB</span>
                </label>
                <select
                  value={mechanismDifferentiation}
                  onChange={(e) => onMechanismDifferentiationChange(e.target.value as MechanismDifferentiation)}
                  className="select-field"
                >
                  {mechanismDifferentiationOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                  Weight Loss Efficacy
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold tracking-wider align-middle">METAB</span>
                </label>
                <select
                  value={weightLossEfficacy}
                  onChange={(e) => onWeightLossEfficacyChange(e.target.value as WeightLossEfficacy)}
                  className="select-field"
                >
                  {weightLossEfficacyOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                  Route of Administration
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold tracking-wider align-middle">METAB</span>
                </label>
                <select
                  value={routeOfAdministration}
                  onChange={(e) => onRouteOfAdministrationChange(e.target.value as RouteOfAdministration)}
                  className="select-field"
                >
                  {routeOfAdministrationOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
                  Comorbidity Breadth
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold tracking-wider align-middle">METAB</span>
                </label>
                <select
                  value={comorbidityBreadth}
                  onChange={(e) => onComorbidityBreadthChange(e.target.value as ComorbidityBreadth)}
                  className="select-field"
                >
                  {comorbidityBreadthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <OptionCardGroup
            id="combination-potential-select"
            label="Combination Potential"
            options={combinationPotentialOptions}
            descriptions={combinationPotentialDescriptions}
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
