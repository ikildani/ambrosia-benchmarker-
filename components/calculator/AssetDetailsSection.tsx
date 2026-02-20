import React from 'react';
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
import { phaseDescriptions } from '@/lib/optionDescriptions';
import OptionCardGroup from './OptionCardGroup';
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

  return (
    <div className={onboardingStep === 'big-three' ? 'onboarding-spotlight p-4 -m-4 bg-white rounded-xl' : ''}>
      <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center">1</span>
        Asset Details
      </h3>
      <div className="space-y-4">
        <OptionCardGroup
          id="phase-select"
          label="Development Phase"
          options={phaseOptions}
          descriptions={phaseDescriptions}
          value={phase}
          onChange={onPhaseChange}
          highlighted={highlightedFields.has('phase')}
          columns={5}
        />

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Modality</label>
          <select
            value={modality}
            onChange={(e) => onModalityChange(e.target.value as Modality)}
            className={`select-field transition-all duration-300 ${highlightedFields.has('modality') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
          >
            {modalityOptionsList.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Primary Indication</label>
          <select
            value={indication}
            onChange={(e) => onIndicationChange(e.target.value as Indication)}
            className={`select-field transition-all duration-300 ${highlightedFields.has('indication') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
          >
            {indicationOptionsList.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

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
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">Biomarker Status</label>
          <select
            value={biomarker}
            onChange={(e) => onBiomarkerChange(e.target.value as BiomarkerStatus)}
            className={`select-field transition-all duration-300 ${highlightedFields.has('biomarker') ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
          >
            {biomarkerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        )}
      </div>
    </div>
  );
});

export default AssetDetailsSection;
