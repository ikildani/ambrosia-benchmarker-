// Partner Fit Score Breakdown Types
// Interfaces for detailed score breakdown, watch-outs, and outreach generation

// ============================================================================
// SCORE BREAKDOWN TYPES
// ============================================================================

export type ScoreCategory =
  | 'modality'
  | 'indication'
  | 'phase'
  | 'activity'
  | 'territory'
  | 'strategic';

export type EvidenceType = 'deal' | 'trial' | 'patent_cliff' | 'metric' | 'strategic';

export interface EvidenceLine {
  text: string;
  type: EvidenceType;
  highlight?: boolean;
  sourceData?: {
    id?: string;
    date?: string;
    value?: number;
  };
}

export interface ScoreFactor {
  category: ScoreCategory;
  title: string;
  points: number;
  maxPoints: number;
  evidenceLines: EvidenceLine[];
}

export interface DetailedScoreBreakdown {
  factors: ScoreFactor[];
  rawTotal: number;
  normalizedTotal: number; // 0-100 scale
  maxPossible: number;
}

// ============================================================================
// WATCH-OUT TYPES
// ============================================================================

export type WatchOutSeverity = 'low' | 'medium' | 'high';
export type WatchOutCategory = 'timing' | 'structure' | 'competition' | 'strategic';

export interface WatchOutFactor {
  title: string;
  impact: number; // Negative points (e.g., -8) or 0 for informational
  description: string;
  severity: WatchOutSeverity;
  category: WatchOutCategory;
}

// ============================================================================
// RELEVANT DEAL TYPES
// ============================================================================

export interface RelevantDeal {
  id: string;
  asset_name: string;
  partner_name: string;
  modality: string | null;
  indication: string | null;
  phase: string | null;
  total_value_usd: number | null;
  upfront_usd: number | null;
  announced_date: string;
  deal_type: string | null;
  relevance: string; // Why this deal is relevant to the match
}

// ============================================================================
// STRATEGIC CONTEXT TYPES
// ============================================================================

export interface PatentCliff {
  drug_name: string;
  indication: string | null;
  revenue_usd: number;
  expiry_year: number;
}

export interface StrategicContext {
  patent_cliffs: PatentCliff[];
  revenue_at_risk: { year: number; amount: number }[];
  pipeline_gaps: string[];
  strategic_priorities: string[];
}

// ============================================================================
// APPROACH STRATEGY TYPES
// ============================================================================

export interface ApproachStrategy {
  summary: string;
  keyPoints: string[];
  timing?: string;
  differentiators?: string[];
  generatedAt: string;
}

// ============================================================================
// OUTREACH EMAIL TYPES
// ============================================================================

export type EmailTone = 'formal' | 'conversational';

export interface OutreachEmail {
  subject: string;
  body: string;
  tone: EmailTone;
  generatedAt: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface OutreachGenerationRequest {
  company_id: string;
  company_name: string;
  match_context: {
    score: number;
    factors: ScoreFactor[];
    watch_outs: WatchOutFactor[];
    strategic_context: StrategicContext;
  };
  user_asset: {
    modality: string;
    phase: string;
    indication_category: string | null;
    indication_specific: string | null;
    territory: string | null;
    differentiators?: string[];
  };
  tone?: EmailTone;
  recipient_role?: string;
  sender_name?: string;
  sender_company?: string;
}

export interface OutreachGenerationResponse {
  success: boolean;
  email: OutreachEmail;
  approach_strategy: ApproachStrategy;
  usage?: {
    emails_generated_today: number;
    daily_limit: number;
  };
}

export interface StrategyGenerationRequest {
  company_id: string;
  company_name: string;
  company_type: string | null;
  match_score: number;
  score_factors: ScoreFactor[];
  watch_outs: WatchOutFactor[];
  patent_cliffs: PatentCliff[];
  recent_deals: RelevantDeal[];
  user_asset: {
    modality: string;
    phase: string;
    indication_category: string | null;
    indication_specific: string | null;
    territory: string | null;
  };
}

// ============================================================================
// ENHANCED PARTNER MATCH (extends base PartnerMatch)
// ============================================================================

export interface EnhancedPartnerMatchData {
  detailed_breakdown: DetailedScoreBreakdown;
  watch_outs: WatchOutFactor[];
  approach_strategy: ApproachStrategy | null;
  relevant_deals: RelevantDeal[];
  strategic_context: StrategicContext;
}

// ============================================================================
// RATE LIMITING TYPES
// ============================================================================

export interface OutreachRateLimitInfo {
  user_id: string;
  emails_generated_today: number;
  daily_limit: number;
  resets_at: string;
  can_generate: boolean;
}
