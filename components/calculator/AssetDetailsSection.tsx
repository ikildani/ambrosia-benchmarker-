import React, { useMemo } from 'react';
import type {
  TherapeuticArea,
  Phase,
  Modality,
  Indication,
  BiomarkerStatus,
} from '@/lib/calculations';
import {
  phaseOptions,
  modalityOptions,
  neurologyModalityOptions,
  immunologyModalityOptions,
  metabolicModalityOptions,
  indicationOptions,
  neurologyIndicationOptions,
  immunologyIndicationOptions,
  metabolicIndicationOptions,
  biomarkerOptions,
} from '@/lib/calculations';
import { phaseDescriptions, biomarkerDescriptions, sectionHelp } from '@/lib/optionDescriptions';
import { getPhaseImpactBadge, getModalityImpactBadge, getMultiplierImpactBadge, getIndicationImpactBadge, type ImpactBadge } from '@/lib/impactBadges';
import { STEP_ACCENTS } from '@/lib/areaAccents';
import OptionCardGroup from './OptionCardGroup';
import SearchableCombobox from './SearchableCombobox';
import type { OnboardingStep } from '../OnboardingModal';

interface AssetDetailsSectionProps {
  therapeuticArea: TherapeuticArea;
  phase: Phase;
  modality: Modality;
  indication: Indication;
  biomarker: BiomarkerStatus;
  highlightedFields: Set<string>;
  quickMode: boolean;
  onboardingStep: OnboardingStep | null;
  onPhaseChange: (value: Phase) => void;
  onModalityChange: (value: Modality) => void;
  onIndicationChange: (value: Indication) => void;
  onBiomarkerChange: (value: BiomarkerStatus) => void;
  onShowAdvanced: () => void;
}

const AssetDetailsSection = React.memo(function AssetDetailsSection({
  therapeuticArea,
  phase,
  modality,
  indication,
  biomarker,
  highlightedFields,
  quickMode,
  onboardingStep,
  onPhaseChange,
  onModalityChange,
  onIndicationChange,
  onBiomarkerChange,
  onShowAdvanced,
}: AssetDetailsSectionProps) {
  const modalityOptionsList = therapeuticArea === 'metabolic'
    ? metabolicModalityOptions
    : therapeuticArea === 'neurology'
    ? neurologyModalityOptions
    : therapeuticArea === 'immunology'
    ? immunologyModalityOptions
    : modalityOptions;

  const indicationOptionsList = therapeuticArea === 'metabolic'
    ? metabolicIndicationOptions
    : therapeuticArea === 'neurology'
    ? neurologyIndicationOptions
    : therapeuticArea === 'immunology'
    ? immunologyIndicationOptions
    : indicationOptions;

  const phaseImpactBadges = useMemo(() => {
    const badges: Record<string, ImpactBadge> = {};
    phaseOptions.forEach(opt => {
      badges[opt.value] = getPhaseImpactBadge(opt.value, therapeuticArea);
    });
    return badges;
  }, [therapeuticArea]);

  const biomarkerImpactBadges = useMemo(() => {
    const badges: Record<string, ImpactBadge> = {};
    biomarkerOptions.forEach(opt => {
      badges[opt.value] = getMultiplierImpactBadge('biomarker', opt.value);
    });
    return badges;
  }, []);

  const modalityBadges = useMemo(() => {
    const badges: Record<string, ImpactBadge> = {};
    modalityOptionsList.forEach(group => {
      group.options.forEach(opt => {
        badges[opt.value] = getModalityImpactBadge(opt.value);
      });
    });
    return badges;
  }, [modalityOptionsList]);

  const indicationBadges = useMemo(() => {
    const badges: Record<string, ImpactBadge> = {};
    indicationOptionsList.forEach(group => {
      group.options.forEach(opt => {
        badges[opt.value] = getIndicationImpactBadge(opt.value);
      });
    });
    return badges;
  }, [indicationOptionsList]);

  return (
    <div className={onboardingStep === 'big-three' ? 'onboarding-spotlight p-4 -m-4 bg-white rounded-xl' : ''}>
      <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
        <span className={`w-6 h-6 rounded-full ${STEP_ACCENTS[therapeuticArea].bg} text-white text-xs flex items-center justify-center transition-colors duration-300`}>1</span>
        Asset Details
      </h3>
      <div className="space-y-4">
        <OptionCardGroup
          id="phase-select"
          label="Development Phase"
          helpText={sectionHelp.phase}
          options={phaseOptions}
          descriptions={phaseDescriptions}
          impactBadges={phaseImpactBadges}
          value={phase}
          onChange={onPhaseChange}
          highlighted={highlightedFields.has('phase')}
          columns={5}
        />

        <SearchableCombobox
          id="modality-select"
          label="Modality"
          helpText={sectionHelp.modality}
          groups={modalityOptionsList}
          value={modality}
          onChange={onModalityChange}
          highlighted={highlightedFields.has('modality')}
          impactBadge={getModalityImpactBadge(modality)}
          optionBadges={modalityBadges}
        />

        <SearchableCombobox
          id="indication-select"
          label="Primary Indication"
          helpText={sectionHelp.indication}
          groups={indicationOptionsList}
          value={indication}
          onChange={onIndicationChange}
          highlighted={highlightedFields.has('indication')}
          impactBadge={indicationBadges[indication]}
          optionBadges={indicationBadges}
        />

        {quickMode && (
          <button
            onClick={onShowAdvanced}
            className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium mt-1 group"
          >
            <span>Show Advanced Options</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {!quickMode && (
        <OptionCardGroup
          id="biomarker-select"
          label="Biomarker Status"
          helpText={sectionHelp.biomarker}
          options={biomarkerOptions}
          descriptions={biomarkerDescriptions}
          impactBadges={biomarkerImpactBadges}
          value={biomarker}
          onChange={onBiomarkerChange}
          highlighted={highlightedFields.has('biomarker')}
          columns={3}
        />
        )}
      </div>
    </div>
  );
});

export default AssetDetailsSection;
