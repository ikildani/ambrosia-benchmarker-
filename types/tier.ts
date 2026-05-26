export type UserTier = 'free' | 'pro' | 'report' | 'portfolio';

export type TeamRole = 'admin' | 'analyst' | 'viewer';

export type PortfolioSubTier = 'growth' | 'scale' | 'enterprise';

export interface TeamContext {
  teamId: string | null;
  teamRole: TeamRole | null;
  teamName: string | null;
  teamSlug: string | null;
  portfolioSubTier: PortfolioSubTier | null;
  isPortfolioAdmin: boolean;
  maxSeats: number | null;
}

export const DEFAULT_TEAM_CONTEXT: TeamContext = {
  teamId: null,
  teamRole: null,
  teamName: null,
  teamSlug: null,
  portfolioSubTier: null,
  isPortfolioAdmin: false,
  maxSeats: null,
};

export function hasProAccess(tier: UserTier | null): boolean {
  return tier === 'pro' || tier === 'report' || tier === 'portfolio';
}
