'use client';

import { useState, useEffect, useRef } from 'react';
import { WatchlistItem } from '@/lib/hooks/useWatchlist';

interface AddToWatchlistModalProps {
  onClose: () => void;
  onAdd: (itemType: string, itemValue: string, companyId?: string) => Promise<boolean>;
  existingItems: WatchlistItem[];
}

const MODALITIES = [
  'adc', 'bispecific_antibody', 'car_t', 'cell_therapy', 'gene_therapy',
  'gene_editing', 'monoclonal_antibody', 'mrna', 'oncolytic_virus',
  'peptide', 'protein_degrader', 'radiopharmaceutical', 'rnai',
  'small_molecule', 'antisense_oligonucleotide', 'antibody_fragment', 'vaccine',
];

const INDICATIONS = [
  'solid_tumor', 'hematological', 'cns', 'autoimmune', 'rare_disease',
  'cardiovascular', 'metabolic', 'infectious_disease', 'respiratory',
  'ophthalmology', 'dermatology',
];

const THERAPEUTIC_AREAS = ['oncology', 'neurology', 'other'];

function formatValue(value: string): string {
  const labels: Record<string, string> = {
    adc: 'ADC', car_t: 'CAR-T', mrna: 'mRNA', rnai: 'RNAi',
    cns: 'CNS/Neurology', solid_tumor: 'Solid Tumor', hematological: 'Hematological',
  };
  return labels[value] || value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface CompanyResult {
  id: string;
  name: string;
  company_type: string | null;
  modalities_active: string[] | null;
  deals_last_12mo: number | null;
}

type TabType = 'modality' | 'indication' | 'therapeutic_area' | 'company';

export default function AddToWatchlistModal({ onClose, onAdd, existingItems }: AddToWatchlistModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('modality');
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<CompanyResult[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (activeTab !== 'company' || companyQuery.length < 2) {
      setCompanyResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setCompanyLoading(true);
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(companyQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setCompanyResults(data.companies || []);
        }
      } catch {
        // ignore
      } finally {
        setCompanyLoading(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [companyQuery, activeTab]);

  const isAlreadyWatching = (type: string, value: string) =>
    existingItems.some(i => i.item_type === type && i.item_value === value);

  const handleAdd = async (type: string, value: string, companyId?: string) => {
    setAdding(companyId || value);
    setError(null);
    const success = await onAdd(type, value, companyId);
    if (!success) {
      setError('Failed to add. It may already be in your watchlist.');
    }
    setAdding(null);
  };

  const getItems = (): string[] => {
    switch (activeTab) {
      case 'modality': return MODALITIES;
      case 'indication': return INDICATIONS;
      case 'therapeutic_area': return THERAPEUTIC_AREAS;
      case 'company': return [];
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'modality', label: 'Modalities' },
    { id: 'indication', label: 'Indications' },
    { id: 'therapeutic_area', label: 'Areas' },
    { id: 'company', label: 'Companies' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add to Watchlist</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 px-3 py-2 bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {activeTab === 'company' ? (
            <div className="space-y-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Search companies (e.g. Pfizer, Novartis)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                  autoFocus
                />
              </div>
              {companyLoading && (
                <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
                  <div className="w-4 h-4 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin mr-2" />
                  Searching...
                </div>
              )}
              {!companyLoading && companyQuery.length >= 2 && companyResults.length === 0 && (
                <p className="text-center py-6 text-slate-400 text-sm">No companies found</p>
              )}
              {companyResults.map((company) => {
                const watched = isAlreadyWatching('company', company.name);
                const isAddingThis = adding === company.id;
                return (
                  <button
                    key={company.id}
                    onClick={() => !watched && !isAddingThis && handleAdd('company', company.name, company.id)}
                    disabled={watched || isAddingThis}
                    className={`flex items-center justify-between gap-3 w-full px-4 py-3 rounded-xl text-left transition-all ${
                      watched
                        ? 'bg-teal-50 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30'
                        : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${watched ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'}`}>
                        {company.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {company.company_type?.replace(/_/g, ' ')}
                        {company.deals_last_12mo ? ` · ${company.deals_last_12mo} deals (12mo)` : ''}
                      </p>
                    </div>
                    {watched ? (
                      <svg className="w-4 h-4 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isAddingThis ? (
                      <div className="w-4 h-4 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin shrink-0" />
                    ) : (
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                );
              })}
              {companyQuery.length < 2 && (
                <p className="text-center py-6 text-slate-400 text-sm">Type at least 2 characters to search</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {getItems().map((value) => {
                const watched = isAlreadyWatching(activeTab, value);
                const isAdding = adding === value;

                return (
                  <button
                    key={value}
                    onClick={() => !watched && !isAdding && handleAdd(activeTab, value)}
                    disabled={watched || isAdding}
                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                      watched
                        ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                        : 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{formatValue(value)}</span>
                    {watched ? (
                      <svg className="w-4 h-4 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isAdding ? (
                      <div className="w-4 h-4 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin shrink-0" />
                    ) : (
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
