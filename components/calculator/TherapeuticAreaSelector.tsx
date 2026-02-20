import React from 'react';
import type { TherapeuticArea } from '@/lib/calculations';
import { therapeuticAreaOptions } from '@/lib/calculations';

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
  return (
    <div className="mb-6 lg:mb-8">
      <label className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2">Therapeutic Area</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {therapeuticAreaOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              const newArea = option.value as TherapeuticArea;
              if (newArea !== therapeuticArea) {
                if (hasResult) {
                  onConfirmSwitch(newArea);
                } else {
                  onSelect(newArea);
                }
              }
            }}
            className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
              therapeuticArea === option.value
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 shadow-sm'
                : 'border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:border-teal-300 dark:hover:border-teal-600'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
});

export default TherapeuticAreaSelector;
