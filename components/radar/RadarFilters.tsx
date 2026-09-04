'use client';

import { useCallback } from 'react';

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
  { value: '', label: 'All TAs' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'rare_disease', label: 'Rare Disease' },
  { value: 'infectious_disease', label: 'Infectious Disease' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'womens_health', label: "Women's Health" },
];

const MODALITY_OPTIONS = [
  { value: '', label: 'All Modalities' },
  { value: 'small_molecule', label: 'Small Molecule' },
  { value: 'monoclonal_antibody', label: 'Monoclonal Antibody' },
  { value: 'adc', label: 'ADC' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'car_t', label: 'CAR-T' },
  { value: 'cell_therapy', label: 'Cell Therapy' },
  { value: 'gene_therapy', label: 'Gene Therapy' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'peptide', label: 'Peptide' },
  { value: 'oligonucleotide', label: 'Oligonucleotide' },
  { value: 'vaccine', label: 'Vaccine' },
  { value: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
];

const PHASE_OPTIONS = [
  { value: '', label: 'All Phases' },
  { value: 'Early Phase 1', label: 'Early Phase 1' },
  { value: 'Phase 1', label: 'Phase 1' },
  { value: 'Phase 1/Phase 2', label: 'Phase 1/2' },
  { value: 'Phase 2', label: 'Phase 2' },
  { value: 'Phase 2/Phase 3', label: 'Phase 2/3' },
  { value: 'Phase 3', label: 'Phase 3' },
  { value: 'Phase 4', label: 'Phase 4' },
];

const PARTNERSHIP_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'unpartnered', label: 'Unpartnered' },
  { value: 'partially_partnered', label: 'Partially Partnered' },
  { value: 'partnered', label: 'Partnered' },
];

const SORT_OPTIONS = [
  { value: 'licensing_intent', label: 'Licensing Intent' },
  { value: 'deal_readiness', label: 'Deal Readiness' },
  { value: 'competitive_heat', label: 'Competitive Heat' },
  { value: 'confidence', label: 'Data Confidence' },
  { value: 'newest', label: 'Recently Updated' },
  { value: 'phase_desc', label: 'Phase (highest first)' },
];

export function RadarFilters({ filters, onChange }: Props) {
  const set = useCallback((key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search asset or company..."
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect options={TA_OPTIONS} value={filters.ta} onChange={(v) => set('ta', v)} />
        <FilterSelect options={MODALITY_OPTIONS} value={filters.modality} onChange={(v) => set('modality', v)} />
        <FilterSelect options={PHASE_OPTIONS} value={filters.phase} onChange={(v) => set('phase', v)} />
        <FilterSelect options={PARTNERSHIP_OPTIONS} value={filters.partnership} onChange={(v) => set('partnership', v)} />
        <div className="ml-auto">
          <FilterSelect options={SORT_OPTIONS} value={filters.sort} onChange={(v) => set('sort', v)} label="Sort:" />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ options, value, onChange, label }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
