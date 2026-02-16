'use client';

import Link from 'next/link';

interface Peer {
  id: string;
  name: string;
  company_type: string;
  overlap_score: number;
  shared_modalities: string[];
}

interface CompetitivePeersProps {
  peers: Peer[];
  isPro: boolean;
}

const typeLabels: Record<string, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid Pharma',
  large_biotech: 'Large Biotech',
  mid_biotech: 'Mid Biotech',
  specialty: 'Specialty',
};

function formatModality(m: string): string {
  const names: Record<string, string> = {
    adc: 'ADC',
    car_t: 'CAR-T',
    bispecific_antibody: 'Bispecific',
    small_molecule: 'SM',
    gene_therapy: 'Gene Tx',
    radiopharmaceutical: 'Radiopharm',
    monoclonal_antibody: 'mAb',
    mrna: 'mRNA',
    rnai: 'RNAi',
    antibody: 'Ab',
    peptide: 'Peptide',
    cell_therapy: 'Cell Tx',
    protac: 'PROTAC',
  };
  return (
    names[m] ||
    m
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function PeerCard({
  peer,
  blurred,
}: {
  peer: Peer;
  blurred: boolean;
}) {
  const overlapPct = Math.round(peer.overlap_score * 100);

  return (
    <div
      className={`relative flex-shrink-0 w-64 sm:w-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 transition-shadow hover:shadow-md ${
        blurred ? 'select-none' : ''
      }`}
    >
      {/* Blur overlay for non-Pro peers */}
      {blurred && (
        <div className="absolute inset-0 z-10 backdrop-blur-[5px] bg-white/50 dark:bg-slate-800/50 rounded-xl flex items-center justify-center">
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

      {/* Company name + type */}
      <div className="mb-3">
        <Link
          href={`/companies/${peer.id}`}
          className="text-sm font-semibold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          {peer.name}
        </Link>
        {peer.company_type && (
          <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            {typeLabels[peer.company_type] || peer.company_type}
          </span>
        )}
      </div>

      {/* Overlap score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400 dark:text-slate-500">
            Overlap
          </span>
          <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
            {overlapPct}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${overlapPct}%` }}
          />
        </div>
      </div>

      {/* Shared modality pills */}
      {peer.shared_modalities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {peer.shared_modalities.map((m) => (
            <span
              key={m}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300"
            >
              {formatModality(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompetitivePeers({
  peers,
  isPro,
}: CompetitivePeersProps) {
  const isEmpty = !peers || peers.length === 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Competitive Landscape
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Companies with overlapping modalities and therapeutic areas
        </p>
      </div>

      {/* Body */}
      <div className="p-6">
        {isEmpty ? (
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
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No competitive peers identified
            </p>
          </div>
        ) : (
          <>
            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {peers.map((peer, idx) => (
                <PeerCard
                  key={peer.id}
                  peer={peer}
                  blurred={!isPro && idx >= 3}
                />
              ))}
            </div>

            {/* Mobile horizontal scroll */}
            <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-slate-200">
              {peers.map((peer, idx) => (
                <PeerCard
                  key={peer.id}
                  peer={peer}
                  blurred={!isPro && idx >= 3}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
