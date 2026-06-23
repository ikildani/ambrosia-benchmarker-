interface DealSummary {
  therapeutic_area: string;
  deal_type: string;
  total_deal_value_usd: number | null;
  announced_date: string | null;
}

interface Props {
  companyName: string;
  deals: DealSummary[];
  byTherapeuticArea: Record<string, { premium: number; n: number }>;
  premiumMultiplier: number;
}

function formatTA(ta: string): string {
  return ta.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDealType(dt: string): string {
  return dt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCurrency(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(usd).toLocaleString()}`;
}

export function BuyerStrategyNarrative({
  companyName,
  deals,
  byTherapeuticArea,
  premiumMultiplier,
}: Props) {
  if (deals.length === 0) return null;

  // Top 3 TAs by deal count
  const taCounts: Record<string, number> = {};
  for (const d of deals) {
    if (d.therapeutic_area) {
      taCounts[d.therapeutic_area] = (taCounts[d.therapeutic_area] || 0) + 1;
    }
  }
  const topTAs = Object.entries(taCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ta]) => formatTA(ta));

  // Most common deal type
  const dtCounts: Record<string, number> = {};
  for (const d of deals) {
    if (d.deal_type) {
      dtCounts[d.deal_type] = (dtCounts[d.deal_type] || 0) + 1;
    }
  }
  const topDealType = Object.entries(dtCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const dealTypeLabel = topDealType ? formatDealType(topDealType[0]) : 'Licensing';

  // Average deal size (disclosed values only)
  const disclosedValues = deals
    .map(d => d.total_deal_value_usd)
    .filter((v): v is number => v !== null && v > 0);
  const avgDealSize = disclosedValues.length > 0
    ? disclosedValues.reduce((sum, v) => sum + v, 0) / disclosedValues.length
    : null;

  // Most recent deal year
  const years = deals
    .map(d => d.announced_date ? new Date(d.announced_date).getFullYear() : null)
    .filter((y): y is number => y !== null);
  const mostRecentYear = years.length > 0 ? Math.max(...years) : null;

  // Top premium TA from byTherapeuticArea
  const taEntries = Object.entries(byTherapeuticArea);
  const topPremiumEntry = taEntries.length > 0
    ? taEntries.sort((a, b) => b[1].premium - a[1].premium)[0]
    : null;

  const premiumLabel = premiumMultiplier >= 1
    ? `a ${premiumMultiplier.toFixed(2)}x premium over`
    : `a ${premiumMultiplier.toFixed(2)}x discount to`;

  return (
    <section className="border-b border-slate-800/60 bg-slate-900/20">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-4 text-xl font-semibold text-slate-100">
          Strategy profile
        </h2>
        <div className="rounded-xl border-l-4 border-teal-500/60 bg-slate-900/60 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-300">
            Based on {deals.length} disclosed transaction{deals.length !== 1 ? 's' : ''},
            {' '}<span className="font-medium text-slate-100">{companyName}</span>{' '}
            concentrates its licensing activity in{' '}
            {topTAs.length > 0 ? (
              <>
                <span className="font-medium text-teal-400">{topTAs[0]}</span>
                {topTAs[1] && <>, <span className="font-medium text-teal-400">{topTAs[1]}</span></>}
                {topTAs[2] && <>, and <span className="font-medium text-teal-400">{topTAs[2]}</span></>}
              </>
            ) : (
              <span className="text-slate-400">undisclosed therapeutic areas</span>
            )}.
            {' '}{companyName} pays {premiumLabel} market median
            {topPremiumEntry && (
              <>, with the strongest premiums in{' '}
                <span className="font-medium text-teal-400">
                  {formatTA(topPremiumEntry[0])}
                </span>{' '}
                ({topPremiumEntry[1].premium.toFixed(2)}x)
              </>
            )}.
            {' '}Their most common deal structure is{' '}
            <span className="font-medium text-slate-100">{dealTypeLabel}</span>
            {avgDealSize && (
              <>, with an average disclosed value of{' '}
                <span className="font-mono font-medium text-slate-100">
                  {formatCurrency(avgDealSize)}
                </span>
              </>
            )}.
            {mostRecentYear && (
              <> Most recent activity: {mostRecentYear}.</>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
