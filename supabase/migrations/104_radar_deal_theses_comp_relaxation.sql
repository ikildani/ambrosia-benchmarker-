-- Asset Radar Layer 3: record how the comp pool was built.
--
-- comp_relaxation   which rung of the shared relaxation ladder produced the
--                   pool ('none' | 'modality_only' | 'ta_only')
-- insufficient_comps true when the pool was below the 5-comp floor; predicted
--                   terms are NULL on such rows and the UI must not show numbers
-- comp_dispersion   IQR / median of disclosed totals — feeds the confidence penalty
--
-- lib/radar/deal-thesis.ts degrades gracefully if these columns are absent.

ALTER TABLE radar_deal_theses
  ADD COLUMN IF NOT EXISTS comp_relaxation TEXT
    CHECK (comp_relaxation IN ('none', 'modality_only', 'ta_only')),
  ADD COLUMN IF NOT EXISTS insufficient_comps BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comp_dispersion NUMERIC;

CREATE INDEX IF NOT EXISTS idx_radar_deal_theses_insufficient
  ON radar_deal_theses (insufficient_comps)
  WHERE insufficient_comps = true;
