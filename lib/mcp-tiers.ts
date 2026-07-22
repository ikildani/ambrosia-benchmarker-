/**
 * MCP Tier definitions — tool access, rate limits, and feature flags
 * per subscription tier.
 *
 * Growth:     14 core tools, 5K calls/mo
 * Scale:      All 21 tools, 15K calls/mo, batch operations
 * Enterprise: All 21 tools, 100K calls/mo, batch + white-label
 *
 * @module lib/mcp-tiers
 */

export type McpTier = 'growth' | 'scale' | 'enterprise';

/** Tools available only at Scale tier and above. */
const SCALE_ONLY_TOOLS = [
  'analyze_lifecycle_extensions',
  'model_competitive_dynamics',
  'value_real_options',
  'analyze_royalty_stacking',
  'analyze_cross_border_tax',
  'sequence_indications',
  'analyze_buyer_synergy',
] as const;

/** Tools available at Growth tier and above (14 tools). */
const GROWTH_TOOLS = [
  'calculate_deal_terms',
  'run_rnpv_model',
  'optimize_deal_structure',
  'get_comparable_deals',
  'match_partners',
  'get_regulatory_risk',
  'get_market_intelligence',
  'compute_negotiation_zopa',
  'run_scenario_comparison',
  'run_defensive_analysis',
  'model_patent_dynamics',
  'assess_cmc_risk',
  'value_earnout_cvr',
  'score_pharma_intent',
] as const;

interface TierConfig {
  /** Tool names available at this tier, or 'all' for unrestricted access. */
  tools: readonly string[] | 'all';
  /** Monthly API call limit. */
  rateLimit: number;
  /** Whether batch operations (multi-asset calls) are enabled. */
  batchEnabled: boolean;
  /** Whether white-label output (no Ambrosia branding) is enabled. */
  whiteLabelEnabled: boolean;
  /** Human-readable tier name. */
  label: string;
  /** Annual price in USD, or null for custom pricing. */
  priceAnnual: number | null;
}

export const TIER_CONFIG: Record<McpTier, TierConfig> = {
  growth: {
    tools: GROWTH_TOOLS,
    rateLimit: 5_000,
    batchEnabled: false,
    whiteLabelEnabled: false,
    label: 'Growth',
    priceAnnual: 30_000,
  },
  scale: {
    tools: 'all',
    rateLimit: 15_000,
    batchEnabled: true,
    whiteLabelEnabled: false,
    label: 'Scale',
    priceAnnual: 60_000,
  },
  enterprise: {
    tools: 'all',
    rateLimit: 100_000,
    batchEnabled: true,
    whiteLabelEnabled: true,
    label: 'Enterprise',
    priceAnnual: null,
  },
};

/** Returns the list of tool names available at a tier, or 'all'. */
export function getToolsForTier(tier: McpTier): readonly string[] | 'all' {
  return TIER_CONFIG[tier].tools;
}

/** Check whether a tier can access a specific tool. */
export function canAccessTool(tier: McpTier, toolName: string): boolean {
  const tools = TIER_CONFIG[tier].tools;
  if (tools === 'all') return true;
  return tools.includes(toolName);
}

/** Get the full configuration for a tier. */
export function getTierConfig(tier: McpTier): TierConfig {
  return TIER_CONFIG[tier];
}

/**
 * Returns the minimum tier required to access a given tool.
 * Used in error messages to guide users toward upgrading.
 */
export function getRequiredTier(toolName: string): McpTier {
  if ((GROWTH_TOOLS as readonly string[]).includes(toolName)) return 'growth';
  if ((SCALE_ONLY_TOOLS as readonly string[]).includes(toolName)) return 'scale';
  return 'growth'; // fallback — unknown tools default to growth
}

/**
 * Assert that a tier can access a tool. Throws a descriptive error if not.
 * Call this as the first line of every Scale+ tool handler.
 */
export function assertToolAccess(tier: McpTier, toolName: string): void {
  if (!canAccessTool(tier, toolName)) {
    const requiredTier = getRequiredTier(toolName);
    const config = TIER_CONFIG[requiredTier];
    throw new Error(
      `Tool "${toolName}" requires ${config.label} tier ($${config.priceAnnual ? (config.priceAnnual / 1000).toFixed(0) + 'K' : 'custom'}/year) or above. ` +
      `Your current tier: ${TIER_CONFIG[tier].label}. ` +
      `Contact ikildani@ambrosiaventures.co to upgrade.`
    );
  }
}

/**
 * Map legacy API key tiers to MCP tiers.
 * - 'portfolio' (legacy Portfolio License) maps to 'enterprise'
 * - 'pilot' maps to 'growth' (grandfathered pilot keys get Growth access)
 * - 'growth', 'scale', 'enterprise' pass through
 */
export function resolveApiTierToMcpTier(apiTier: string): McpTier | null {
  const tierMap: Record<string, McpTier> = {
    growth: 'growth',
    scale: 'scale',
    enterprise: 'enterprise',
    portfolio: 'enterprise',
    pilot: 'growth',
  };
  return tierMap[apiTier] ?? null;
}
