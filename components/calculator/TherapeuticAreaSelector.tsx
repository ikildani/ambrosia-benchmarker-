import React, { useCallback, useRef } from 'react';
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

    // Move focus to the newly selected button
    const groupEl = groupRef.current;
    if (groupEl) {
      const buttons = groupEl.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[nextIndex]?.focus();
    }
  }, [therapeuticArea, selectArea]);

  return (
    <div className="mb-6 lg:mb-8">
      <label id="therapeutic-area-label" className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2">Therapeutic Area</label>
      <div ref={groupRef} role="radiogroup" aria-labelledby="therapeutic-area-label" onKeyDown={handleKeyDown} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {therapeuticAreaOptions.map((option) => {
          const isSelected = therapeuticArea === option.value;
          return (
            <button
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectArea(option.value as TherapeuticArea)}
              className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                isSelected
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 shadow-sm'
                  : 'border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:border-teal-300 dark:hover:border-teal-600'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default TherapeuticAreaSelector;
