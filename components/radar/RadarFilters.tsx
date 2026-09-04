'use client';

import { useCallback, useState } from 'react';

interface Filters {
  ta: string;
  modality: string;
  phase: string;
  partnership: string;
  country: string;
  sort: string;
  q: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const TA_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'cardiovascular', label: 'Cardio' },
  { value: 'rare_disease', label: 'Rare Disease' },
  { value: 'infectious_disease', label: 'Infectious' },
  { value: 'ophthalmology', label: 'Ophtho' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'dermatology', label: 'Derm' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'womens_health', label: "Women's" },
];

const MODALITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'small_molecule', label: 'Small Molecule' },
  { value: 'monoclonal_antibody', label: 'mAb' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'car_t', label: 'CAR-T' },
  { value: 'cell_therapy', label: 'Cell' },
  { value: 'gene_therapy', label: 'Gene' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'peptide', label: 'Peptide' },
  { value: 'oligonucleotide', label: 'Oligo' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'radiopharmaceutical', label: 'Radiopharma' },
];

const PHASE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Early Phase 1', label: 'P1 Early' },
  { value: 'Phase 1', label: 'P1' },
  { value: 'Phase 1/Phase 2', label: 'P1/2' },
  { value: 'Phase 2', label: 'P2' },
  { value: 'Phase 2/Phase 3', label: 'P2/3' },
  { value: 'Phase 3', label: 'P3' },
  { value: 'Phase 4', label: 'P4' },
];

const PARTNERSHIP_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unpartnered', label: 'Unpartnered' },
  { value: 'partially_partnered', label: 'Partial' },
  { value: 'partnered', label: 'Partnered' },
];

const SORT_OPTIONS = [
  { value: 'licensing_intent', label: 'Intent Score' },
  { value: 'deal_readiness', label: 'Deal Readiness' },
  { value: 'competitive_heat', label: 'Competitive Heat' },
  { value: 'confidence', label: 'Confidence' },
  { value: 'newest', label: 'Recently Updated' },
];

type FilterSection = 'ta' | 'modality' | 'phase' | 'partnership' | null;

export function RadarFilters({ filters, onChange }: Props) {
  const [expandedSection, setExpandedSection] = useState<FilterSection>(null);

  const set = useCallback((key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  const toggleSection = (section: FilterSection) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const activeFilterCount = [filters.ta, filters.modality, filters.phase, filters.partnership].filter(Boolean).length;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5">
      {/* Search + Sort row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search asset name or company..."
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
          />
        </div>

        {/* Sort pills */}
        <div className="hidden lg:flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Sort</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set('sort', opt.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                filters.sort === opt.value
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter category buttons */}
      <div className="flex items-center gap-2 mt-4">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Filters</span>

        <FilterCategoryButton
          label="TA"
          active={!!filters.ta}
          activeValue={TA_OPTIONS.find(o => o.value === filters.ta)?.label}
          expanded={expandedSection === 'ta'}
          onClick={() => toggleSection('ta')}
        />
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <FilterCategoryButton
          label="Modality"
          active={!!filters.modality}
          activeValue={MODALITY_OPTIONS.find(o => o.value === filters.modality)?.label}
          expanded={expandedSection === 'modality'}
          onClick={() => toggleSection('modality')}
        />
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <FilterCategoryButton
          label="Phase"
          active={!!filters.phase}
          activeValue={PHASE_OPTIONS.find(o => o.value === filters.phase)?.label}
          expanded={expandedSection === 'phase'}
          onClick={() => toggleSection('phase')}
        />
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <FilterCategoryButton
          label="Status"
          active={!!filters.partnership}
          activeValue={PARTNERSHIP_OPTIONS.find(o => o.value === filters.partnership)?.label}
          expanded={expandedSection === 'partnership'}
          onClick={() => toggleSection('partnership')}
        />

        {activeFilterCount > 0 && (
          <>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 ml-1" />
            <button
              onClick={() => onChange({ ...filters, ta: '', modality: '', phase: '', partnership: '', country: '' })}
              className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium transition-colors"
            >
              Clear all ({activeFilterCount})
            </button>
          </>
        )}
      </div>

      {/* Expanded pill sections */}
      {expandedSection === 'ta' && (
        <PillRow
          options={TA_OPTIONS}
          value={filters.ta}
          onChange={(v) => set('ta', v)}
          accent="amber"
        />
      )}
      {expandedSection === 'modality' && (
        <PillRow
          options={MODALITY_OPTIONS}
          value={filters.modality}
          onChange={(v) => set('modality', v)}
          accent="cyan"
        />
      )}
      {expandedSection === 'phase' && (
        <PillRow
          options={PHASE_OPTIONS}
          value={filters.phase}
          onChange={(v) => set('phase', v)}
          accent="indigo"
        />
      )}
      {expandedSection === 'partnership' && (
        <PillRow
          options={PARTNERSHIP_OPTIONS}
          value={filters.partnership}
          onChange={(v) => set('partnership', v)}
          accent="teal"
        />
      )}

      {/* Mobile sort (hidden on lg) */}
      <div className="lg:hidden mt-3">
        <PillRow
          options={SORT_OPTIONS}
          value={filters.sort}
          onChange={(v) => set('sort', v)}
          accent="amber"
          label="Sort"
        />
      </div>
    </div>
  );
}

function FilterCategoryButton({ label, active, activeValue, expanded, onClick }: {
  label: string;
  active: boolean;
  activeValue?: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
          : expanded
            ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {active ? activeValue || label : label}
      <svg
        className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

const ACCENT_CLASSES = {
  amber: {
    active: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20',
    inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
  },
  teal: {
    active: 'bg-teal-500 text-white shadow-sm shadow-teal-500/20',
    inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
  },
  cyan: {
    active: 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/20',
    inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
  },
  indigo: {
    active: 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20',
    inactive: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
  },
};

function PillRow({ options, value, onChange, accent, label }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  accent: keyof typeof ACCENT_CLASSES;
  label?: string;
}) {
  const colors = ACCENT_CLASSES[accent];
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/40">
      {label && (
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">{label}</span>
      )}
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
            value === opt.value ? colors.active : colors.inactive
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
