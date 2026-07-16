'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface GatedBenchmarkTableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  freeRows?: number;
  ctaText?: string;
  ctaHref?: string;
  footnote?: string;
}

export function GatedBenchmarkTable({
  headers,
  rows,
  freeRows = 3,
  ctaText = 'Unlock full benchmarks — $499 report or Pro subscription',
  ctaHref = '/#pricing',
  footnote,
}: GatedBenchmarkTableProps) {
  let tier = 'free';
  try {
    const auth = useAuth();
    tier = auth.tier;
  } catch {
    // Outside AuthProvider (e.g. static render) — default to free
  }

  const isPaid = tier === 'pro' || tier === 'report' || tier === 'portfolio' || tier === 'starter';
  const visibleRows = isPaid ? rows : rows.slice(0, freeRows);
  const gatedRows = isPaid ? [] : rows.slice(freeRows);

  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200">
              {headers.map((h, i) => (
                <th key={i} className={`py-3 px-4 font-semibold text-slate-700 ${i === 0 ? 'text-left' : 'text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                {row.map((cell, j) => (
                  <td key={j} className={`py-3 px-4 ${j === 0 ? 'text-left font-medium text-slate-800' : 'text-right text-slate-600 tabular-nums'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gatedRows.length > 0 && (
        <div className="relative mt-1">
          <div className="overflow-hidden">
            <table className="w-full text-sm blur-[3px] select-none pointer-events-none" aria-hidden="true">
              <tbody>
                {gatedRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {row.map((cell, j) => (
                      <td key={j} className={`py-3 px-4 ${j === 0 ? 'text-left font-medium text-slate-800' : 'text-right text-slate-600 tabular-nums'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/80 to-white flex flex-col items-center justify-center">
            <p className="text-sm text-slate-500 mb-3">
              +{gatedRows.length} more row{gatedRows.length !== 1 ? 's' : ''} available
            </p>
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
            >
              {ctaText}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {footnote && (
        <p className="text-xs text-slate-400 mt-3">{footnote}</p>
      )}
    </div>
  );
}
