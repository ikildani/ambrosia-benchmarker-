/**
 * Mandate templates by buyer archetype. Each is a full filter state plus a
 * name and one-line rationale, offered on first run and under "New mandate".
 * Values come from the shared vocabulary so a template can never store a
 * filter the feed rejects (the test suite checks this).
 */

import { EMPTY_FILTERS, type RadarFilterState } from './filter-schema';

export interface MandateTemplate {
  id: string;
  name: string;
  /** Who this is for, in one line. */
  audience: string;
  description: string;
  filters: RadarFilterState;
}

const base = (patch: Partial<RadarFilterState>): RadarFilterState => ({
  ...EMPTY_FILTERS,
  partnership: ['unpartnered', 'partially_partnered'],
  ...patch,
});

export const MANDATE_TEMPLATES: readonly MandateTemplate[] = [
  {
    id: 'midcap-oncology-inlicensing',
    name: 'Mid-cap oncology in-licensing',
    audience: 'Mid-cap pharma filling a Phase 2 to 3 oncology gap',
    description: 'Unpartnered oncology programs with clinical proof of concept, any modality, worldwide.',
    filters: base({ ta: ['oncology'], phase_min: 'phase_2', phase_max: 'phase_3', owner_type: ['industry'] }),
  },
  {
    id: 'japan-korea-ex-asia-rights',
    name: 'JP / KR pharma seeking regional rights',
    audience: 'Japanese or Korean pharma looking for Asia rights to Western programs',
    description: 'Phase 2+ programs from US and European originators where Asia rights are still open.',
    filters: base({ phase_min: 'phase_2', region: ['north_america', 'europe'], owner_type: ['industry'] }),
  },
  {
    id: 'china-forward-buyer',
    name: 'China-forward buyer',
    audience: 'Buyers scouting Chinese originators for ex-China rights',
    description: 'Clinical-stage programs from Chinese companies, unpartnered outside China.',
    filters: base({ country: ['CN'], phase_min: 'phase_1', owner_type: ['industry'] }),
  },
  {
    id: 'large-pharma-first-in-class-scout',
    name: 'Large-pharma first-in-class scout',
    audience: 'Big-pharma search teams tracking novel biology early',
    description: 'Preclinical through Phase 1 programs from industry, including company-disclosed preclinical.',
    filters: base({ phase_min: 'preclinical', phase_max: 'phase_1_2', owner_type: ['industry'] }),
  },
  {
    id: 'specialty-rare-respiratory',
    name: 'Specialty rare and respiratory',
    audience: 'Specialty pharma in rare disease and respiratory',
    description: 'Phase 2+ rare disease and respiratory programs with orphan potential.',
    filters: base({ ta: ['rare_disease', 'respiratory'], phase_min: 'phase_2', owner_type: ['industry'] }),
  },
  {
    id: 'academic-spinout-scout',
    name: 'Academic and spin-out scout',
    audience: 'Venture and translational teams sourcing from institutions',
    description: 'Early clinical programs sponsored by academic and hospital groups.',
    filters: base({ phase_min: 'early_phase_1', phase_max: 'phase_2', owner_type: ['academic', 'hospital'] }),
  },
  {
    id: 'cell-gene-therapy-platform',
    name: 'Cell and gene therapy platform buyer',
    audience: 'Advanced-therapy groups adding programs to a manufacturing base',
    description: 'Unpartnered cell, gene and CAR-T programs at any clinical stage.',
    filters: base({ modality: ['cell_therapy', 'gene_therapy', 'car_t'], owner_type: ['industry'] }),
  },
  {
    id: 'adc-bispecific-oncology',
    name: 'ADC and bispecific oncology',
    audience: 'Oncology BD teams focused on next-generation antibody formats',
    description: 'Antibody-drug conjugates and bispecifics in oncology, Phase 1 onward.',
    filters: base({ ta: ['oncology'], modality: ['adc', 'bispecific'], phase_min: 'phase_1', owner_type: ['industry'] }),
  },
];

export function findTemplate(id: string | null | undefined): MandateTemplate | null {
  return MANDATE_TEMPLATES.find(t => t.id === id) ?? null;
}
