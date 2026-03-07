import React, { useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ImpactBadge } from '@/lib/impactBadges';
import InfoTooltip from './InfoTooltip';

interface OptionCardGroupProps<T extends string> {
  label: string;
  helpText?: string;
  options: { value: string; label: string }[];
  descriptions?: Record<string, string>;
  impactBadges?: Record<string, ImpactBadge>;
  value: T;
  onChange: (value: T) => void;
  highlighted?: boolean;
  columns?: 3 | 5 | 6;
  id: string;
}

function OptionCardGroupInner<T extends string>({
  label,
  helpText,
  options,
  descriptions,
  impactBadges,
  value,
  onChange,
  highlighted,
  columns = 3,
  id,
}: OptionCardGroupProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = options.findIndex(o => o.value === value);
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + options.length) % options.length;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange(options[nextIndex].value as T);

    const groupEl = groupRef.current;
    if (groupEl) {
      const buttons = groupEl.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[nextIndex]?.focus();
    }
  }, [options, value, onChange]);

  const gridClass = columns === 5
    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'
    : columns === 6
    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2';

  // Unique layout group per instance
  const layoutGroupId = `option-card-${id}`;

  return (
    <div className="space-y-2">
      <label id={id} className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">
        {label}
        {helpText && <InfoTooltip content={helpText} />}
      </label>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={id}
        onKeyDown={handleKeyDown}
        className={gridClass}
      >
        {options.map((option) => {
          const isSelected = value === option.value;
          const description = descriptions?.[option.value];
          const badge = impactBadges?.[option.value];
          return (
            <motion.button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(option.value as T)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`relative px-3 py-2.5 rounded-xl border-2 text-left transition-colors duration-200 touch-feedback ${
                isSelected
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 shadow-sm shadow-teal-500/10'
                  : 'border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:border-teal-300 dark:hover:border-teal-600 hover:shadow-sm'
              } ${highlighted ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
            >
              {/* Animated selection background */}
              {isSelected && (
                <motion.div
                  layoutId={layoutGroupId}
                  className="absolute inset-0 rounded-[10px] bg-teal-50 dark:bg-teal-900/20 -z-10"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <div className={`text-sm font-medium ${isSelected ? 'text-teal-700 dark:text-teal-400' : 'text-neutral-800 dark:text-slate-200'}`}>
                {option.label}
              </div>
              {description && (
                <div className={`text-xs mt-0.5 leading-tight ${isSelected ? 'text-teal-600/70 dark:text-teal-400/60' : 'text-neutral-400 dark:text-slate-500'}`}>
                  {description}
                </div>
              )}
              {badge && (
                <span className={`inline-flex items-center px-1.5 py-0.5 mt-1.5 rounded text-xs font-bold tracking-wide ${
                  badge.type === 'premium' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  badge.type === 'discount' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  badge.type === 'base' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-neutral-100 text-neutral-500 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  {badge.label}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const OptionCardGroup = React.memo(OptionCardGroupInner) as typeof OptionCardGroupInner;
export default OptionCardGroup;
