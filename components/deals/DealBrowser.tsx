'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import DealFilters from './DealFilters';
import DealTable from './DealTable';
import DealCard from './DealCard';

export interface Deal {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  modality: string;
  indication_category: string | null;
  indication_specific: string | null;
  phase_at_signing: string;
  territory: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  announced_date: string;
  terms_disclosed: boolean;
  blurred?: boolean;
}

export interface Filters {
  modality: string[];
  phase: string[];
  indication: string[];
  dealType: string[];
  minUpfront: string;
  maxUpfront: string;
  yearFrom: string;
  yearTo: string;
  termsDisclosed: boolean;
  search: string;
}

export interface FilterOptions {
  modalities: string[];
  phases: string[];
  indications: string[];
  dealTypes: string[];
}

const initialFilters: Filters = {
  modality: [],
  phase: [],
  indication: [],
  dealType: [],
  minUpfront: '',
  maxUpfront: '',
  yearFrom: '2019',
  yearTo: '2026',
  termsDisclosed: false,
  search: '',
};

export default function DealBrowser() {
  const { tier, user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    modalities: [],
    phases: [],
    indications: [],
    dealTypes: [],
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('announced_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (user?.email) params.set('email', user.email);
      params.set('tier', tier);
      params.set('page', page.toString());
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);

      if (filters.modality.length > 0) params.set('modality', filters.modality.join(','));
      if (filters.phase.length > 0) params.set('phase', filters.phase.join(','));
      if (filters.indication.length > 0) params.set('indication', filters.indication.join(','));
      if (filters.dealType.length > 0) params.set('deal_type', filters.dealType.join(','));
      if (filters.minUpfront) params.set('min_upfront', filters.minUpfront);
      if (filters.maxUpfront) params.set('max_upfront', filters.maxUpfront);
      if (filters.yearFrom) params.set('year_from', filters.yearFrom);
      if (filters.yearTo) params.set('year_to', filters.yearTo);
      if (filters.termsDisclosed) params.set('terms_disclosed', 'true');
      if (filters.search) params.set('search', filters.search);

      const response = await fetch(`/api/deals?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch deals');
      }

      setDeals(data.deals);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setFilterOptions(data.filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.email, tier, page, sortBy, sortOrder, filters]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <DealFilters
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-neutral-600">
            <span className="font-bold text-navy-800">{total.toLocaleString()}</span> deals found
          </p>
          {tier === 'free' && total > 5 && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
              Showing 5 of {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="hidden sm:flex items-center bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-neutral-600 hover:text-navy-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-neutral-600 hover:text-navy-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading/Error States */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-neutral-500">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading deals...
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {viewMode === 'table' ? (
            <DealTable
              deals={deals}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              tier={tier}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} tier={tier} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-neutral-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Upgrade CTA for Free Users */}
          {tier === 'free' && total > 5 && (
            <div className="mt-8 p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl text-center">
              <h3 className="text-xl font-bold text-white mb-2">
                Unlock Full Deal Database
              </h3>
              <p className="text-neutral-300 mb-4 max-w-lg mx-auto">
                Upgrade to Pro to access all {total.toLocaleString()} deals, export to Excel,
                and filter by financial terms.
              </p>
              <a
                href="/upgrade"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
              >
                Upgrade to Pro - $99/month
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
