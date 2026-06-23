interface DealInput {
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
}

interface Props {
  deals: DealInput[];
}

interface DealTypeStats {
  type: string;
  count: number;
  avgUpfront: number | null;
  avgTotal: number | null;
}

function formatDealType(dt: string): string {
  return dt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtMoney(usd: number | null): string {
  if (!usd) return '—';
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(usd).toLocaleString()}`;
}

export function DealTypeBreakdown({ deals }: Props) {
  // Group deals by type
  const groups: Record<string, { upfronts: number[]; totals: number[]; count: number }> = {};

  for (const d of deals) {
    const dt = d.deal_type || 'undisclosed';
    if (!groups[dt]) {
      groups[dt] = { upfronts: [], totals: [], count: 0 };
    }
    groups[dt].count++;
    if (d.upfront_usd && d.upfront_usd > 0) {
      groups[dt].upfronts.push(d.upfront_usd);
    }
    if (d.total_deal_value_usd && d.total_deal_value_usd > 0) {
      groups[dt].totals.push(d.total_deal_value_usd);
    }
  }

  const stats: DealTypeStats[] = Object.entries(groups)
    .map(([type, g]) => ({
      type,
      count: g.count,
      avgUpfront: g.upfronts.length > 0
        ? g.upfronts.reduce((s, v) => s + v, 0) / g.upfronts.length
        : null,
      avgTotal: g.totals.length > 0
        ? g.totals.reduce((s, v) => s + v, 0) / g.totals.length
        : null,
    }))
    .sort((a, b) => b.count - a.count);

  if (stats.length === 0) return null;

  const maxCount = stats[0].count;

  return (
    <section className="border-b border-slate-800/60 bg-slate-900/20">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-2 text-xl font-semibold text-slate-100">
          Deal type breakdown
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          How this buyer structures its transactions
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/40 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-normal">Deal type</th>
                <th className="px-4 py-3 text-right font-normal">Count</th>
                <th className="px-4 py-3 text-right font-normal">Avg upfront</th>
                <th className="px-4 py-3 text-right font-normal">Avg total value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.map(row => {
                const isDominant = row.count === maxCount;
                return (
                  <tr
                    key={row.type}
                    className={isDominant
                      ? 'bg-teal-950/20 text-slate-100'
                      : 'text-slate-200'}
                  >
                    <td className="px-4 py-3">
                      <span className="capitalize">{formatDealType(row.type)}</span>
                      {isDominant && (
                        <span className="ml-2 inline-block rounded-full bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-400">
                          Primary
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{row.count}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {fmtMoney(row.avgUpfront)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {fmtMoney(row.avgTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
