'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

interface Company {
  id: string;
  name: string;
  company_type: string | null;
  hq_country: string | null;
  modalities_active: string[] | null;
  deals_last_12mo: number | null;
  active_trials_count: number | null;
  acquisition_appetite: string | null;
  last_deal_date: string | null;
  last_deal_modality: string | null;
  data_quality_score: number | null;
}

interface Stats {
  total_companies: number;
  type_breakdown: { type: string; count: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid Pharma',
  large_biotech: 'Large Biotech',
  mid_biotech: 'Biotech',
};

const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'large_pharma', label: 'Large Pharma' },
  { value: 'large_biotech', label: 'Large Biotech' },
  { value: 'mid_biotech', label: 'Biotech' },
] as const;

const SORT_OPTIONS = [
  { value: 'deals_last_12mo', label: 'Most Active (Deals)' },
  { value: 'active_trials_count', label: 'Most Trials' },
  { value: 'last_deal_date', label: 'Recently Active' },
  { value: 'name', label: 'A–Z' },
] as const;

const MODALITY_FILTERS = [
  { value: 'small_molecule', label: 'Small Molecule' },
  { value: 'antibody', label: 'Antibody' },
  { value: 'adc', label: 'ADC' },
  { value: 'car_t', label: 'CAR-T' },
  { value: 'bispecific', label: 'Bispecific' },
  { value: 'gene_therapy', label: 'Gene Therapy' },
  { value: 'cell_therapy', label: 'Cell Therapy' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'peptide', label: 'Peptide' },
  { value: 'radiopharm', label: 'Radiopharm' },
] as const;

