import type { UserTier } from '@/types/tier';

type Feature =
  | 'unlimited_calculations'
  | 'rnpv'
  | 'monte_carlo'
  | 'real_options'
  | 'scenarios'
  | 'competitive_dynamics'
  | 'buyer_specific'
  | 'lifecycle_extensions'
  | 'deal_waterfall'
  | 'partner_matching_basic'
  | 'partner_matching_intent'
  | 'pdf_export'
  | 'excel_export'
  | 'watchlist'
  | 'deal_alerts'
  | 'market_pulse'
  | 'share_links';

const ACCESS_MATRIX: Record<Feature, Set<UserTier>> = {
  unlimited_calculations:   new Set(['pro', 'portfolio']),
  rnpv:                     new Set(['starter', 'pro', 'portfolio']),
  monte_carlo:              new Set(['pro', 'portfolio']),
  real_options:             new Set(['pro', 'portfolio']),
  scenarios:                new Set(['pro', 'portfolio']),
  competitive_dynamics:     new Set(['pro', 'portfolio']),
  buyer_specific:           new Set(['pro', 'portfolio']),
  lifecycle_extensions:     new Set(['pro', 'portfolio']),
  deal_waterfall:           new Set(['pro', 'portfolio']),
  partner_matching_basic:   new Set(['starter', 'pro', 'portfolio']),
  partner_matching_intent:  new Set(['pro', 'portfolio']),
  pdf_export:               new Set(['starter', 'pro', 'report', 'portfolio']),
  excel_export:             new Set(['pro', 'report', 'portfolio']),
  watchlist:                new Set(['pro', 'portfolio']),
  deal_alerts:              new Set(['pro', 'portfolio']),
  market_pulse:             new Set(['pro', 'portfolio']),
  share_links:              new Set(['pro', 'portfolio']),
};

export function canAccess(tier: UserTier | string, feature: Feature): boolean {
  return ACCESS_MATRIX[feature]?.has(tier as UserTier) ?? false;
}

export function isPaidTier(tier: UserTier | string): boolean {
  return tier === 'starter' || tier === 'pro' || tier === 'report' || tier === 'portfolio';
}

export function getCalcLimit(tier: UserTier | string): number {
  if (tier === 'pro' || tier === 'portfolio') return Infinity;
  if (tier === 'starter') return 10;
  return 3;
}

export function getPartnerMatchLimit(tier: UserTier | string): number {
  if (tier === 'pro' || tier === 'portfolio') return 10;
  if (tier === 'starter' || tier === 'report') return 3;
  return 3;
}
