import type { PortfolioSubTier } from '@/types/tier';

export interface PortfolioFeature {
  key: string;
  label: string;
  description: string;
  minTier: PortfolioSubTier;
}

const TIER_RANK: Record<PortfolioSubTier, number> = {
  growth: 1,
  scale: 2,
  enterprise: 3,
};

export function hasPortfolioFeature(
  currentTier: PortfolioSubTier | null,
  requiredTier: PortfolioSubTier
): boolean {
  if (!currentTier) return false;
  return TIER_RANK[currentTier] >= TIER_RANK[requiredTier];
}

export function isScalePlus(tier: PortfolioSubTier | null): boolean {
  return hasPortfolioFeature(tier, 'scale');
}

export function isEnterprise(tier: PortfolioSubTier | null): boolean {
  return hasPortfolioFeature(tier, 'enterprise');
}

export const PORTFOLIO_FEATURES: PortfolioFeature[] = [
  // Growth (all tiers)
  { key: 'admin_dashboard', label: 'Admin Dashboard', description: 'Real-time activity feed and seat management', minTier: 'growth' },
  { key: 'pipeline_tracker', label: 'Pipeline Tracker', description: 'Cross-portfolio deal pipeline tracking', minTier: 'growth' },
  { key: 'quarterly_report', label: 'Quarterly Report', description: 'Portfolio benchmarking report', minTier: 'growth' },
  { key: 'sso_saml', label: 'SSO / SAML', description: 'Enterprise authentication', minTier: 'growth' },
  { key: 'audit_logs', label: 'Audit Logs', description: 'Compliance-grade activity logs', minTier: 'growth' },
  { key: 'custom_dpa', label: 'Custom DPA', description: 'Data processing agreement', minTier: 'growth' },
  { key: 'deal_alerts', label: 'Deal Alerts', description: 'Configurable deal alert feeds', minTier: 'growth' },

  // Scale+ only
  { key: 'white_label', label: 'White-Label Reports', description: 'Fund-branded report generation', minTier: 'scale' },
  { key: 'comp_library', label: 'Shared Comp Library', description: 'Team-scoped saved comp sets', minTier: 'scale' },
  { key: 'slack_integration', label: 'Slack & Teams', description: 'Webhook-based notifications', minTier: 'scale' },
  { key: 'playbook_library', label: 'Negotiation Playbook Library', description: 'Curated term sheet templates', minTier: 'scale' },

  // Enterprise only
  { key: 'strategy_call', label: 'Strategy Call', description: 'Quarterly call with Managing Partner', minTier: 'enterprise' },
  { key: 'advisory_rates', label: 'Advisory Preferred Rates', description: '15% off advisory engagements', minTier: 'enterprise' },
  { key: 'strategic_assessment', label: 'Strategic Assessment', description: '2-hr assessment per portfolio co', minTier: 'enterprise' },
];

export function getAvailableFeatures(tier: PortfolioSubTier | null): PortfolioFeature[] {
  if (!tier) return [];
  return PORTFOLIO_FEATURES.filter(f => hasPortfolioFeature(tier, f.minTier));
}

export function getLockedFeatures(tier: PortfolioSubTier | null): PortfolioFeature[] {
  if (!tier) return PORTFOLIO_FEATURES;
  return PORTFOLIO_FEATURES.filter(f => !hasPortfolioFeature(tier, f.minTier));
}

export function getUpgradeTier(currentTier: PortfolioSubTier): PortfolioSubTier | null {
  if (currentTier === 'growth') return 'scale';
  if (currentTier === 'scale') return 'enterprise';
  return null;
}

export const TIER_LABELS: Record<PortfolioSubTier, { name: string; tagline: string; badge?: string }> = {
  growth: { name: 'Growth', tagline: 'For Emerging Managers' },
  scale: { name: 'Scale', tagline: 'The Institutional Standard', badge: 'Most Popular' },
  enterprise: { name: 'Enterprise', tagline: 'White-Glove for Institutional Funds', badge: 'White-Glove' },
};
