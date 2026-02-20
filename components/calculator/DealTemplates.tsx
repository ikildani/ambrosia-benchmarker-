import React from 'react';
import { Circle, Star, Hexagon, Dna, Globe2, CheckCircle } from 'lucide-react';
import type {
  TherapeuticArea,
  Modality,
  Indication,
  TreatmentApproach,
} from '@/lib/calculations';
import { DEAL_STATS } from '@/lib/config/constants';
import type { DealTemplate } from './types';

export const DEAL_TEMPLATES: DealTemplate[] = [
  {
    id: 'standard-phase2',
    name: 'Standard Phase 2',
    description: 'Most common deal type',
    icon: 'standard',
    values: {
      phase: 'phase2',
      modality: 'smallMolecule',
      indication: 'lung_nsclc',
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'first-in-class',
    name: 'First-in-Class',
    description: 'Premium positioning',
    icon: 'premium',
    values: {
      phase: 'phase1',
      modality: 'bispecific',
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'late-stage-adc',
    name: 'Late-Stage ADC',
    description: 'High-value acquisitions',
    icon: 'highValue',
    values: {
      phase: 'phase3',
      modality: 'adc',
      indication: 'breast_her2',
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'pivotalReady',
    },
  },
  {
    id: 'platform-multi-asset',
    name: 'Platform / Multi-Asset',
    description: 'CAR-T, gene therapy',
    icon: 'platform',
    values: {
      phase: 'phase1',
      modality: 'carT_solid',
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'regional-carveout',
    name: 'Regional Carve-Out',
    description: 'China/Japan rights only',
    icon: 'regional',
    values: {
      phase: 'phase2',
      territory: 'china',
    },
  },
  {
    id: 'commercial-asset',
    name: 'Commercial Asset',
    description: 'Approved products',
    icon: 'commercial',
    values: {
      phase: 'approved',
      territory: 'global',
      dataQuality: 'pivotalReady',
    },
  },
];

export const NEUROLOGY_TEMPLATES: DealTemplate[] = [
  {
    id: 'neuro-alzheimers-bbb',
    name: "Alzheimer's BBB Platform",
    description: 'High-value CNS delivery',
    icon: 'highValue',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase1',
      modality: 'bbbPlatform' as Modality,
      indication: 'alzheimers' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'neuro-phase2-depression',
    name: 'Phase 2 Depression',
    description: 'Psychiatry pipeline',
    icon: 'standard',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase2',
      modality: 'smallMolecule',
      indication: 'depression' as Indication,
      territory: 'global',
      treatmentApproach: 'symptomatic' as TreatmentApproach,
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'neuro-rare-gene-therapy',
    name: 'Rare Neuro Gene Therapy',
    description: 'Orphan + gene therapy premium',
    icon: 'platform',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase1',
      modality: 'geneTherapy',
      indication: 'rareNeuro' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'neuro-parkinsons-bestinclass',
    name: "Parkinson's Best-in-Class",
    description: 'Disease-modifying potential',
    icon: 'premium',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase2',
      modality: 'mab',
      indication: 'parkinsons' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'neuro-schizophrenia-novel',
    name: 'Schizophrenia Novel MOA',
    description: 'KarXT-era paradigm shift',
    icon: 'premium',
    values: {
      therapeuticArea: 'neurology',
      phase: 'phase2',
      modality: 'smallMolecule',
      indication: 'schizophrenia' as Indication,
      territory: 'global',
      treatmentApproach: 'symptomatic' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'neuro-epilepsy-aso',
    name: 'Epilepsy ASO',
    description: 'Genetic epilepsy target',
    icon: 'platform',
    values: {
      therapeuticArea: 'neurology',
      phase: 'preclinical',
      modality: 'aso' as Modality,
      indication: 'epilepsy' as Indication,
      territory: 'global',
      treatmentApproach: 'diseaseModifying' as TreatmentApproach,
      competitivePosition: 'firstInClass',
      dataQuality: 'limited',
    },
  },
];

export const IMMUNOLOGY_TEMPLATES: DealTemplate[] = [
  {
    id: 'immuno-tl1a-ibd',
    name: 'Phase 2 Anti-TL1A (IBD)',
    description: 'Hottest autoimmune target',
    icon: 'highValue',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase2',
      modality: 'tl1aInhibitor' as Modality,
      indication: 'crohns' as Indication,
      territory: 'global',
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'immuno-cart-lupus',
    name: 'Autoimmune CAR-T (Lupus)',
    description: 'Curative potential',
    icon: 'platform',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase1',
      modality: 'carT_autoimmune' as Modality,
      indication: 'sle_lupus' as Indication,
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
  {
    id: 'immuno-oral-integrin',
    name: 'Oral Integrin (UC)',
    description: 'Oral vedolizumab thesis',
    icon: 'premium',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase2',
      modality: 'oralIntegrin' as Modality,
      indication: 'ulcerativeColitis' as Indication,
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'immuno-fcrn-mg',
    name: 'FcRn Antagonist (MG)',
    description: 'Validated platform',
    icon: 'commercial',
    values: {
      therapeuticArea: 'immunology',
      phase: 'phase2',
      modality: 'fcrnAntagonist' as Modality,
      indication: 'myastheniaGravis' as Indication,
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
];

export const METABOLIC_TEMPLATES: DealTemplate[] = [
  {
    id: 'met-oral-glp1-obesity',
    name: 'Oral GLP-1 (Obesity)',
    description: 'Holy grail of metabolic',
    icon: 'highValue',
    values: {
      therapeuticArea: 'metabolic',
      phase: 'phase2',
      modality: 'oralPeptide' as Modality,
      indication: 'obesity' as Indication,
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'met-dual-incretin',
    name: 'Dual Incretin (Obesity)',
    description: 'Tirzepatide-class',
    icon: 'premium',
    values: {
      therapeuticArea: 'metabolic',
      phase: 'phase2',
      modality: 'dualIncretin' as Modality,
      indication: 'obesity' as Indication,
      territory: 'global',
      competitivePosition: 'racing',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'met-mash-treatment',
    name: 'NASH/MASH Therapy',
    description: 'Liver disease pipeline',
    icon: 'standard',
    values: {
      therapeuticArea: 'metabolic',
      phase: 'phase2',
      modality: 'smallMolecule' as Modality,
      indication: 'nashMash' as Indication,
      territory: 'global',
      competitivePosition: 'bestInClass',
      dataQuality: 'strongPhase2',
    },
  },
  {
    id: 'met-rare-gene-therapy',
    name: 'Rare Metabolic Gene Therapy',
    description: 'Orphan + curative',
    icon: 'platform',
    values: {
      therapeuticArea: 'metabolic',
      phase: 'phase1',
      modality: 'geneTherapy' as Modality,
      indication: 'rareMetabolic' as Indication,
      territory: 'global',
      competitivePosition: 'firstInClass',
      dataQuality: 'promising',
    },
  },
];

export const TEMPLATE_ICONS: Record<DealTemplate['icon'], React.ComponentType<{ className?: string }>> = {
  standard: Circle,
  premium: Star,
  highValue: Hexagon,
  platform: Dna,
  regional: Globe2,
  commercial: CheckCircle,
};

interface DealTemplatesGridProps {
  therapeuticArea: TherapeuticArea;
  highlightedFields: Set<string>;
  onApplyTemplate: (template: DealTemplate) => void;
  onHideTemplates: () => void;
  isCalculating: boolean;
}

const DealTemplatesGrid = React.memo(function DealTemplatesGrid({
  therapeuticArea,
  onApplyTemplate,
  onHideTemplates,
}: DealTemplatesGridProps) {
  const templates = therapeuticArea === 'metabolic'
    ? METABOLIC_TEMPLATES
    : therapeuticArea === 'neurology'
    ? NEUROLOGY_TEMPLATES
    : therapeuticArea === 'immunology'
    ? IMMUNOLOGY_TEMPLATES
    : DEAL_TEMPLATES;

  const subtitle = therapeuticArea === 'metabolic'
    ? `Based on 35+ metabolic/obesity R&D partnerships (2022-2026)`
    : therapeuticArea === 'neurology'
    ? `Based on ${DEAL_STATS.NEUROLOGY_DEALS} ${DEAL_STATS.NEUROLOGY_DEALS_DESCRIPTION}`
    : therapeuticArea === 'immunology'
    ? `Based on 48 immunology/autoimmune R&D partnerships (2019-2026)`
    : `Based on ${DEAL_STATS.TOTAL_DEALS} analyzed deals`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 border-b border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-navy-800 dark:text-white">Start with a template</h3>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((template) => {
          const IconComponent = TEMPLATE_ICONS[template.icon];
          return (
            <button
              key={template.id}
              onClick={() => onApplyTemplate(template)}
              className="p-4 rounded-xl border-2 border-neutral-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500
                         bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-slate-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50
                              flex items-center justify-center mb-3 transition-colors">
                <IconComponent className="w-5 h-5 text-neutral-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
              </div>
              <div className="font-semibold text-navy-800 dark:text-white text-sm">{template.name}</div>
              <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1">{template.description}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-neutral-200 dark:bg-slate-700" />
        <span className="text-xs text-neutral-400 dark:text-slate-500">or</span>
        <div className="flex-1 h-px bg-neutral-200 dark:bg-slate-700" />
      </div>

      <button
        onClick={onHideTemplates}
        className="mt-4 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-1 group"
      >
        Start from scratch
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
});

export default DealTemplatesGrid;
