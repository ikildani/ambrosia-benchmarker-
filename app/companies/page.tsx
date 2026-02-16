'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

interface Company {
  id: string;
  name: string;
  company_type: string | null;
  modalities_active: string[] | null;
  deals_last_12mo: number | null;
}

export default function CompaniesPage() {
  const { isAuthenticated, user, tier, signIn, signOut, openAuthModal, closeAuthModal, showAuthModal, authModalMode } = useAuth();
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [topCompanies, setTopCompanies] = useState<Company[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load top companies on mount
  useEffect(() => {
    fetch('/api/companies/search?q=pharma')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.companies) setTopCompanies(data.companies);
      })
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setCompanies([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [query]);

  const displayCompanies = query.length >= 2 ? companies : topCompanies;

  function formatType(type: string | null): string {
    if (!type) return '';
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center">
              <AmbrosiaLogo variant="color" height={32} />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/calculator" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">Calculator</Link>
              <Link href="/deals" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">Deals</Link>
              <Link href="/pulse" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">Pulse</Link>
              <Link href="/companies" className="text-sm font-medium text-teal-600 dark:text-teal-400">Companies</Link>
            </nav>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">Dashboard</Link>
              ) : (
                <button onClick={() => openAuthModal('signup')} className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white">Get Started</button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white">
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="relative max-w-xl mb-8">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies (e.g. Pfizer, Novartis, BioNTech)..."
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 shadow-sm"
            autoFocus
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
            </div>
          )}
        </div>

        {/* Results */}
        {query.length < 2 && topCompanies.length > 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">Top active companies</p>
        )}

        {query.length >= 2 && !loading && companies.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400">No companies found for &ldquo;{query}&rdquo;</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayCompanies.map((company) => (
            <Link
              key={company.id}
              href={`/companies/${company.id}`}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:border-teal-300 dark:hover:border-teal-500/50 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {company.name}
                  </h3>
                  {company.company_type && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatType(company.company_type)}</p>
                  )}
                </div>
                <svg className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {company.deals_last_12mo != null && company.deals_last_12mo > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 rounded-lg font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {company.deals_last_12mo} deal{company.deals_last_12mo !== 1 ? 's' : ''} (12mo)
                  </span>
                )}
                {company.modalities_active && company.modalities_active.length > 0 && (
                  <span className="text-slate-400 dark:text-slate-500 truncate">
                    {company.modalities_active.slice(0, 2).map(m => m.replace(/_/g, ' ')).join(', ')}
                    {company.modalities_active.length > 2 ? ` +${company.modalities_active.length - 2}` : ''}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={closeAuthModal} initialMode={authModalMode} onSuccess={(email, name) => signIn(email, name)} />
    </div>
  );
}
