'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import CompanyProfileCard from '@/components/competitive/CompanyProfileCard';
import CompanyDealHistory from '@/components/competitive/CompanyDealHistory';
import CompanyPipelineChart from '@/components/competitive/CompanyPipelineChart';
import CompanyBenchmarkComparison from '@/components/competitive/CompanyBenchmarkComparison';
import PatentCliffTimeline from '@/components/competitive/PatentCliffTimeline';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function CompanyPage({ params }: { params: { companyId: string } }) {
  const router = useRouter();
  const {
    isAuthenticated,
    user,
    tier,
    signIn,
    signOut,
    openAuthModal,
    closeAuthModal,
    showAuthModal,
    authModalMode,
    isLoading: authLoading,
  } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompany() {
      try {
        setLoading(true);
        const userParam = user?.id ? `?user_id=${user.id}` : '';
        const res = await fetch(`/api/companies/${params.companyId}${userParam}`);
        if (res.status === 404) {
          setError('Company not found');
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to load company data');
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchCompany();
  }, [params.companyId, user?.id, authLoading]);

  const isPro = tier === 'pro';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center">
              <AmbrosiaLogo variant="color" height={32} />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/calculator" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">Calculator</Link>
              <Link href="/pulse" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 transition-colors">Pulse</Link>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link href="/pulse" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Pulse
        </Link>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <CompanyProfileCard company={data.company} isPro={isPro} />

            {!isPro && (
              <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Unlock Full Company Intelligence</h3>
                  <p className="text-slate-300 text-sm">Deal financials, pipeline data, patent cliffs, and benchmark comparisons.</p>
                </div>
                <button
                  onClick={() => router.push('/#pricing')}
                  className="shrink-0 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <CompanyDealHistory deals={data.recent_deals} isPro={isPro} />
              </div>
              <div className="space-y-6">
                <CompanyPipelineChart pipeline={data.pipeline_by_phase} />
                {data.benchmark_comparison && (
                  <CompanyBenchmarkComparison data={data.benchmark_comparison} companyName={data.company.name} isPro={isPro} />
                )}
              </div>
            </div>

            <PatentCliffTimeline cliffs={data.company.patent_cliffs || []} />
          </div>
        ) : null}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        onSuccess={(email, name) => signIn(email, name)}
      />
    </div>
  );
}
