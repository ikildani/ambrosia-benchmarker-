'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { formatModality } from '@/lib/config/modality-display';

interface PeerComparisonProps {
  company: any;
  peers: any[];
  isPro: boolean;
}

function MetricBar({
  value,
  maxValue,
  isCurrent,
}: {
  value: number;
  maxValue: number;
  isCurrent: boolean;
}) {
  const width = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCurrent
              ? 'bg-gradient-to-r from-blue-500 to-blue-600'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-8 text-right">
        {value}
      </span>
    </div>
  );
}

const PeerComparison = React.memo(function PeerComparison({
  company,
  peers,
  isPro,
}: PeerComparisonProps) {
  // Derive stats for current company
  const companyStats = useMemo(() => {
    const recentDeals = company.recent_deals || [];
    const modalities = new Set<string>(
      recentDeals.map((d: any) => d.modality).filter(Boolean)
    );
    return {
      name: company.company?.name || 'Current Company',
      dealCount: recentDeals.length,
      modalityCount: modalities.size,
      modalities: Array.from(modalities),
    };
  }, [company]);

  // Derive stats for peers
  const peerStats = useMemo(() => {
    return peers.map((peer) => {
      // Use enriched stats from API if available, otherwise derive from overlap data
      const dealCount = peer.deal_count ?? 0;
      const modalityCount =
        peer.modalities_count ?? (peer.shared_modalities?.length || 0);
      return {
        id: peer.id,
        name: peer.name,
        dealCount,
        modalityCount,
        overlapScore: Math.round((peer.overlap_score || 0) * 100),
        sharedModalities: peer.shared_modalities || [],
      };
    });
  }, [peers]);

  // Compute max values for bar scaling
  const maxDealCount = useMemo(() => {
    return Math.max(
      companyStats.dealCount,
      ...peerStats.map((p) => p.dealCount),
      1
    );
  }, [companyStats, peerStats]);

  const maxModalityCount = useMemo(() => {
    return Math.max(
      companyStats.modalityCount,
      ...peerStats.map((p) => p.modalityCount),
      1
    );
  }, [companyStats, peerStats]);

  if (!peers || peers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Peer Comparison
        </h2>
        <div className="flex flex-col items-center py-10 text-center">
          <svg
            className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No competitive peers found
          </p>
        </div>
      </div>
    );
  }

  // Build the column entries: current company + top peers
  const columns = [
    { id: 'current', name: companyStats.name, isCurrent: true, blurred: false },
    ...peerStats.map((p, idx) => ({
      id: p.id,
      name: p.name,
      isCurrent: false,
      blurred: !isPro && idx >= 1, // First peer visible, rest gated
    })),
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Peer Comparison
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Side-by-side metrics vs. top competitive peers
        </p>
      </div>

      {/* === Mobile: Stacked card layout === */}
      <div className="sm:hidden space-y-3">
        {columns.map((col, colIdx) => {
          const dealCount = col.isCurrent ? companyStats.dealCount : peerStats[colIdx - 1]?.dealCount || 0;
          const modalityCount = col.isCurrent ? companyStats.modalityCount : peerStats[colIdx - 1]?.modalityCount || 0;
          const overlapScore = col.isCurrent ? 100 : peerStats[colIdx - 1]?.overlapScore || 0;
          const modalities = col.isCurrent ? companyStats.modalities : (peerStats[colIdx - 1]?.sharedModalities || []);

          return (
            <div
              key={col.id}
              className={`relative rounded-xl border p-4 ${
                col.isCurrent
                  ? 'border-blue-200 dark:border-blue-700/30 bg-slate-50/50 dark:bg-slate-700/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              {col.blurred && (
                <div className="absolute inset-0 z-10 backdrop-blur-[5px] bg-white/60 dark:bg-slate-800/60 rounded-xl flex items-center justify-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 dark:bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Pro
                  </div>
                </div>
              )}
              {/* Card header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className={`text-sm font-semibold ${col.isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                    {col.isCurrent ? col.name : (
                      <Link href={`/companies/${col.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors">
                        {col.name}
                      </Link>
                    )}
                  </div>
                  {col.isCurrent && (
                    <div className="text-xs uppercase tracking-wide font-medium text-blue-600 dark:text-blue-400">Current</div>
                  )}
                </div>
                {!col.isCurrent && (
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{overlapScore}% overlap</div>
                )}
              </div>
              {/* Metrics */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Deal Activity</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{dealCount} deal{dealCount !== 1 ? 's' : ''} (12mo)</span>
                  </div>
                  <MetricBar value={dealCount} maxValue={maxDealCount} isCurrent={col.isCurrent} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Modalities</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{modalityCount}</span>
                  </div>
                  <MetricBar value={modalityCount} maxValue={maxModalityCount} isCurrent={col.isCurrent} />
                </div>
                {modalities.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {modalities.slice(0, 4).map((m: string) => (
                      <span
                        key={m}
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          col.isCurrent
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {formatModality(m)}
                      </span>
                    ))}
                    {modalities.length > 4 && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        +{modalities.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* === Desktop: Grid table layout === */}
      {/* Column headers */}
      <div className="hidden sm:grid gap-4" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
        {/* Empty cell for metric labels column */}
        <div />
        {columns.map((col) => (
          <div
            key={col.id}
            className={`text-center relative ${col.blurred ? 'select-none' : ''}`}
          >
            {col.blurred && (
              <div className="absolute inset-0 z-10 backdrop-blur-[5px] bg-white/50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-900 dark:bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Pro
                </div>
              </div>
            )}
            <div
              className={`text-sm font-semibold truncate px-1 ${
                col.isCurrent
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {col.isCurrent ? (
                col.name
              ) : (
                <Link
                  href={`/companies/${col.id}`}
                  className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors cursor-pointer"
                >
                  {col.name}
                </Link>
              )}
            </div>
            {col.isCurrent && (
              <div className="text-xs uppercase tracking-wide font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                Current
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Metrics rows */}
      <div className="hidden sm:block mt-4 space-y-5">
        {/* Deal Activity */}
        <div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div className="flex items-center">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Deal Activity
              </span>
            </div>
            {columns.map((col, idx) => {
              const val =
                col.isCurrent
                  ? companyStats.dealCount
                  : peerStats[idx - 1]?.dealCount || 0;
              return (
                <div key={col.id}>
                  <MetricBar
                    value={val}
                    maxValue={maxDealCount}
                    isCurrent={col.isCurrent}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 mt-0.5" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div />
            {columns.map((col, idx) => {
              const val =
                col.isCurrent
                  ? companyStats.dealCount
                  : peerStats[idx - 1]?.dealCount || 0;
              return (
                <div key={col.id} className="text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {val} deal{val !== 1 ? 's' : ''} (12mo)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Modalities */}
        <div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div className="flex items-center">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Modalities
              </span>
            </div>
            {columns.map((col, idx) => {
              const val =
                col.isCurrent
                  ? companyStats.modalityCount
                  : peerStats[idx - 1]?.modalityCount || 0;
              return (
                <div key={col.id}>
                  <MetricBar
                    value={val}
                    maxValue={maxModalityCount}
                    isCurrent={col.isCurrent}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Competitive Overlap */}
        <div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div className="flex items-center">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Overlap
              </span>
            </div>
            {columns.map((col, idx) => {
              const val = col.isCurrent ? 100 : peerStats[idx - 1]?.overlapScore || 0;
              return (
                <div key={col.id}>
                  <MetricBar
                    value={val}
                    maxValue={100}
                    isCurrent={col.isCurrent}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid gap-4 mt-0.5" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div />
            {columns.map((col, idx) => {
              const val = col.isCurrent ? 100 : peerStats[idx - 1]?.overlapScore || 0;
              return (
                <div key={col.id} className="text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {val}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shared Modalities (pills) */}
        <div>
          <div className="grid gap-4" style={{ gridTemplateColumns: `140px repeat(${columns.length}, 1fr)` }}>
            <div className="flex items-start pt-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Shared Modalities
              </span>
            </div>
            {columns.map((col, idx) => {
              if (col.isCurrent) {
                // Show company's own modalities
                return (
                  <div key={col.id} className="flex flex-wrap gap-1">
                    {companyStats.modalities.slice(0, 4).map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      >
                        {formatModality(m)}
                      </span>
                    ))}
                    {companyStats.modalities.length > 4 && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        +{companyStats.modalities.length - 4}
                      </span>
                    )}
                  </div>
                );
              }
              const peer = peerStats[idx - 1];
              if (!peer) return <div key={col.id} />;
              return (
                <div key={col.id} className="flex flex-wrap gap-1">
                  {peer.sharedModalities.length === 0 ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">--</span>
                  ) : (
                    peer.sharedModalities.slice(0, 4).map((m: string) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      >
                        {formatModality(m)}
                      </span>
                    ))
                  )}
                  {peer.sharedModalities.length > 4 && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      +{peer.sharedModalities.length - 4}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PeerComparison;
