'use client';

import { ZOPAChart } from './ZOPAChart';

export interface BuyerZOPAResult {
  name: string;
  premium: number;
  floorUpfront: number;
  buyerTopUpfront: number;
  zopaWidth: number;
  recommendedOpening: number;
  recommendedFallback: number;
}

interface MultiBidderZOPAProps {
  buyers: BuyerZOPAResult[];
}

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${Math.round(m)}M`;
}

export function MultiBidderZOPA({ buyers }: MultiBidderZOPAProps) {
  // Find the buyer with widest ZOPA
  const bestBuyerIdx = buyers.reduce(
    (best, b, i) => (b.zopaWidth > buyers[best].zopaWidth ? i : best),
    0
  );

  return (
    <div className="space-y-6">
      {/* Side-by-side ZOPA charts */}
      <div className={`grid gap-6 ${buyers.length === 1 ? '' : buyers.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {buyers.map((buyer, i) => (
          <div
            key={buyer.name}
            className={`rounded-lg border p-4 ${
              i === bestBuyerIdx && buyers.length > 1
                ? 'border-teal-500/40 bg-teal-500/5'
                : 'border-slate-700/50 bg-slate-900/30'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">{buyer.name}</h4>
                <span className="text-xs text-slate-500">
                  Premium: &times;{buyer.premium.toFixed(2)}
                </span>
              </div>
              {i === bestBuyerIdx && buyers.length > 1 && (
                <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-400">
                  Best counterparty
                </span>
              )}
            </div>
            <ZOPAChart
              floorUpfront={buyer.floorUpfront}
              buyerTop={buyer.buyerTopUpfront}
              recommendedOpening={buyer.recommendedOpening}
              recommendedFallback={buyer.recommendedFallback}
            />
          </div>
        ))}
      </div>

      {/* Comparison table */}
      {buyers.length > 1 && (
        <div className="overflow-x-auto rounded-lg border border-slate-700/50 bg-slate-900/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3 text-right">Premium</th>
                <th className="px-4 py-3 text-right">Buyer ceiling</th>
                <th className="px-4 py-3 text-right">ZOPA width</th>
                <th className="px-4 py-3 text-right">Opening ask</th>
                <th className="px-4 py-3 text-right">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((buyer, i) => (
                <tr
                  key={buyer.name}
                  className={`border-b border-slate-800/40 last:border-0 ${
                    i === bestBuyerIdx ? 'bg-teal-500/5' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {buyer.name}
                    {i === bestBuyerIdx && (
                      <span className="ml-2 text-[10px] text-teal-400">Best</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-cyan-300">
                    &times;{buyer.premium.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {fmtMoney(buyer.buyerTopUpfront)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono ${
                      buyer.zopaWidth > 0 ? 'text-teal-300' : 'text-amber-400'
                    }`}
                  >
                    {buyer.zopaWidth > 0 ? fmtMoney(buyer.zopaWidth) : 'No ZOPA'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-teal-300">
                    {fmtMoney(buyer.recommendedOpening)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {fmtMoney(buyer.recommendedFallback)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