const APPETITE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aggressive: { label: 'Aggressive', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
  moderate: { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  selective: { label: 'Selective', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  inactive: { label: 'Inactive', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-500/10' },
};

export default function CompaniesPageClient() {
  const { isAuthenticated, user, tier, signIn, signOut, openAuthModal, closeAuthModal, showAuthModal, authModalMode, isPortfolioAdmin } = useAuth();
  const isPro = tier === 'pro' || tier === 'portfolio';

  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<Stats | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [modalityFilter, setModalityFilter] = useState('');
  const [sortBy, setSortBy] = useState('deals_last_12mo');
  const [showModalityDropdown, setShowModalityDropdown] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const modalityDropdownRef = useRef<HTMLDivElement>(null);

  const fetchCompanies = useCallback(async (opts: {
    q?: string; type?: string; modality?: string; sort?: string; page?: number;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!opts.q) params.set('top', '1');
      if (opts.q && opts.q.length >= 2) params.set('q', opts.q);
      if (opts.type) params.set('type', opts.type);
      if (opts.modality) params.set('modality', opts.modality);
      if (opts.sort) params.set('sort', opts.sort);
      if (opts.page && opts.page > 1) params.set('page', String(opts.page));

      const res = await fetch(`/api/companies/search?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setCompanies(data.companies || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch {
      // Silently handle — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  const initialFetchDone = useRef(false);

  // Initial load
  useEffect(() => {
    initialFetchDone.current = false;
    fetchCompanies({ sort: sortBy }).then(() => { initialFetchDone.current = true; });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside to close modality dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalityDropdownRef.current && !modalityDropdownRef.current.contains(e.target as Node)) {
        setShowModalityDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced filter/sort changes (skip initial mount — handled above)
  useEffect(() => {
    if (!initialFetchDone.current) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchCompanies({ q: query, type: typeFilter, modality: modalityFilter, sort: sortBy, page: 1 });
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query, typeFilter, modalityFilter, sortBy, fetchCompanies]);

  // Page changes
  useEffect(() => {
    if (page > 1) {
      fetchCompanies({ q: query, type: typeFilter, modality: modalityFilter, sort: sortBy, page });
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / 24);

  function formatType(type: string | null): string {
    return TYPE_LABELS[type || ''] || '';
  }

  function recencyLabel(dateStr: string | null): string | null {
    if (!dateStr) return null;
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (86400 * 1000));
    if (days < 0) return 'Recently';
    if (days < 7) return 'This week';
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header
        isAuthenticated={isAuthenticated}
        userName={user?.name}
        userEmail={user?.email}
        tier={tier}
        isPortfolioAdmin={isPortfolioAdmin}
        onSignInClick={() => openAuthModal('signin')}
        onSignUpClick={() => openAuthModal('signup')}
        onSignOut={signOut}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white pt-16 sm:pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
              Competitive Intelligence
            </span>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              PRO
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Company Profiles</h1>
          <p className="text-lg text-slate-300 max-w-2xl">
            Explore deal history, pipeline data, patent cliffs, and benchmark comparisons for biotech and pharma companies.
          </p>

          {/* Stats bar */}
          {stats && (
            <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10">
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_companies.toLocaleString()}</p>
                <p className="text-xs text-slate-400">Companies Tracked</p>
              </div>
              {stats.type_breakdown.map((tb) => (
                <div key={tb.type}>
                  <p className="text-lg font-semibold text-white">{tb.count}</p>
                  <p className="text-xs text-slate-400">{TYPE_LABELS[tb.type] || tb.type}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters toolbar */}
        <div className="space-y-4 mb-8">
          {/* Search + Sort row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xl">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies (e.g. Pfizer, Novartis, BioNTech)..."
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 shadow-sm"
                autoFocus
              />
              {loading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
                </div>
              )}
            </div>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 shadow-sm cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Type tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setTypeFilter(tab.value); setPage(1); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  typeFilter === tab.value
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Modality filter chips */}
            <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {modalityFilter && (
                <button
                  onClick={() => { setModalityFilter(''); setPage(1); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors flex items-center gap-1"
                >
                  {MODALITY_FILTERS.find(m => m.value === modalityFilter)?.label || modalityFilter}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {!modalityFilter && (
                <div className="relative" ref={modalityDropdownRef}>
                  <button
                    onClick={() => setShowModalityDropdown(v => !v)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Modality
                  </button>
                  {showModalityDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 py-1">
                      {MODALITY_FILTERS.map((mod) => (
                        <button
                          key={mod.value}
                          onClick={() => { setModalityFilter(mod.value); setShowModalityDropdown(false); setPage(1); }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          {mod.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {loading ? 'Loading...' : (
              query.length >= 2
                ? `${total} result${total !== 1 ? 's' : ''} for "${query}"`
                : `${total} companies`
            )}
          </p>
          {totalPages > 1 && (
            <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
          )}
        </div>

        {/* Empty state */}
        {!loading && companies.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {query.length >= 2 ? `No companies found for "${query}"` : 'No companies match the current filters'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Company cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => {
            const appetite = APPETITE_CONFIG[company.acquisition_appetite || ''];
            const recency = recencyLabel(company.last_deal_date);

            return (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:border-teal-300 dark:hover:border-teal-500/50 hover:shadow-lg transition-all group"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {company.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {company.company_type && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatType(company.company_type)}</p>
                      )}
                      {company.hq_country && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{company.hq_country}</span>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{company.deals_last_12mo ?? 0}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deals (12mo)</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{company.active_trials_count ?? 0}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Trials</p>
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {/* Acquisition appetite — pro only */}
                  {isPro && appetite && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium ${appetite.bg} ${appetite.color}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {appetite.label}
                    </span>
                  )}

                  {/* Recency badge */}
                  {recency && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {recency}
                    </span>
                  )}

                  {/* Modalities */}
                  {company.modalities_active && company.modalities_active.length > 0 && (
                    <span className="text-slate-500 dark:text-slate-400 truncate">
                      {company.modalities_active.slice(0, 2).map(m => m.replace(/_/g, ' ')).join(', ')}
                      {company.modalities_active.length > 2 ? ` +${company.modalities_active.length - 2}` : ''}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                    page === pageNum
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Pro upsell for free users */}
        {!isPro && companies.length > 0 && (
          <div className="mt-10 bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Unlock Full Company Intelligence</h3>
              <p className="text-slate-300 text-sm mt-1">
                See acquisition appetite, deal financials, patent cliffs, pipeline data, and competitive peer comparisons for every company.
              </p>
            </div>
            <button
              onClick={() => openAuthModal('signup')}
              className="shrink-0 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              Upgrade to Pro
            </button>
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={closeAuthModal} initialMode={authModalMode} onSuccess={(email, name) => signIn(email, name)} />
    </div>
  );
}
