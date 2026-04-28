'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface GroupedOptions {
  group: string;
  options: Option[];
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  groupedOptions?: GroupedOptions[];
  placeholder?: string;
  label?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  groupedOptions,
  placeholder = 'Select...',
  label,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten grouped options for keyboard nav
  const flatOptions: Option[] = groupedOptions
    ? groupedOptions.flatMap(g => g.options)
    : options || [];

  const selectedLabel = flatOptions.find(o => o.value === value)?.label || '';

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightIndex(Math.max(0, flatOptions.findIndex(o => o.value === value)));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => Math.min(prev + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatOptions.length) {
          onChange(flatOptions[highlightIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [isOpen, highlightIndex, flatOptions, onChange, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-option]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const renderOption = (opt: Option, index: number) => {
    const isSelected = opt.value === value;
    const isHighlighted = index === highlightIndex;

    return (
      <button
        key={opt.value}
        data-option
        type="button"
        onClick={() => handleSelect(opt.value)}
        onMouseEnter={() => setHighlightIndex(index)}
        className={`
          w-full flex items-center justify-between px-3.5 py-2.5 text-left text-sm
          transition-colors duration-75 rounded-lg mx-0.5
          ${isHighlighted ? 'bg-teal-500/10 text-white' : 'text-slate-300 hover:bg-white/[0.04]'}
          ${isSelected ? 'text-teal-400 font-medium' : ''}
        `}
      >
        <span>{opt.label}</span>
        {isSelected && (
          <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
        )}
      </button>
    );
  };

  let optionIndex = 0;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-semibold text-slate-200 mb-2">{label}</label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          w-full flex items-center justify-between px-4 py-3 rounded-xl
          border text-sm text-left transition-all duration-150
          ${isOpen
            ? 'border-teal-500 ring-2 ring-teal-500/20 bg-slate-800'
            : 'border-slate-600 bg-slate-800/80 hover:border-slate-500'
          }
          ${value ? 'text-white' : 'text-slate-400'}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={value ? '' : 'opacity-60'}>{selectedLabel || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 mt-2 w-full max-h-[320px] overflow-y-auto
              bg-[#0d1420] border border-slate-700/80 rounded-xl shadow-2xl shadow-black/40
              p-1.5 backdrop-blur-sm"
            role="listbox"
            onKeyDown={handleKeyDown}
          >
            {groupedOptions ? (
              groupedOptions.map(group => (
                <div key={group.group}>
                  <div className="px-3.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.group}
                  </div>
                  {group.options.map(opt => {
                    const idx = optionIndex++;
                    return renderOption(opt, idx);
                  })}
                </div>
              ))
            ) : (
              flatOptions.map((opt, idx) => renderOption(opt, idx))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
