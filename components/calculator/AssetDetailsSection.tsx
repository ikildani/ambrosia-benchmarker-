import React, { useMemo } from 'react';
import type {
  TherapeuticArea,
  Phase,
  DealType,
  Modality,
  Indication,
  BiomarkerStatus,
} from '@/lib/calculations';
import {
  phaseOptions,
  dealTypeOptions,
  dealTypeDescriptions,
  modalityOptions,
  neurologyModalityOptions,
  immunologyModalityOptions,
  metabolicModalityOptions,
  cardiovascularModalityOptions,
  infectiousDiseaseModalityOptions,
  ophthalmologyModalityOptions,
  womensHealthModalityOptions,
  rareDiseaseModalityOptions,
  hematologyModalityOptions,
  dermatologyModalityOptions,
  gastroenterologyModalityOptions,
  indicationOptions,
  neurologyIndicationOptions,
  immunologyIndicationOptions,
  metabolicIndicationOptions,
  cardiovascularIndicationOptions,
  infectiousDiseaseIndicationOptions,
  ophthalmologyIndicationOptions,
  womensHealthIndicationOptions,
  rareDiseaseIndicationOptions,
  hematologyIndicationOptions,
  dermatologyIndicationOptions,
  gastroenterologyIndicationOptions,
  biomarkerOptions,
} from '@/lib/calculations';
import { phaseDescriptions, biomarkerDescriptions, sectionHelp } from '@/lib/optionDescriptions';
import { getPhaseImpactBadge, getModalityImpactBadge, getMultiplierImpactBadge, getIndicationImpactBadge, type ImpactBadge } from '@/lib/impactBadges';
import { getAvailablePhases, getAvailableDealTypes, dealTypePhaseHints } from '@/lib/input-filters';
import OptionCardGroup from './OptionCardGroup';
import SearchableCombobox from './SearchableCombobox';
import type { OnboardingStep } from '../OnboardingModal';

interface AssetDetailsSectionProps {
  therapeuticArea: TherapeuticArea;
  phase: Phase;
  dealType: DealType;
  modality: Modality;
  indication: Indication;
  biomarker: BiomarkerStatus;
  highlightedFields: Set<string>;
  quickMode: boolean;
  onboardingStep: OnboardingStep | null;
  onPhaseChange: (value: Phase) => void;
  onDealTypeChange: (value: DealType) => void;
  onModalityChange: (value: Modality) => void;
  onIndicationChange: (value: Indication) => void;
  onBiomarkerChange: (value: BiomarkerStatus) => void;
  onShowAdvanced: () => void;
}

const AssetDetailsSection = React.memo(function AssetDetailsSection({
  therapeuticArea,
  phase,
  dealType,
  modality,
  indication,
  biomarker,
  highlightedFields,
  quickMode,
  onboardingStep,
  onPhaseChange,
  onDealTypeChange,
  onModalityChange,
  onIndicationChange,
  onBiomarkerChange,
  onShowAdvanced,
}: AssetDetailsSectionProps) {
  const modalityMap: Record<TherapeuticArea, typeof modalityOptions> = {
    oncology: modalityOptions,
    neurology: neurologyModalityOptions,
    immunology: immunologyModalityOptions,
    metabolic: metabolicModalityOptions,
    cardiovascular: cardiovascularModalityOptions,
    infectiousDisease: infectiousDiseaseModalityOptions,
    ophthalmology: ophthalmologyModalityOptions,
    womensHealth: womensHealthModalityOptions,
    rareDisease: rareDiseaseModalityOptions,
    hematology: hematologyModalityOptions,
    dermatology: dermatologyModalityOptions,
    gastroenterology: gastroenterologyModalityOptions,
  };
  const modalityOptionsList = modalityMap[therapeuticArea] || modalityOptions;

  const indicationMap: Record<TherapeuticArea, typeof indicationOptions> = {
    oncology: indicationOptions,
    neurology: neurologyIndicationOptions,
    immunology: immunologyIndicationOptions,
    metabolic: metabolicIndicationOptions,
    cardiovascular: cardiovascularIndicationOptions,
    infectiousDisease: infectiousDiseaseIndicationOptions,
    ophthalmology: ophthalmologyIndicationOptions,
    womensHealth: womensHealthIndicationOptions,
    rareDisease: rareDiseaseIndicationOptions,
    hematology: hematologyIndicationOptions,
    dermatology: dermatologyIndicationOptions,
    gastroenterology: gastroenterologyIndicationOptions,
  };
  const indicationOptionsList = indicationMap[therapeuticArea] || indicationOptions;

  // Filter phases based on selected deal type
  const filteredPhaseOptions = useMemo(
    () => getAvailablePhases(dealType),
    [dealType],
  );

  // Filter deal types based on selected phase
  const filteredDealTypeOptions = useMemo(
    () => getAvailableDealTypes(phase),
    [phase],
  );

  // Build deal type descriptions with phase hints
  const enrichedDealTypeDescriptions = useMemo(() => {
    const descs: Record<string, string> = {};
    for (const opt of filteredDealTypeOptions) {
      const base = dealTypeDescriptions[opt.value] || '';
      const hint = dealTypePhaseHints[opt.value as DealType];
      descs[opt.value] = hint ? `${base} (${hint})` : base;
    }
    return descs;
  }, [filteredDealTypeOptions]);

  const phaseImpactBadges = useMemo(() => {
    const badges: Record<string, ImpactBadge> = {};
    filteredPhaseOptions.forEach(opt => {
      badges[opt.value] = getPhaseImpactBadge(opt.value, therapeuticArea);
    });
    return badges;
  }, [therapeuticArea, filteredPhaseOptions]);

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
      <h3 className="text-lg font-semibold text-navy-800 dark:text-white mb-4">
        Your Asset
      </h3>
      <div className="space-y-4">
        <OptionCardGroup
          id="phase-select"
          label="Development Phase"
          helpText={sectionHelp.phase}
          options={filteredPhaseOptions}
          descriptions={phaseDescriptions}
          impactBadges={phaseImpactBadges}
          value={phase}
          onChange={onPhaseChange}
          highlighted={highlightedFields.has('phase')}
          columns={5}
        />

        <OptionCardGroup
          id="deal-type-select"
          label="Deal Structure"
          helpText="The type of transaction structure affects upfront/milestone splits and royalty terms."
          options={filteredDealTypeOptions}
          descriptions={enrichedDealTypeDescriptions}
          value={dealType}
          onChange={onDealTypeChange}
          highlighted={highlightedFields.has('dealType')}
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
