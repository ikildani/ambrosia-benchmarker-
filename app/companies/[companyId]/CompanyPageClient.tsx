'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import CompanyProfileCard from '@/components/competitive/CompanyProfileCard';
import CompanySummary from '@/components/competitive/CompanySummary';
import CompanyDealHistory from '@/components/competitive/CompanyDealHistory';
import DealFlowChart from '@/components/competitive/DealFlowChart';
import CompanyPipelineChart from '@/components/competitive/CompanyPipelineChart';
import PipelineByIndication from '@/components/competitive/PipelineByIndication';
import CompanyBenchmarkComparison from '@/components/competitive/CompanyBenchmarkComparison';
import PatentCliffTimeline from '@/components/competitive/PatentCliffTimeline';
import CompetitivePeers from '@/components/competitive/CompetitivePeers';
import DealTimeline from '@/components/competitive/DealTimeline';
import PeerComparison from '@/components/competitive/PeerComparison';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
import { useRouter } from 'next/navigation';

export default function CompanyPageClient({ companyId }: { companyId: string }) {
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
        const res = await fetch(`/api/companies/${companyId}${userParam}`);
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
  }, [companyId, user?.id, authLoading]);

  const isPro = tier === 'pro';

  return (
    <WatchlistProvider tier={tier}>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header
        isAuthenticated={isAuthenticated}
        userName={user?.name}
        userEmail={user?.email}
        tier={tier}
        onSignInClick={() => openAuthModal('signin')}
        onSignUpClick={() => openAuthModal('signup')}
        onSignOut={signOut}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 sm:pt-28 lg:pt-32">
        {/* Back link */}
        <Link href="/companies" className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Companies
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
            {/* Company header card */}
            <CompanyProfileCard
              company={data.company}
              isPro={isPro}
              marketPosition={data.market_position}
              dealFlowTrend={data.deal_flow_trend}
            />

            {/* AI-generated summary */}
            {data.summary && (
              <CompanySummary
                summary={data.summary}
                marketPosition={data.market_position}
              />
            )}

            {/* Pro upgrade banner */}
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

            {/* Deal flow chart + benchmark comparison row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <DealFlowChart trend={data.deal_flow_trend || []} isPro={isPro} />
              </div>
              <div className="space-y-6">
                <CompanyPipelineChart pipeline={data.pipeline_by_phase} />
                {data.benchmark_comparison && (
                  <CompanyBenchmarkComparison data={data.benchmark_comparison} companyName={data.company.name} isPro={isPro} />
                )}
              </div>
            </div>

            {/* Deal history table */}
            <CompanyDealHistory
              deals={data.recent_deals}
              isPro={isPro}
              dealsByModality={data.deals_by_modality}
            />

            {/* Deal timeline visualization */}
            {data.recent_deals && data.recent_deals.length > 0 && (
              <DealTimeline
                deals={data.recent_deals}
                companyName={data.company?.name || companyId}
                isPro={isPro}
              />
            )}

            {/* Pipeline by indication matrix */}
            {data.pipeline_by_indication && Object.keys(data.pipeline_by_indication).length > 0 && (
              <PipelineByIndication data={data.pipeline_by_indication} isPro={isPro} />
            )}

            {/* Patent cliffs — only show if data exists */}
            {data.company.patent_cliffs && data.company.patent_cliffs.length > 0 && (
              <PatentCliffTimeline cliffs={data.company.patent_cliffs} />
            )}

            {/* Competitive peers */}
            {data.competitive_peers && data.competitive_peers.length > 0 && (
              <CompetitivePeers peers={data.competitive_peers} isPro={isPro} />
            )}

            {/* Peer comparison chart */}
            {data.competitive_peers && data.competitive_peers.length > 0 && (
              <PeerComparison
                company={data}
                peers={data.competitive_peers.slice(0, 3)}
                isPro={isPro}
              />
            )}
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
    </WatchlistProvider>
  );
}
