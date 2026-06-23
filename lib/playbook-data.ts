/**
 * Counterparty Playbook — data loader for /playbook + /playbook/[slug].
 * Reads from the `counterparty_premiums` table populated by the
 * counterparty-calibration cron (Tier 3 Item 9).
 */

import { createServiceClient } from '@/lib/supabase/server';

export interface PlaybookBuyer {
  companyId: string;
  companyName: string;
  slug: string;
  premiumMultiplier: number;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low';
  byTherapeuticArea: Record<string, { premium: number; n: number }>;
  byPhase: Record<string, { premium: number; n: number }>;
  asOfDate: string;
  calculationNotes: string | null;
}

export interface PlaybookDeal {
  id: string;
  year: number | null;
  asset: string | null;
  licensorName: string | null;
  indication: string | null;
  therapeuticArea: string | null;
  phase: string | null;
  dealType: string | null;
  upfrontUsd: number | null;
  totalDealValueUsd: number | null;
  modality: string | null;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** Load all buyers, sorted by sample size descending. */
export async function loadPlaybookBuyers(): Promise<PlaybookBuyer[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('counterparty_premiums')
    .select('*')
    .order('sample_size', { ascending: false });
  if (error || !data) return [];
  return data.map(rowToBuyer);
}

/** Load one buyer + their recent disclosed deals for the detail page. */
export async function loadPlaybookBuyer(slug: string): Promise<{
  buyer: PlaybookBuyer;
  deals: PlaybookDeal[];
} | null> {
  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from('counterparty_premiums')
    .select('*');
  if (error || !rows) return null;

  const buyerRow = rows.find(r => nameToSlug(r.company_name) === slug);
  if (!buyerRow) return null;

  const buyer = rowToBuyer(buyerRow);

  const { data: dealRows } = await supabase
    .from('deals')
    .select('id, announced_date, asset_name, licensor_name, indication_specific, indication_category, therapeutic_area, phase_at_signing, deal_type, upfront_usd, total_deal_value_usd, modality')
    .eq('licensee_id', buyer.companyId)
    .not('total_deal_value_usd', 'is', null)
    .order('announced_date', { ascending: false })
    .limit(15);

  const deals: PlaybookDeal[] = (dealRows ?? []).map(d => ({
    id: d.id,
    year: d.announced_date ? new Date(d.announced_date).getFullYear() : null,
    asset: d.asset_name ?? null,
    licensorName: d.licensor_name ?? null,
    indication: d.indication_specific ?? d.indication_category ?? null,
    therapeuticArea: d.therapeutic_area ?? null,
    phase: d.phase_at_signing ?? null,
    dealType: d.deal_type ?? null,
    upfrontUsd: d.upfront_usd ?? null,
    totalDealValueUsd: d.total_deal_value_usd ?? null,
    modality: d.modality ?? null,
  }));

  return { buyer, deals };
}

interface CounterpartyPremiumRow {
  company_id: string;
  company_name: string;
  premium_multiplier: number;
  sample_size: number;
  confidence: 'high' | 'medium' | 'low';
  by_therapeutic_area: Record<string, { premium: number; n: number }>;
  by_phase: Record<string, { premium: number; n: number }>;
  as_of_date: string;
  calculation_notes: string | null;
}

function rowToBuyer(r: CounterpartyPremiumRow): PlaybookBuyer {
  return {
    companyId: r.company_id,
    companyName: r.company_name,
    slug: nameToSlug(r.company_name),
    premiumMultiplier: Number(r.premium_multiplier),
    sampleSize: r.sample_size,
    confidence: r.confidence,
    byTherapeuticArea: r.by_therapeutic_area || {},
    byPhase: r.by_phase || {},
    asOfDate: r.as_of_date,
    calculationNotes: r.calculation_notes,
  };
}

/** Generate slugs for static path generation. */
export async function listAllSlugs(): Promise<string[]> {
  const buyers = await loadPlaybookBuyers();
  return buyers.map(b => b.slug);
}
