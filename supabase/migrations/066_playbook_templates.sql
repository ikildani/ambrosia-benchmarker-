-- Negotiation Playbook Library: term sheet templates and counter-proposal frameworks
CREATE TABLE IF NOT EXISTS playbook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_type TEXT NOT NULL CHECK (deal_type IN ('licensing', 'acquisition', 'codevelopment', 'option', 'collaboration')),
  therapeutic_area TEXT,
  phase TEXT,
  title TEXT NOT NULL,
  description TEXT,
  template_content JSONB NOT NULL DEFAULT '{}',
  is_system BOOLEAN DEFAULT true,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_playbook_templates_type ON playbook_templates (deal_type, therapeutic_area);
CREATE INDEX idx_playbook_templates_team ON playbook_templates (team_id) WHERE team_id IS NOT NULL;

ALTER TABLE playbook_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read system templates"
  ON playbook_templates FOR SELECT
  USING (is_system = true);

CREATE POLICY "Team members can read team templates"
  ON playbook_templates FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Team members can create team templates"
  ON playbook_templates FOR INSERT
  WITH CHECK (
    is_system = false AND
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Service role full access to playbooks"
  ON playbook_templates FOR ALL
  USING (auth.role() = 'service_role');

-- Seed system templates with benchmark data from 1,900+ deals
INSERT INTO playbook_templates (deal_type, title, description, template_content, is_system) VALUES
(
  'licensing',
  'Standard Licensing Deal Framework',
  'Term sheet template for exclusive/non-exclusive licensing with milestone-heavy structures',
  '{
    "key_terms": [
      {"term": "Upfront Payment", "benchmark_range": "15-30% of total deal value", "notes": "Phase-dependent: Phase 1 ~15%, Phase 2 ~20%, Phase 3 ~30%"},
      {"term": "Development Milestones", "benchmark_range": "$50-250M cumulative", "notes": "Tied to IND filing, Phase 2 initiation, Phase 3 initiation, NDA filing"},
      {"term": "Regulatory Milestones", "benchmark_range": "$50-200M cumulative", "notes": "FDA approval, EMA approval, first commercial sale"},
      {"term": "Commercial Milestones", "benchmark_range": "$100-500M cumulative", "notes": "Tiered sales targets: $500M, $1B, $2B, $5B annual net sales"},
      {"term": "Royalty Rate", "benchmark_range": "5-15% tiered", "notes": "Low tier: 5-8% (<$1B), Mid: 8-12% ($1-3B), High: 12-15% (>$3B)"},
      {"term": "Territory", "benchmark_range": "Global or ex-US/ex-China", "notes": "Global rights command 2-3x premium over regional"},
      {"term": "Exclusivity", "benchmark_range": "Exclusive standard", "notes": "Non-exclusive rare; co-exclusive for specific territories/indications"}
    ],
    "negotiation_tips": [
      "Front-load milestones toward regulatory events (higher certainty) vs commercial events",
      "Negotiate royalty step-downs at patent expiry rather than flat rates",
      "Include anti-shelving provisions requiring minimum development spend",
      "Ensure reversion rights if licensee fails to meet diligence milestones within defined timelines",
      "Consider co-promotion rights in key territories as alternative to higher royalties"
    ],
    "counter_frameworks": [
      {"scenario": "Licensee pushes for lower upfront", "response": "Accept lower upfront in exchange for higher royalty escalators above $1B sales threshold"},
      {"scenario": "Licensee wants global rights but offers regional pricing", "response": "Counter with ex-China carve-out to retain Asia-Pacific optionality"},
      {"scenario": "Licensee proposes back-loaded milestones", "response": "Shift 20-30% of commercial milestones to regulatory milestones for de-risking"}
    ]
  }',
  true
),
(
  'acquisition',
  'Strategic Acquisition Framework',
  'Deal structure for full asset or company acquisitions with premium analysis',
  '{
    "key_terms": [
      {"term": "Purchase Price", "benchmark_range": "70-95% upfront of fair value", "notes": "Cash-heavy; stock consideration adds 10-20% to headline value"},
      {"term": "CVRs (Contingent Value Rights)", "benchmark_range": "$1-15/share", "notes": "Tied to regulatory approval or sales milestones; typical 15-30% of total consideration"},
      {"term": "Tender Offer Premium", "benchmark_range": "30-80% over 30-day VWAP", "notes": "Competitive situations drive premiums to 60-100%+"},
      {"term": "Break-Up Fee", "benchmark_range": "2-4% of deal value", "notes": "Standard protection for buyer; reverse break-up fee protects seller"},
      {"term": "Material Adverse Effect", "benchmark_range": "Standard MAE clause", "notes": "Negotiate carve-outs for clinical trial results and regulatory actions"}
    ],
    "negotiation_tips": [
      "In competitive situations, speed of execution matters more than price optimization",
      "CVRs allow bridging valuation gaps without upfront cash commitment",
      "Regulatory risk should be allocated via CVRs rather than price haircuts",
      "Stock consideration adds alignment but introduces market risk for seller shareholders",
      "Go-shop provisions (30-45 days) can surface competitive bids without derailing the deal"
    ],
    "counter_frameworks": [
      {"scenario": "Buyer offers all-cash at discount", "response": "Counter with CVR structure: lower upfront + regulatory milestone CVR to bridge the gap"},
      {"scenario": "Multiple bidders", "response": "Run a structured auction with clear bid deadlines; favor certainty of close over headline price"},
      {"scenario": "Buyer wants MAE carve-out for Phase 3 failure", "response": "Accept only if CVR value increases proportionally to offset downside risk transfer"}
    ]
  }',
  true
),
(
  'codevelopment',
  'Co-Development Partnership Framework',
  'Shared risk/reward structures for joint development programs',
  '{
    "key_terms": [
      {"term": "Cost Share", "benchmark_range": "50/50 to 70/30", "notes": "Licensor typically bears 30-50% of development costs"},
      {"term": "Profit Share", "benchmark_range": "50/50 in co-promote territory", "notes": "Matched to cost share ratio; US often co-promoted, ex-US sole licensee"},
      {"term": "Upfront Payment", "benchmark_range": "20-25% of total deal value", "notes": "Lower than pure licensing due to shared economics"},
      {"term": "Opt-In/Opt-Out Rights", "benchmark_range": "Phase 2 data readout", "notes": "Partner can opt-in to co-development at Phase 2 with incremental payment"},
      {"term": "Decision-Making", "benchmark_range": "Joint Steering Committee", "notes": "Key decisions (pivotal trial design, regulatory strategy) require unanimous consent"}
    ],
    "negotiation_tips": [
      "Align cost share with profit share to avoid misaligned incentives",
      "Define clear decision-making governance for clinical development disagreements",
      "Include opt-out provisions with pre-negotiated royalty fallback if partner exits",
      "Negotiate FTE rate caps to prevent cost inflation in co-development budgets",
      "Ensure IP ownership is clearly defined for improvements and combination products"
    ],
    "counter_frameworks": [
      {"scenario": "Partner wants 70/30 cost share but 50/50 profits", "response": "Accept if upfront payment compensates the 20% cost asymmetry or negotiate performance-based profit share escalators"},
      {"scenario": "Partner wants veto on pivotal trial design", "response": "Accept joint steering committee with defined escalation mechanism; ultimate decision rights to the originator on scientific matters"},
      {"scenario": "Partner wants global co-development", "response": "Offer US co-development + ex-US licensing to limit complexity; co-promote only where partner has commercial infrastructure"}
    ]
  }',
  true
),
(
  'option',
  'Option Deal Framework',
  'Structure for option-to-license agreements with milestone-triggered exercise',
  '{
    "key_terms": [
      {"term": "Option Fee", "benchmark_range": "$30-150M", "notes": "Non-refundable upfront payment for the right to license after data readout"},
      {"term": "Exercise Price", "benchmark_range": "$200M-$1B+", "notes": "Pre-negotiated licensing terms triggered upon option exercise"},
      {"term": "Option Period", "benchmark_range": "60-180 days post-data", "notes": "Starts after specified clinical readout; extensions typically negotiable"},
      {"term": "Exercise Trigger", "benchmark_range": "Phase 2 primary endpoint", "notes": "Clear, objective criteria for data quality that triggers exercise right"},
      {"term": "Walk-Away Rights", "benchmark_range": "Option fee forfeited", "notes": "No obligation to exercise; licensor retains rights and the option fee"}
    ],
    "negotiation_tips": [
      "Option structures benefit the licensee by capping downside (option fee) while preserving upside",
      "Negotiate the exercise price upfront — don't leave it to be determined post-data",
      "Include anti-dilution provisions if the licensor raises capital during the option period",
      "Define data quality thresholds clearly to avoid disputes about exercise triggers",
      "Consider multiple option points (Phase 1 data → Phase 2 data) with escalating option fees"
    ],
    "counter_frameworks": [
      {"scenario": "Licensee wants low option fee with high exercise price", "response": "Accept if option fee covers 12-18 months of development costs; ensures funding continuity"},
      {"scenario": "Licensee wants open-ended option period", "response": "Cap at 120 days post-readout with one 60-day extension for regulatory questions"},
      {"scenario": "Licensee wants subjective exercise criteria", "response": "Insist on objective, pre-specified criteria (p-value threshold, effect size minimum, safety endpoint)"}
    ]
  }',
  true
),
(
  'collaboration',
  'Research Collaboration Framework',
  'Broad platform access agreements with multi-target optionality',
  '{
    "key_terms": [
      {"term": "Upfront Payment", "benchmark_range": "$50-500M", "notes": "Platform access fee; higher for validated platforms with clinical proof-of-concept"},
      {"term": "Research Funding", "benchmark_range": "$10-50M/year", "notes": "FTE funding + research milestones for target nomination and validation"},
      {"term": "Target Options", "benchmark_range": "3-10 exclusive targets", "notes": "Licensee gets exclusive option on nominated targets; licensor retains unselected targets"},
      {"term": "Per-Target Milestones", "benchmark_range": "$150-500M per target", "notes": "IND, Phase 1 start, Phase 2 start, pivotal start, approval; per exercised target"},
      {"term": "Royalties", "benchmark_range": "3-8% tiered", "notes": "Lower than pure licensing due to partner''s contribution to discovery/development"}
    ],
    "negotiation_tips": [
      "Platform deals should value optionality — each target option has independent value",
      "Negotiate target exclusivity windows (12-18 months) to prevent indefinite reservation",
      "Include research success milestones to ensure the collaboration produces actionable results",
      "Cap FTE rates and define clear deliverables per research stage",
      "Ensure platform IP improvements during the collaboration revert to the licensor"
    ],
    "counter_frameworks": [
      {"scenario": "Partner wants unlimited target access", "response": "Offer 5 exclusive + 3 preferential targets with defined nomination timelines; uncapped access devalues the platform"},
      {"scenario": "Partner proposes low per-target milestones", "response": "Accept lower milestones in exchange for higher research funding or additional upfront to fund platform R&D"},
      {"scenario": "Partner wants to reduce research funding duration", "response": "Accept shorter duration only with minimum target nomination commitments (e.g., 2 targets in first 18 months)"}
    ]
  }',
  true
);
