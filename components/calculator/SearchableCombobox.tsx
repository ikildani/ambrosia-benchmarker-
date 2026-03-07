'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import type { ImpactBadge } from '@/lib/impactBadges';
import InfoTooltip from './InfoTooltip';

export interface GroupedOption {
  group: string;
  options: { value: string; label: string }[];
}

interface SearchableComboboxProps<T extends string> {
  id: string;
  label: string;
  helpText?: string;
  groups: GroupedOption[];
  value: T;
  onChange: (value: T) => void;
  highlighted?: boolean;
  impactBadge?: ImpactBadge;
  optionBadges?: Record<string, ImpactBadge>;
}

function SearchableComboboxInner<T extends string>({
  id,
  label,
  helpText,
  groups,
  value,
  onChange,
  highlighted,
  impactBadge,
  optionBadges,
}: SearchableComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [flipUp, setFlipUp] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  useFocusTrap(sheetRef, isOpen && isMobile, () => setIsOpen(false));

  // Find selected option info
  const selectedInfo = useMemo(() => {
    for (const group of groups) {
      const found = group.options.find(o => o.value === value);
      if (found) return { label: found.label, group: group.group };
    }
    return { label: value, group: '' };
  }, [groups, value]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups
      .map(g => ({
        group: g.group,
        options: g.options.filter(o =>
          o.label.toLowerCase().includes(q) ||
          o.value.toLowerCase().includes(q) ||
          g.group.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.options.length > 0);
  }, [groups, searchQuery]);

  // Flat list of visible options for keyboard nav
  const flatOptions = useMemo(() => {
    return filteredGroups.flatMap(g => g.options);
  }, [filteredGroups]);

  // Check if dropdown should flip above trigger
  useLayoutEffect(() => {
    if (isOpen && !isMobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setFlipUp(spaceBelow < 320 && rect.top > spaceBelow);
    }
  }, [isOpen, isMobile]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setActiveIndex(-1);
    }
  }, [isOpen]);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-option-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Close on outside click (desktop)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleClick = (e: MouseEvent) => {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, isMobile]);

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue as T);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, flatOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(flatOptions.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && flatOptions[activeIndex]) {
          handleSelect(flatOptions[activeIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }, [flatOptions, activeIndex, handleSelect]);

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
    }
  }, []);

  // Track option indices across groups
  let optionIndex = 0;

  const renderOptions = () => {
    optionIndex = 0;
    return filteredGroups.map((group) => (
      <div key={group.group} role="group" aria-label={group.group}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-slate-500 px-3 py-1.5 bg-neutral-50 dark:bg-slate-900/50 sticky top-0 z-10">
          {group.group}
        </div>
        {group.options.map((option) => {
          const idx = optionIndex++;
          const isSelected = value === option.value;
          const isActive = idx === activeIndex;
          return (
            <div
              key={option.value}
              role="option"
              aria-selected={isSelected}
              data-option-index={idx}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`px-3 py-3 sm:py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                isActive
                  ? 'bg-teal-50 dark:bg-teal-900/20'
                  : isSelected
                  ? 'bg-teal-50/50 dark:bg-teal-900/10'
                  : 'hover:bg-neutral-50 dark:hover:bg-slate-800'
              } ${isSelected ? 'text-teal-700 dark:text-teal-400 font-medium' : 'text-neutral-700 dark:text-slate-300'}`}
            >
              <span className="truncate">{option.label}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {optionBadges?.[option.value] && optionBadges[option.value].type !== 'neutral' && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide whitespace-nowrap ${
                    optionBadges[option.value].type === 'premium' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    optionBadges[option.value].type === 'discount' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {optionBadges[option.value].label}
                  </span>
                )}
                {isSelected && (
                  <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ));
  };

  const badgeChip = impactBadge && impactBadge.type !== 'neutral' ? (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide whitespace-nowrap flex-shrink-0 ${
      impactBadge.type === 'premium' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
      impactBadge.type === 'discount' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    }`}>
      {impactBadge.label}
    </span>
  ) : null;

  // Mobile layout
  if (isMobile) {
    return (
      <>
        <div className="space-y-2">
          <label id={`${id}-label`} className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">{label}{helpText && <InfoTooltip content={helpText} />}</label>
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-labelledby={`${id}-label`}
            className={`select-field text-left flex items-center justify-between gap-2 ${highlighted ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="min-w-0">
              <div className="text-[10px] text-neutral-400 dark:text-slate-500 uppercase tracking-wide">{selectedInfo.group}</div>
              <div className="text-sm font-medium text-neutral-800 dark:text-slate-200 truncate">{selectedInfo.label}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {badgeChip}
              <svg className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Mobile bottom sheet */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setIsOpen(false)}
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                ref={sheetRef}
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
                onKeyDown={handleKeyDown}
                initial={prefersReducedMotion ? false : { y: '100%' }}
                animate={{ y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-slate-600" />
                </div>
                {/* Header + search */}
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-neutral-800 dark:text-white">{label}</h3>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2.5 -m-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-800"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="text"
                      role="searchbox"
                      aria-label={`Search ${label.toLowerCase()}`}
                      placeholder={`Search ${label.toLowerCase()}...`}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setActiveIndex(0); }}
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-slate-700 rounded-xl bg-neutral-50 dark:bg-slate-800 text-sm text-neutral-800 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                </div>
                {/* Options list */}
                <div ref={listRef} role="listbox" aria-labelledby={`${id}-label`} className="overflow-y-auto flex-1 pb-safe">
                  {filteredGroups.length > 0 ? renderOptions() : (
                    <div className="px-4 py-8 text-center text-sm text-neutral-400 dark:text-slate-500">
                      No matches found
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop combobox
  return (
    <div className="space-y-2 relative">
      <label id={`${id}-label`} className="block text-sm font-semibold text-neutral-700 dark:text-slate-300">{label}{helpText && <InfoTooltip content={helpText} />}</label>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label`}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => setIsOpen(!isOpen)}
        className={`select-field text-left flex items-center justify-between gap-2 cursor-pointer ${highlighted ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
      >
        <div className="min-w-0">
          <div className="text-[10px] text-neutral-400 dark:text-slate-500 uppercase tracking-wide">{selectedInfo.group}</div>
          <div className="text-sm font-medium text-neutral-800 dark:text-slate-200 truncate">{selectedInfo.label}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badgeChip}
          <motion.svg
            className="w-4 h-4 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Desktop dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            onKeyDown={handleKeyDown}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, y: flipUp ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: flipUp ? 8 : -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`absolute left-0 right-0 z-40 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden ${
              flipUp ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top'
            }`}
          >
            {/* Search */}
            <div className="p-2 border-b border-neutral-100 dark:border-slate-700">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  role="searchbox"
                  aria-label={`Search ${label.toLowerCase()}`}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setActiveIndex(0); }}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-slate-600 rounded-lg bg-neutral-50 dark:bg-slate-900 text-sm text-neutral-800 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            {/* Options */}
            <div ref={listRef} role="listbox" aria-labelledby={`${id}-label`} className="max-h-72 overflow-y-auto">
              {filteredGroups.length > 0 ? renderOptions() : (
                <div className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-slate-500">
                  No matches found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SearchableCombobox = React.memo(SearchableComboboxInner) as typeof SearchableComboboxInner;
export default SearchableCombobox;
