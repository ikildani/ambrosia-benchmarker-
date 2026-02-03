'use client';

import { useState } from 'react';
import { ParameterSensitivity, ParameterOption, formatDelta } from '@/lib/sensitivity';
import { formatCurrency } from '@/lib/calculations';
import ImpactBadge from './ImpactBadge';

interface ParameterSelectorProps {
  sensitivity: ParameterSensitivity;
  selectedValue: string;
  onSelect: (value: string) => void;
  showAllOptions?: boolean;
}

const MAX_VISIBLE_OPTIONS = 5;

export default function ParameterSelector({
  sensitivity,
  selectedValue,
  onSelect,
  showAllOptions = false,
}: ParameterSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(showAllOptions);
  const { label, options, impactLevel, currentValue } = sensitivity;

  const visibleOptions = isExpanded ? options : options.slice(0, MAX_VISIBLE_OPTIONS);
  const hasMoreOptions = options.length > MAX_VISIBLE_OPTIONS;
  const hiddenCount = options.length - MAX_VISIBLE_OPTIONS;

  return (
    <div className="border border-neutral-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600">
        <h4 className="text-sm font-semibold text-neutral-800 dark:text-slate-200 uppercase tracking-wide">
          {label}
        </h4>
        <ImpactBadge level={impactLevel} />
      </div>

      {/* Options */}
      <div className="p-2">
        {visibleOptions.map((option) => (
          <OptionRow
            key={option.value}
            option={option}
            isSelected={option.value === selectedValue}
            isCurrent={option.value === currentValue}
            onSelect={() => onSelect(option.value)}
          />
        ))}

        {/* Show more button */}
        {hasMoreOptions && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full mt-1 py-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded transition-colors"
          >
            Show {hiddenCount} more...
          </button>
        )}
        {hasMoreOptions && isExpanded && (
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full mt-1 py-2 text-sm text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700/50 rounded transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

interface OptionRowProps {
  option: ParameterOption;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
}

function OptionRow({ option, isSelected, isCurrent, onSelect }: OptionRowProps) {
  const deltaDisplay = formatDelta(option.delta, option.deltaPercent);
  const isPositive = option.delta > 0;
  const isNegative = option.delta < 0;

  return (
    <label
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all
        ${isSelected
          ? 'bg-teal-50 dark:bg-teal-900/30 ring-1 ring-teal-500 dark:ring-teal-400'
          : 'hover:bg-neutral-50 dark:hover:bg-slate-700/50'
        }
      `}
    >
      {/* Radio button */}
      <div className="flex-shrink-0">
        <div
          className={`
            w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
            ${isSelected
              ? 'border-teal-500 dark:border-teal-400'
              : 'border-neutral-300 dark:border-slate-500'
            }
          `}
        >
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400" />
          )}
        </div>
        <input
          type="radio"
          checked={isSelected}
          onChange={onSelect}
          className="sr-only"
        />
      </div>

      {/* Option label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isSelected ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-slate-300'}`}>
            {option.label}
          </span>
          {isCurrent && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-neutral-200 dark:bg-slate-600 text-neutral-600 dark:text-slate-300 rounded">
              CURRENT
            </span>
          )}
        </div>
      </div>

      {/* Value and delta */}
      <div className="flex-shrink-0 text-right">
        <div className="text-sm font-medium text-neutral-900 dark:text-white">
          {formatCurrency(option.resultingTotalValue)}
        </div>
        <div
          className={`text-xs ${
            isCurrent
              ? 'text-neutral-500 dark:text-slate-400'
              : isPositive
              ? 'text-teal-600 dark:text-teal-400'
              : isNegative
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-neutral-500 dark:text-slate-400'
          }`}
        >
          {deltaDisplay}
        </div>
      </div>
    </label>
  );
}
