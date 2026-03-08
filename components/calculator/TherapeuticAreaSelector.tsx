import React, { useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { TherapeuticArea } from '@/lib/calculations';
import {
  therapeuticAreaOptions,
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
} from '@/lib/calculations';
import { Microscope, Brain, ShieldCheck, HeartPulse, Check, Heart, Bug, Eye, Baby, Dna, Droplets, Sparkles, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function countIndications(groups: { options: { value: string }[] }[]): number {
  return groups.reduce((sum, g) => sum + g.options.length, 0);
}

const INDICATION_COUNTS: Record<TherapeuticArea, number> = {
  oncology: countIndications(indicationOptions),
  neurology: countIndications(neurologyIndicationOptions),
  immunology: countIndications(immunologyIndicationOptions),
  metabolic: countIndications(metabolicIndicationOptions),
  cardiovascular: countIndications(cardiovascularIndicationOptions),
  infectiousDisease: countIndications(infectiousDiseaseIndicationOptions),
  ophthalmology: countIndications(ophthalmologyIndicationOptions),
  womensHealth: countIndications(womensHealthIndicationOptions),
  rareDisease: countIndications(rareDiseaseIndicationOptions),
  hematology: countIndications(hematologyIndicationOptions),
  dermatology: countIndications(dermatologyIndicationOptions),
  gastroenterology: countIndications(gastroenterologyIndicationOptions),
};

interface AreaMeta {
  icon: LucideIcon;
  description: string;
  borderSelected: string;
  bgSelected: string;
  textSelected: string;
  iconBg: string;
  iconBgSelected: string;
  checkBg: string;
  hoverBorder: string;
  countBg: string;
}

const AREA_META: Record<TherapeuticArea, AreaMeta> = {
  oncology: {
    icon: Microscope,
    description: 'Solid tumors & hematologic malignancies',
    borderSelected: 'border-teal-500',
    bgSelected: 'bg-teal-50/80 dark:bg-teal-950/30',
    textSelected: 'text-teal-800 dark:text-teal-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400',
    checkBg: 'bg-teal-500 text-white',
    hoverBorder: 'hover:border-teal-200 dark:hover:border-teal-800',
    countBg: 'bg-teal-100/80 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  },
  hematology: {
    icon: Droplets,
    description: 'Lymphoma, leukemia & blood disorders',
    borderSelected: 'border-red-500',
    bgSelected: 'bg-red-50/80 dark:bg-red-950/30',
    textSelected: 'text-red-800 dark:text-red-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
    checkBg: 'bg-red-500 text-white',
    hoverBorder: 'hover:border-red-200 dark:hover:border-red-800',
    countBg: 'bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
  neurology: {
    icon: Brain,
    description: 'Neurodegeneration, psychiatry & pain',
    borderSelected: 'border-indigo-500',
    bgSelected: 'bg-indigo-50/80 dark:bg-indigo-950/30',
    textSelected: 'text-indigo-800 dark:text-indigo-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400',
    checkBg: 'bg-indigo-500 text-white',
    hoverBorder: 'hover:border-indigo-200 dark:hover:border-indigo-800',
    countBg: 'bg-indigo-100/80 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  },
  immunology: {
    icon: ShieldCheck,
    description: 'Autoimmune & inflammatory disease',
    borderSelected: 'border-amber-500',
    bgSelected: 'bg-amber-50/80 dark:bg-amber-950/30',
    textSelected: 'text-amber-800 dark:text-amber-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400',
    checkBg: 'bg-amber-500 text-white',
    hoverBorder: 'hover:border-amber-200 dark:hover:border-amber-800',
    countBg: 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  },
  rareDisease: {
    icon: Dna,
    description: 'Orphan drugs & gene therapy',
    borderSelected: 'border-violet-500',
    bgSelected: 'bg-violet-50/80 dark:bg-violet-950/30',
    textSelected: 'text-violet-800 dark:text-violet-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
    checkBg: 'bg-violet-500 text-white',
    hoverBorder: 'hover:border-violet-200 dark:hover:border-violet-800',
    countBg: 'bg-violet-100/80 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  },
  metabolic: {
    icon: HeartPulse,
    description: 'Obesity, diabetes & NASH',
    borderSelected: 'border-emerald-500',
    bgSelected: 'bg-emerald-50/80 dark:bg-emerald-950/30',
    textSelected: 'text-emerald-800 dark:text-emerald-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    checkBg: 'bg-emerald-500 text-white',
    hoverBorder: 'hover:border-emerald-200 dark:hover:border-emerald-800',
    countBg: 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  },
  cardiovascular: {
    icon: Heart,
    description: 'Heart failure & vascular disease',
    borderSelected: 'border-rose-500',
    bgSelected: 'bg-rose-50/80 dark:bg-rose-950/30',
    textSelected: 'text-rose-800 dark:text-rose-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400',
    checkBg: 'bg-rose-500 text-white',
    hoverBorder: 'hover:border-rose-200 dark:hover:border-rose-800',
    countBg: 'bg-rose-100/80 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  },
  gastroenterology: {
    icon: Stethoscope,
    description: "Crohn's, UC & GI disorders",
    borderSelected: 'border-lime-500',
    bgSelected: 'bg-lime-50/80 dark:bg-lime-950/30',
    textSelected: 'text-lime-800 dark:text-lime-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-lime-100 dark:bg-lime-900/50 text-lime-600 dark:text-lime-400',
    checkBg: 'bg-lime-500 text-white',
    hoverBorder: 'hover:border-lime-200 dark:hover:border-lime-800',
    countBg: 'bg-lime-100/80 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400',
  },
  infectiousDisease: {
    icon: Bug,
    description: 'Antivirals, vaccines & AMR',
    borderSelected: 'border-orange-500',
    bgSelected: 'bg-orange-50/80 dark:bg-orange-950/30',
    textSelected: 'text-orange-800 dark:text-orange-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400',
    checkBg: 'bg-orange-500 text-white',
    hoverBorder: 'hover:border-orange-200 dark:hover:border-orange-800',
    countBg: 'bg-orange-100/80 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  },
  ophthalmology: {
    icon: Eye,
    description: 'Retinal, glaucoma & dry eye',
    borderSelected: 'border-cyan-500',
    bgSelected: 'bg-cyan-50/80 dark:bg-cyan-950/30',
    textSelected: 'text-cyan-800 dark:text-cyan-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-400',
    checkBg: 'bg-cyan-500 text-white',
    hoverBorder: 'hover:border-cyan-200 dark:hover:border-cyan-800',
    countBg: 'bg-cyan-100/80 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
  },
  dermatology: {
    icon: Sparkles,
    description: 'Psoriasis, AD & skin conditions',
    borderSelected: 'border-fuchsia-500',
    bgSelected: 'bg-fuchsia-50/80 dark:bg-fuchsia-950/30',
    textSelected: 'text-fuchsia-800 dark:text-fuchsia-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-600 dark:text-fuchsia-400',
    checkBg: 'bg-fuchsia-500 text-white',
    hoverBorder: 'hover:border-fuchsia-200 dark:hover:border-fuchsia-800',
    countBg: 'bg-fuchsia-100/80 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400',
  },
  womensHealth: {
    icon: Baby,
    description: 'Reproductive & maternal health',
    borderSelected: 'border-pink-500',
    bgSelected: 'bg-pink-50/80 dark:bg-pink-950/30',
    textSelected: 'text-pink-800 dark:text-pink-300',
    iconBg: 'bg-neutral-100 dark:bg-slate-700/60 text-neutral-400 dark:text-slate-500',
    iconBgSelected: 'bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400',
    checkBg: 'bg-pink-500 text-white',
    hoverBorder: 'hover:border-pink-200 dark:hover:border-pink-800',
    countBg: 'bg-pink-100/80 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  },
};

interface TherapeuticAreaSelectorProps {
  therapeuticArea: TherapeuticArea;
  onSelect: (area: TherapeuticArea) => void;
  onConfirmSwitch: (area: TherapeuticArea) => void;
  hasResult: boolean;
}

const TherapeuticAreaSelector = React.memo(function TherapeuticAreaSelector({
  therapeuticArea,
  onSelect,
  onConfirmSwitch,
  hasResult,
}: TherapeuticAreaSelectorProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const selectArea = useCallback((newArea: TherapeuticArea) => {
    if (newArea !== therapeuticArea) {
      if (hasResult) {
        onConfirmSwitch(newArea);
      } else {
        onSelect(newArea);
      }
    }
  }, [therapeuticArea, hasResult, onConfirmSwitch, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = therapeuticAreaOptions.findIndex(o => o.value === therapeuticArea);
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % therapeuticAreaOptions.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + therapeuticAreaOptions.length) % therapeuticAreaOptions.length;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextArea = therapeuticAreaOptions[nextIndex].value as TherapeuticArea;
    selectArea(nextArea);

    const groupEl = groupRef.current;
    if (groupEl) {
      const buttons = groupEl.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[nextIndex]?.focus();
    }
  }, [therapeuticArea, selectArea]);

  return (
    <div className="mb-6 lg:mb-8">
      <label id="therapeutic-area-label" className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2.5">
        Therapeutic Area
      </label>

      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="therapeutic-area-label"
        onKeyDown={handleKeyDown}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
      >
        {therapeuticAreaOptions.map((option) => {
          const area = option.value as TherapeuticArea;
          const isSelected = therapeuticArea === area;
          const meta = AREA_META[area];
          const Icon = meta.icon;
          const count = INDICATION_COUNTS[area];

          return (
            <motion.button
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${option.label}: ${meta.description}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectArea(area)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`relative flex flex-col items-center text-center px-2 py-3 sm:py-3.5 rounded-xl border-2 transition-all duration-150 cursor-pointer select-none group ${
                isSelected
                  ? `${meta.borderSelected} ${meta.bgSelected} shadow-md`
                  : `border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 ${meta.hoverBorder} hover:bg-neutral-50 dark:hover:bg-slate-800`
              }`}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors duration-150 ${
                isSelected ? meta.iconBgSelected : meta.iconBg
              }`}>
                <Icon className="w-[18px] h-[18px]" />
              </div>

              {/* Label */}
              <span className={`text-xs font-semibold leading-tight transition-colors duration-150 ${
                isSelected ? meta.textSelected : 'text-neutral-700 dark:text-slate-300'
              }`}>
                {option.label}
              </span>

              {/* Indication count */}
              <span className={`text-[10px] mt-1 font-medium tabular-nums transition-colors duration-150 ${
                isSelected
                  ? meta.textSelected + ' opacity-70'
                  : 'text-neutral-400 dark:text-slate-500'
              }`}>
                {count} indications
              </span>

              {/* Selected checkmark */}
              {isSelected && (
                <motion.div
                  layoutId="ta-check-badge"
                  className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm ${meta.checkBg}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Check className="w-3 h-3" strokeWidth={3} />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

export default TherapeuticAreaSelector;
