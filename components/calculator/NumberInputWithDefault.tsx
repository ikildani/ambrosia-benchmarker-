'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RotateCcw, Minus, Plus } from 'lucide-react';

interface NumberInputWithDefaultProps {
  label: string;
  defaultValue: number;
  value: number | undefined; // undefined = using default
  onChange: (value: number | undefined) => void; // undefined = reset to default
  min?: number;
  max?: number;
  step?: number;
  suffix?: string; // e.g., '%', 'yrs', '$M'
  disabled?: boolean;
  formatDefault?: (v: number) => string; // custom formatting for default display
}

function clamp(val: number, min?: number, max?: number): number {
  if (min !== undefined && val < min) return min;
  if (max !== undefined && val > max) return max;
  return val;
}

function roundToStep(val: number, step: number): number {
  // Avoid floating-point drift by rounding to the step's decimal precision
  const decimals = (step.toString().split('.')[1] || '').length;
  return Number(val.toFixed(decimals));
}

function NumberInputWithDefaultInner({
  label,
  defaultValue,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  suffix,
  disabled = false,
  formatDefault,
}: NumberInputWithDefaultProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);

  const isOverridden = value !== undefined;
  const displayValue = isOverridden ? value : '';
  const formattedDefault = formatDefault
    ? formatDefault(defaultValue)
    : `${defaultValue}${suffix ? ` ${suffix}` : ''}`;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Pre-fill with default value so the user can edit from there
    if (!isOverridden) {
      onChange(defaultValue);
      // Select all text after React re-renders with the new value
      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    }
  }, [isOverridden, defaultValue, onChange]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // If the value equals the default, reset to undefined
    if (value !== undefined && value === defaultValue) {
      onChange(undefined);
    }
  }, [value, defaultValue, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') {
        onChange(undefined);
        return;
      }
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(clamp(parsed, min, max));
      }
    },
    [onChange, min, max],
  );

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      const current = value ?? defaultValue;
      const next = roundToStep(current + direction * step, step);
      onChange(clamp(next, min, max));
    },
    [value, defaultValue, step, min, max, onChange],
  );

  const handleReset = useCallback(() => {
    onChange(undefined);
    inputRef.current?.blur();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleStep(1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleStep(-1);
      }
    },
    [handleStep],
  );

  const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

  return (
    <div className={`group relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div
        className={`relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border-2 transition-all duration-200 ${
          isOverridden
            ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10'
            : 'border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800'
        }`}
      >
        {/* Teal left-border accent when overridden */}
        <AnimatePresence>
          {isOverridden && (
            <motion.div
              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-teal-500"
              initial={prefersReducedMotion ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              exit={{ scaleY: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : springTransition}
            />
          )}
        </AnimatePresence>

        {/* Label */}
        <span className="text-sm font-medium text-neutral-700 dark:text-slate-300 select-none whitespace-nowrap">
          {label}
        </span>

        {/* Input group */}
        <div className="flex items-center gap-1.5">
          {/* Decrement */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label}`}
            onClick={() => handleStep(-1)}
            className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 dark:text-slate-500
                       hover:bg-neutral-100 dark:hover:bg-slate-700 hover:text-neutral-600 dark:hover:text-slate-300
                       transition-colors duration-150"
          >
            <Minus size={12} strokeWidth={2.5} />
          </button>

          {/* Number input */}
          <input
            ref={inputRef}
            type="number"
            value={displayValue}
            placeholder={String(defaultValue)}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={label}
            className="w-20 px-2 py-1 text-sm text-center rounded border border-neutral-200 dark:border-slate-600
                       bg-white dark:bg-slate-800 text-neutral-800 dark:text-slate-200
                       placeholder:text-neutral-400 dark:placeholder:text-slate-500
                       focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500
                       transition-colors duration-150
                       [font-variant-numeric:tabular-nums]
                       [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />

          {/* Suffix label */}
          {suffix && (
            <span className="text-xs text-neutral-400 dark:text-slate-500 select-none min-w-[1.5rem]">
              {suffix}
            </span>
          )}

          {/* Increment */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label}`}
            onClick={() => handleStep(1)}
            className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 dark:text-slate-500
                       hover:bg-neutral-100 dark:hover:bg-slate-700 hover:text-neutral-600 dark:hover:text-slate-300
                       transition-colors duration-150"
          >
            <Plus size={12} strokeWidth={2.5} />
          </button>

          {/* Reset button — only visible when overridden */}
          <AnimatePresence>
            {isOverridden && (
              <motion.button
                type="button"
                tabIndex={-1}
                aria-label={`Reset ${label} to default`}
                onClick={handleReset}
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 25 }}
                className="w-6 h-6 flex items-center justify-center rounded text-teal-500 dark:text-teal-400
                           hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors duration-150"
              >
                <RotateCcw size={14} strokeWidth={2} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Default value label */}
      <div className="mt-1 pl-3 text-xs text-neutral-400 dark:text-slate-500 select-none">
        Ambrosia Default: {formattedDefault}
      </div>
    </div>
  );
}

const NumberInputWithDefault = React.memo(NumberInputWithDefaultInner);
export default NumberInputWithDefault;
