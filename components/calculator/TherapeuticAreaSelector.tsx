import React, { useCallback, useRef } from 'react';
import type { TherapeuticArea } from '@/lib/calculations';
import {
  therapeuticAreaOptions,
  indicationOptions,
  neurologyIndicationOptions,
  immunologyIndicationOptions,
  metabolicIndicationOptions,
} from '@/lib/calculations';
import { Microscope, Brain, ShieldCheck, HeartPulse, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Compute indication counts per area
function countIndications(groups: { options: { value: string }[] }[]): { total: number; groups: number } {
  return {
    total: groups.reduce((sum, g) => sum + g.options.length, 0),
    groups: groups.length,
  };
}

const INDICATION_COUNTS: Record<TherapeuticArea, { total: number; groups: number }> = {
  oncology: countIndications(indicationOptions),
  neurology: countIndications(neurologyIndicationOptions),
  immunology: countIndications(immunologyIndicationOptions),
  metabolic: countIndications(metabolicIndicationOptions),
};

interface AreaMeta {
  icon: LucideIcon;
  description: string;
  accentClass: string;
  accentBgClass: string;
  iconBgClass: string;
  iconBgSelectedClass: string;
  hoverBorderClass: string;
}

const AREA_META: Record<TherapeuticArea, AreaMeta> = {
  oncology: {
    icon: Microscope,
    description: 'Solid tumors & hematologic malignancies',
    accentClass: 'border-teal-500 text-teal-700 dark:text-teal-400',
    accentBgClass: 'bg-teal-50 dark:bg-teal-900/20',
    iconBgClass: 'bg-neutral-100 dark:bg-slate-700 text-neutral-400 dark:text-slate-500',
    iconBgSelectedClass: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
    hoverBorderClass: 'hover:border-teal-300 dark:hover:border-teal-600',
  },
  neurology: {
    icon: Brain,
    description: 'Neurodegeneration, psychiatry & pain',
    accentClass: 'border-indigo-500 text-indigo-700 dark:text-indigo-400',
    accentBgClass: 'bg-indigo-50 dark:bg-indigo-900/20',
    iconBgClass: 'bg-neutral-100 dark:bg-slate-700 text-neutral-400 dark:text-slate-500',
    iconBgSelectedClass: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400',
    hoverBorderClass: 'hover:border-indigo-300 dark:hover:border-indigo-600',
  },
  immunology: {
    icon: ShieldCheck,
    description: 'Autoimmune, inflammatory & rare immune',
    accentClass: 'border-amber-500 text-amber-700 dark:text-amber-400',
    accentBgClass: 'bg-amber-50 dark:bg-amber-900/20',
    iconBgClass: 'bg-neutral-100 dark:bg-slate-700 text-neutral-400 dark:text-slate-500',
    iconBgSelectedClass: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    hoverBorderClass: 'hover:border-amber-300 dark:hover:border-amber-600',
  },
  metabolic: {
    icon: HeartPulse,
    description: 'Obesity, diabetes & metabolic disease',
    accentClass: 'border-emerald-500 text-emerald-700 dark:text-emerald-400',
    accentBgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconBgClass: 'bg-neutral-100 dark:bg-slate-700 text-neutral-400 dark:text-slate-500',
    iconBgSelectedClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    hoverBorderClass: 'hover:border-emerald-300 dark:hover:border-emerald-600',
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
        nextIndex = (currentIndex + 1) % therapeuticAreaOptions.length;
        break;
      case 'ArrowLeft':
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
      <label id="therapeutic-area-label" className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2">Therapeutic Area</label>
      <div ref={groupRef} role="radiogroup" aria-labelledby="therapeutic-area-label" onKeyDown={handleKeyDown} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {therapeuticAreaOptions.map((option) => {
          const area = option.value as TherapeuticArea;
          const isSelected = therapeuticArea === area;
          const meta = AREA_META[area];
          const Icon = meta.icon;
          const counts = INDICATION_COUNTS[area];
          return (
            <button
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectArea(area)}
              className={`relative px-4 py-4 rounded-xl border-2 text-left transition-all duration-200 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.97] ${
                isSelected
                  ? `${meta.accentClass} ${meta.accentBgClass} shadow-md`
                  : `border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-400 ${meta.hoverBorderClass} hover:shadow-sm`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${
                  isSelected ? meta.iconBgSelectedClass : meta.iconBgClass
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight">{option.label}</div>
                  <div className={`text-xs mt-1 leading-tight ${isSelected ? 'opacity-75' : 'text-neutral-400 dark:text-slate-500'}`}>{meta.description}</div>
                  <div className={`text-[10px] mt-1.5 font-medium ${isSelected ? 'opacity-60' : 'text-neutral-300 dark:text-slate-600'}`}>
                    {counts.total} indications
                  </div>
                </div>
              </div>
              {isSelected && (
                <div className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${meta.iconBgSelectedClass}`}>
                  <Check className="w-3 h-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default TherapeuticAreaSelector;
