-- 112_radar_classification.sql
--
-- Asset classification pass (Asset Radar, Workstream A).
--
-- On Sep 15 the universe held 149,144 clinical_assets with 31,479 NULL
-- therapeutic_area, 15,943 NULL modality, and target / mechanism empty on
-- essentially every row. lib/radar/classify.ts fills those columns from the
-- asset's trial evidence (brief summaries, conditions, intervention
-- descriptions) via a batched model call, or from drug_master when the drug
-- is already resolved with a modality and target.
--
-- Every decision carries provenance: which model (or 'drug_master') made it,
-- when, with what confidence, and which input field decided each value
-- (classification_evidence). Low-confidence suggestions are parked in
-- classification_evidence with status 'needs_review' and the data columns
-- untouched, so nothing uncertain ever reaches the feed silently.
--
-- Idempotent: safe to re-run.

-- ── 1. Columns ───────────────────────────────────────────────────────────────

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS classification_status TEXT NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS classification_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS classification_model TEXT,
  ADD COLUMN IF NOT EXISTS classification_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_class TEXT,
  ADD COLUMN IF NOT EXISTS moa_short TEXT;

-- ── 2. Constraints (guarded so the migration can be re-applied) ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_classification_status_check'
  ) THEN
    ALTER TABLE public.clinical_assets
      ADD CONSTRAINT clinical_assets_classification_status_check
      CHECK (classification_status IN ('unclassified', 'classified', 'needs_review', 'skipped'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_classification_confidence_range'
  ) THEN
    ALTER TABLE public.clinical_assets
      ADD CONSTRAINT clinical_assets_classification_confidence_range
      CHECK (classification_confidence IS NULL OR (classification_confidence >= 0 AND classification_confidence <= 100));
  END IF;

  -- ChEMBL-style target classes. 'unknown' is the explicit "model could not
  -- tell" value; NULL means the classifier has not run for this row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_target_class_vocab'
  ) THEN
    ALTER TABLE public.clinical_assets
      ADD CONSTRAINT clinical_assets_target_class_vocab
      CHECK (
        target_class IS NULL OR target_class IN (
          'enzyme', 'gpcr', 'ion_channel', 'transporter', 'kinase',
          'nuclear_receptor', 'cytokine', 'antigen', 'unknown'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_moa_short_length'
  ) THEN
    ALTER TABLE public.clinical_assets
      ADD CONSTRAINT clinical_assets_moa_short_length
      CHECK (moa_short IS NULL OR char_length(moa_short) <= 80);
  END IF;
END $$;

-- ── 3. Indexes ───────────────────────────────────────────────────────────────

-- Queue scan: classification_status = 'unclassified' ORDER BY updated_at.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_classification_queue
  ON public.clinical_assets (classification_status, updated_at);

-- needs_review re-queue after 30 days and the validation sampler both read by classified_at.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_classified_at
  ON public.clinical_assets (classified_at)
  WHERE classified_at IS NOT NULL;

-- Facet: target and target_class for the feed rail (only classified rows carry them).
CREATE INDEX IF NOT EXISTS idx_clinical_assets_target_class
  ON public.clinical_assets (target_class)
  WHERE target_class IS NOT NULL;

-- ── 4. Comments ──────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.clinical_assets.classification_status IS
  'Asset classification pass (lib/radar/classify.ts). unclassified = never run; classified = values written; needs_review = model confidence < 60 or out-of-vocabulary output, suggestion parked in classification_evidence and data columns untouched (re-queued after 30 days); skipped = non-drug or placebo/generic name.';
COMMENT ON COLUMN public.clinical_assets.classified_at IS
  'When the classification pass last decided this row (any status except unclassified).';
COMMENT ON COLUMN public.clinical_assets.classification_confidence IS
  '0-100. Model self-reported confidence for the row, or drug_master.confidence when classification_model = drug_master.';
COMMENT ON COLUMN public.clinical_assets.classification_model IS
  'Provenance: model id that produced the values (e.g. claude-sonnet-5) or drug_master when reused from the resolved drug node without a model call.';
COMMENT ON COLUMN public.clinical_assets.classification_evidence IS
  'JSONB provenance. { version, decided_by (asset_name | aliases | conditions | brief_summary | intervention_description | drug_master), nct_ids consulted, fields: { column: { value, prior, source, written } }, suggestion (only for needs_review), reason }.';
COMMENT ON COLUMN public.clinical_assets.target_class IS
  'ChEMBL-style protein target class: enzyme, gpcr, ion_channel, transporter, kinase, nuclear_receptor, cytokine, antigen, unknown. Written only when classification_confidence >= 60.';
COMMENT ON COLUMN public.clinical_assets.moa_short IS
  'Mechanism of action in <= 80 characters, e.g. "PD-1 blocking antibody" or "KRAS G12C covalent inhibitor". Written only when classification_confidence >= 60.';
