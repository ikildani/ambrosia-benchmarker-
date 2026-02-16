'use client';

interface Deal {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  modality: string;
  phase_at_signing: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
}

interface CompanyDealHistoryProps {
  deals: Deal[];
  isPro: boolean;
}

function formatUsd(amount: number | null): string {
  if (amount == null) return '--';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  return `$${(amount / 1e3).toFixed(0)}K`;
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    discovery: 'Discovery', preclinical: 'Preclinical', phase_1: 'P1',
    phase_2: 'P2', phase_3: 'P3', approved: 'Approved',
  };
  return map[phase] || phase;
}

function formatModality(m: string): string {
  const names: Record<string, string> = {
    adc: 'ADC', car_t: 'CAR-T', bispecific_antibody: 'Bispecific', small_molecule: 'SM',
    radiopharmaceutical: 'Radiopharm', monoclonal_antibody: 'mAb',
  };
  return names[m] || m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function CompanyDealHistory({ deals, isPro }: CompanyDealHistoryProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Deals</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Last 12 months</p>
      </div>

      {deals.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-400">No deals in the last 12 months.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-750">
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Counterparty</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Modality</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Phase</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Upfront</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {deals.map((deal) => (
                <tr key={deal.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {new Date(deal.announced_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {deal.licensor_name} → {deal.licensee_name}
                    </div>
                    {deal.asset_name && (
                      <div className="text-xs text-slate-400 truncate">{deal.asset_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
                      {formatModality(deal.modality)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300 text-xs font-medium">
                    {formatPhase(deal.phase_at_signing)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {isPro ? (
                      <span className="text-teal-600 dark:text-teal-400">{formatUsd(deal.upfront_usd)}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 blur-sm select-none">$XXM</span>
                    )}
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
