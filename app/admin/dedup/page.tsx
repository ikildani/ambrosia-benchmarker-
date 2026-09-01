/**
 * Admin Dedup Tool
 *
 * Server-rendered page that identifies potential duplicate deals by
 * normalizing company names and grouping by licensor + licensee + year.
 * Groups with 2+ deals are shown with side-by-side comparison and
 * Keep / Delete actions.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { DedupRow } from '@/components/admin/DedupRow';

export const dynamic = 'force-dynamic';

function normalizeName(name: string): string {
  return name
    .replace(/,?\s*(Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|PLC|LLC|LP|Co\.?|Company|Pharmaceuticals?|Therapeutics?|Biosciences?|Biotech|Sciences?|AG|SA|S\.A\.?|N\.V\.?|SE|GmbH|A\/S)$/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

interface DealRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  announced_date: string | null;
  asset_name: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  source_type: string | null;
  source_url: string | null;
  confidence_score: number | null;
  created_at: string | null;
}

interface DedupGroup {
  key: string;
  licensor: string;
  licensee: string;
  year: string;
  deals: DealRow[];
}

export default async function DedupPage() {
  const supabase = createServiceClient();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, announced_date, asset_name, upfront_usd, total_deal_value_usd, source_type, source_url, confidence_score, created_at')
    .eq('is_synthetic', false)
    .order('announced_date', { ascending: false });

  const groups = new Map<string, DedupGroup>();

  for (const deal of deals || []) {
    if (!deal.licensor_name || !deal.licensee_name) continue;
    const normLicensor = normalizeName(deal.licensor_name);
    const normLicensee = normalizeName(deal.licensee_name);
    const year = deal.announced_date?.substring(0, 4) || 'unknown';
    const key = `${normLicensor}|${normLicensee}|${year}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        licensor: deal.licensor_name,
        licensee: deal.licensee_name,
        year,
        deals: [],
      });
    }
    groups.get(key)!.deals.push(deal);
  }

  const duplicates = [...groups.values()]
    .filter(g => {
      if (g.deals.length < 2) return false;
      const uniqueAssets = new Set(
        g.deals.map(d => d.asset_name?.toLowerCase().trim()).filter(Boolean)
      );
      return uniqueAssets.size <= 1;
    })
    .sort((a, b) => b.deals.length - a.deals.length);

  const totalDuplicateDeals = duplicates.reduce((sum, g) => sum + g.deals.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Deal Dedup Tool
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Potential duplicate deals identified by normalized company name matching
          within the same year. Review each group and keep the best record.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Duplicate Groups</div>
            <div className="mt-1 font-mono text-lg font-semibold text-amber-300">{duplicates.length}</div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Affected Deals</div>
            <div className="mt-1 font-mono text-lg font-semibold text-amber-300">{totalDuplicateDeals}</div>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Deals</div>
            <div className="mt-1 font-mono text-lg font-semibold text-slate-200">{deals?.length || 0}</div>
          </div>
        </div>

        <div className="mt-8">
          {duplicates.length === 0 ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center text-slate-400">
              No duplicate groups found. Database is clean.
            </div>
          ) : (
            duplicates.map(group => (
              <DedupRow
                key={group.key}
                licensor={group.licensor}
                licensee={group.licensee}
                year={group.year}
                deals={group.deals}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
