-- 113_radar_throughput.sql
--
-- Asset Radar launch, workstream B (throughput) for the two slowest crons:
--
--   drug-resolve         149,144 clinical_assets, 98,166 unresolved; the cron
--                        did ~150 external lookups per 250 s run. This adds a
--                        negative cache for external misses, a set-based apply
--                        RPC for asset/owner writes, a prioritised queue of
--                        internal drug rows for the external pass, and the
--                        cross-company duplicate report as one aggregate.
--   partnership-refresh  25,409 of 149,144 checked at 1,500 per 6 h. This adds
--                        a bulk "nothing can change" stamp, a set-based apply
--                        RPC, a change-detection RPC for steady state, and the
--                        indexes the set-based queries need at 5,000 per run.
--
-- Everything is idempotent (IF NOT EXISTS / CREATE OR REPLACE). Every RPC
-- caps its own statement_timeout so a slow plan degrades the cron instead of
-- hanging it. Called from lib/radar/drug-master.ts and lib/radar/partnership.ts.

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════
-- PART A: drug resolution
-- ═════════════════════════════════════════════════════════════════════════

-- ── A1. Negative cache for external lookups ─────────────────────────────
-- One row per normalized name that GSRS, ChEMBL and PubChem all missed.
-- lib/radar/drug-master.ts treats a row younger than 30 days as "do not
-- query again"; older rows are re-tried and refreshed.

CREATE TABLE IF NOT EXISTS public.drug_resolve_negative_cache (
  alias_normalized  text PRIMARY KEY,
  checked_at        timestamptz NOT NULL DEFAULT now(),
  attempts          integer NOT NULL DEFAULT 1,
  -- hosts that returned no match on the last attempt
  sources           text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_drug_resolve_negative_cache_checked
  ON public.drug_resolve_negative_cache (checked_at);

ALTER TABLE public.drug_resolve_negative_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access drug negative cache" ON public.drug_resolve_negative_cache;
CREATE POLICY "Service role full access drug negative cache"
  ON public.drug_resolve_negative_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.drug_resolve_negative_cache IS
  'Normalized names that GSRS/ChEMBL/PubChem returned nothing for. 30-day TTL enforced by the resolver (lib/radar/drug-master.ts); stops every run re-querying the same unresolvable code name.';

-- ── A2. Queue index: local pass orders by last attempt, not creation ───
-- The fast local pass stamps drug_resolved_at on every asset it touches and
-- leaves non-industry misses 'unresolved', so the queue must rotate on the
-- stamp (NULLS FIRST) instead of created_at alone.

CREATE INDEX IF NOT EXISTS idx_clinical_assets_drug_resolve_rotation
  ON public.clinical_assets (drug_resolution_status, drug_resolved_at ASC NULLS FIRST, created_at ASC, id ASC);

-- External pass queue: internal rows never / stale checked.
CREATE INDEX IF NOT EXISTS idx_drug_master_internal_pending
  ON public.drug_master (external_checked_at ASC NULLS FIRST, created_at ASC)
  WHERE source = 'internal' AND is_combination = false;

-- ── A3. Set-based apply for the resolver ────────────────────────────────
-- p_rows: [{id, drug_master_id, status, confidence, modality, company_id, owner_role}]
-- Updates the asset, upserts drug_owners, and fills originator_company_id on
-- non-combination drugs whose originator is still unknown. One call per
-- 1,000 assets instead of 2-3 round trips per asset.

CREATE OR REPLACE FUNCTION public.radar_apply_drug_resolutions(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '90s'
AS $$
DECLARE
  v_assets integer := 0;
  v_owners integer := 0;
  v_originators integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_drug_resolutions;
  CREATE TEMP TABLE tmp_drug_resolutions ON COMMIT DROP AS
  SELECT DISTINCT ON (r.id)
    r.id, r.drug_master_id, r.status, r.confidence, r.modality, r.company_id, r.owner_role
  FROM jsonb_to_recordset(p_rows) AS r(
    id uuid, drug_master_id uuid, status text, confidence integer, modality text,
    company_id uuid, owner_role text
  )
  WHERE r.id IS NOT NULL
    AND r.status IN ('resolved', 'ambiguous', 'unresolvable');

  UPDATE public.clinical_assets ca
  SET drug_master_id = t.drug_master_id,
      drug_resolution_status = t.status,
      drug_resolution_confidence = t.confidence,
      drug_resolved_at = now(),
      modality = COALESCE(ca.modality, t.modality)
  FROM tmp_drug_resolutions t
  WHERE ca.id = t.id;
  GET DIAGNOSTICS v_assets = ROW_COUNT;

  INSERT INTO public.drug_owners (drug_id, company_id, role, territory, evidence_type, evidence_id, updated_at)
  SELECT DISTINCT ON (t.drug_master_id, t.company_id, t.owner_role)
    t.drug_master_id, t.company_id, t.owner_role, 'global', 'clinical_asset', t.id, now()
  FROM tmp_drug_resolutions t
  WHERE t.drug_master_id IS NOT NULL
    AND t.company_id IS NOT NULL
    AND t.owner_role IN ('originator', 'licensee', 'co_developer', 'unknown')
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = t.company_id)
  ON CONFLICT (drug_id, company_id, role, territory) DO UPDATE
    SET evidence_type = EXCLUDED.evidence_type,
        evidence_id = EXCLUDED.evidence_id,
        updated_at = now();
  GET DIAGNOSTICS v_owners = ROW_COUNT;

  UPDATE public.drug_master dm
  SET originator_company_id = t.company_id
  FROM (
    SELECT DISTINCT ON (drug_master_id) drug_master_id, company_id
    FROM tmp_drug_resolutions
    WHERE owner_role = 'originator' AND drug_master_id IS NOT NULL AND company_id IS NOT NULL
    ORDER BY drug_master_id, id
  ) t
  WHERE dm.id = t.drug_master_id
    AND dm.originator_company_id IS NULL
    AND dm.is_combination = false
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = t.company_id);
  GET DIAGNOSTICS v_originators = ROW_COUNT;

  RETURN jsonb_build_object(
    'assets_updated', v_assets,
    'owners_written', v_owners,
    'originators_set', v_originators
  );
END;
$$;

COMMENT ON FUNCTION public.radar_apply_drug_resolutions(jsonb) IS
  'Set-based write for lib/radar/drug-master.ts: updates clinical_assets drug_* columns, upserts drug_owners and fills originator_company_id in one statement per batch.';

-- ── A4. Prioritised queue of internal drug rows for the external pass ───
-- Industry-owned first, then highest phase, then most assets sharing the
-- row (one external hit resolves every asset keyed on it), then oldest.

CREATE OR REPLACE FUNCTION public.radar_internal_drugs_pending(
  p_limit integer DEFAULT 800,
  p_recheck_days integer DEFAULT 30
)
RETURNS TABLE(
  id uuid,
  preferred_name text,
  inn text,
  external_checked_at timestamptz,
  industry boolean,
  phase_rank integer,
  asset_count bigint
)
LANGUAGE sql STABLE
SET statement_timeout = '60s'
AS $$
  SELECT
    dm.id,
    dm.preferred_name,
    dm.inn,
    dm.external_checked_at,
    COALESCE(bool_or(c.owner_type = 'industry'), false) AS industry,
    COALESCE(MAX(CASE ca.phase
      WHEN 'phase_4' THEN 7 WHEN 'phase_3' THEN 6 WHEN 'phase_2_3' THEN 5
      WHEN 'phase_2' THEN 4 WHEN 'phase_1_2' THEN 3 WHEN 'phase_1' THEN 2
      WHEN 'early_phase_1' THEN 1 ELSE 0 END), 0)::integer AS phase_rank,
    COUNT(ca.id) AS asset_count
  FROM public.drug_master dm
  JOIN public.clinical_assets ca ON ca.drug_master_id = dm.id
  LEFT JOIN public.companies c ON c.id = ca.company_id
  WHERE dm.source = 'internal'
    AND dm.is_combination = false
    AND (dm.external_checked_at IS NULL
         OR dm.external_checked_at < now() - make_interval(days => GREATEST(COALESCE(p_recheck_days, 30), 1)))
  GROUP BY dm.id
  ORDER BY industry DESC, phase_rank DESC, asset_count DESC, dm.created_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 800), 1);
$$;

COMMENT ON FUNCTION public.radar_internal_drugs_pending(integer, integer) IS
  'Internal drug_master rows that still need a GSRS/ChEMBL/PubChem check, industry-owned and late-phase first. Consumed by the drug-resolve external pass.';

-- ── A5. Cross-company duplicate report ──────────────────────────────────
-- drug_master_id shared by >= 2 distinct company_ids among industry-owned
-- assets. total_groups is the full count; rows are the top p_limit.

CREATE OR REPLACE FUNCTION public.radar_drug_duplicates(p_limit integer DEFAULT 50)
RETURNS TABLE(
  drug_master_id uuid,
  preferred_name text,
  companies bigint,
  assets bigint,
  sample_assets text[],
  total_groups bigint
)
LANGUAGE sql STABLE
SET statement_timeout = '60s'
AS $$
  WITH groups AS (
    SELECT
      ca.drug_master_id,
      COUNT(DISTINCT ca.company_id) AS companies,
      COUNT(*) AS assets,
      (ARRAY_AGG(ca.company_name || ' / ' || ca.asset_name ORDER BY ca.company_name, ca.asset_name))[1:6] AS sample_assets
    FROM public.clinical_assets ca
    JOIN public.companies c ON c.id = ca.company_id AND c.owner_type = 'industry'
    WHERE ca.drug_master_id IS NOT NULL
    GROUP BY ca.drug_master_id
    HAVING COUNT(DISTINCT ca.company_id) >= 2
  )
  SELECT
    g.drug_master_id,
    dm.preferred_name,
    g.companies,
    g.assets,
    g.sample_assets,
    COUNT(*) OVER () AS total_groups
  FROM groups g
  JOIN public.drug_master dm ON dm.id = g.drug_master_id
  ORDER BY g.companies DESC, g.assets DESC, dm.preferred_name ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

COMMENT ON FUNCTION public.radar_drug_duplicates(integer) IS
  'Drug nodes held by two or more distinct industry companies: the cross-sponsor duplicate report surfaced in the drug-resolve run log.';

-- ── A6. Backlog figures for the run log ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.radar_drug_resolve_backlog()
RETURNS jsonb
LANGUAGE sql STABLE
SET statement_timeout = '30s'
AS $$
  SELECT jsonb_build_object(
    'unresolved',
      (SELECT COUNT(*) FROM public.clinical_assets WHERE drug_resolution_status = 'unresolved'),
    'unresolved_never_attempted',
      (SELECT COUNT(*) FROM public.clinical_assets WHERE drug_resolution_status = 'unresolved' AND drug_resolved_at IS NULL),
    'internal_pending_external',
      (SELECT COUNT(*) FROM public.drug_master WHERE source = 'internal' AND is_combination = false AND external_checked_at IS NULL),
    'resolved',
      (SELECT COUNT(*) FROM public.clinical_assets WHERE drug_resolution_status = 'resolved')
  );
$$;

-- ═════════════════════════════════════════════════════════════════════════
-- PART B: partnership refresh
-- ═════════════════════════════════════════════════════════════════════════

-- ── B1. Indexes for the set-based queries at 5,000 assets per run ───────
-- deals(licensor_id) and deals(licensor_name) exist from 002; the stamp and
-- change-detection RPCs compare lower(licensor_name).

CREATE INDEX IF NOT EXISTS idx_deals_licensor_name_lower
  ON public.deals (lower(licensor_name));

CREATE INDEX IF NOT EXISTS idx_clinical_assets_company_name_lower
  ON public.clinical_assets (lower(company_name));

CREATE INDEX IF NOT EXISTS idx_deals_updated_at
  ON public.deals (updated_at);

CREATE INDEX IF NOT EXISTS idx_company_trials_created_at
  ON public.company_trials (created_at);

CREATE INDEX IF NOT EXISTS idx_press_releases_created_at
  ON public.press_releases (created_at);

-- Refresh queue paged by (checked_at NULLS FIRST, id): 109 indexed checked_at alone.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_partnership_checked_id
  ON public.clinical_assets (partnership_checked_at ASC NULLS FIRST, id ASC);

-- ── B2. Bulk stamp: assets whose company has no evidence source at all ──
-- Eligible = never checked, no legacy deal_ids, company has zero deals as
-- licensor (by id, exact name or any name variation), zero trial rows on the
-- asset's NCTs that carry a collaborator or belong to another company, and
-- zero licensing / m&a press mentions. Every test is a superset of what
-- derivePartnership() would consider, so stamping 'unpartnered' here yields
-- exactly the row the TypeScript path would write (confidence 40, no
-- partner, ['global'] available).

CREATE OR REPLACE FUNCTION public.radar_partnership_stamp_unpartnered(p_scan integer DEFAULT 20000)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '150s'
AS $$
DECLARE
  v_scanned integer := 0;
  v_stamped integer := 0;
  v_by_prev jsonb := '{}'::jsonb;
BEGIN
  DROP TABLE IF EXISTS tmp_partnership_scan;
  DROP TABLE IF EXISTS tmp_partnership_eligible;
  CREATE TEMP TABLE tmp_partnership_scan ON COMMIT DROP AS
  SELECT ca.id, ca.company_id, ca.company_name, ca.nct_ids, ca.partnership_status
  FROM public.clinical_assets ca
  WHERE ca.partnership_checked_at IS NULL
  ORDER BY ca.id
  LIMIT GREATEST(COALESCE(p_scan, 20000), 1);
  GET DIAGNOSTICS v_scanned = ROW_COUNT;

  CREATE TEMP TABLE tmp_partnership_eligible ON COMMIT DROP AS
  SELECT s.id, s.partnership_status
  FROM tmp_partnership_scan s
  LEFT JOIN public.companies c ON c.id = s.company_id
  WHERE NOT EXISTS (
      SELECT 1 FROM public.clinical_assets x
      WHERE x.id = s.id AND x.deal_ids IS NOT NULL AND cardinality(x.deal_ids) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.deals d
      WHERE (s.company_id IS NOT NULL AND d.licensor_id = s.company_id)
         OR lower(d.licensor_name) = lower(s.company_name)
         OR (c.name IS NOT NULL AND lower(d.licensor_name) = lower(c.name))
         OR (c.name_variations IS NOT NULL AND d.licensor_name = ANY(c.name_variations))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.company_trials t
      WHERE s.nct_ids IS NOT NULL
        AND t.nct_id = ANY(s.nct_ids)
        AND (
          (t.collaborator_names IS NOT NULL AND cardinality(t.collaborator_names) > 0)
          OR t.company_id IS DISTINCT FROM s.company_id
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.press_releases p
      WHERE p.categories && ARRAY['licensing', 'm&a']::text[]
        AND (
          (s.company_id IS NOT NULL AND p.company_ids && ARRAY[s.company_id])
          OR p.companies_mentioned && ARRAY[s.company_name]
          OR (c.name IS NOT NULL AND p.companies_mentioned && ARRAY[c.name])
          OR (c.name_variations IS NOT NULL AND p.companies_mentioned && c.name_variations)
        )
    );

  SELECT COALESCE(jsonb_object_agg(COALESCE(partnership_status, 'unknown'), n), '{}'::jsonb)
  INTO v_by_prev
  FROM (SELECT partnership_status, COUNT(*) AS n FROM tmp_partnership_eligible GROUP BY partnership_status) q;

  UPDATE public.clinical_assets ca
  SET partnership_status = 'unpartnered',
      partner_company_name = NULL,
      partner_company_id = NULL,
      territory_rights_available = ARRAY['global']::text[],
      deal_id = NULL,
      deal_ids = ARRAY[]::uuid[],
      partnership_evidence = '[]'::jsonb,
      partnership_confidence = 40,
      partnership_checked_at = now()
  FROM tmp_partnership_eligible e
  WHERE ca.id = e.id
    AND ca.partnership_checked_at IS NULL;
  GET DIAGNOSTICS v_stamped = ROW_COUNT;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'stamped', v_stamped,
    'by_previous_status', v_by_prev
  );
END;
$$;

COMMENT ON FUNCTION public.radar_partnership_stamp_unpartnered(integer) IS
  'Backlog shortcut for the partnership refresh: stamps never-checked assets whose company has no deal, collaborator or press signal as unpartnered in one UPDATE. Superset tests of lib/radar/partnership.ts derivePartnership().';

-- ── B3. Set-based apply for changed partnership rows ────────────────────
-- p_rows: [{id, status, partner_company_name, partner_company_id,
--           territory_rights_available, deal_id, deal_ids, evidence, confidence}]

CREATE OR REPLACE FUNCTION public.radar_apply_partnership(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout = '90s'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE public.clinical_assets ca
  SET partnership_status = r.status,
      partner_company_name = r.partner_company_name,
      partner_company_id = r.partner_company_id,
      territory_rights_available = COALESCE(r.territory_rights_available, ARRAY['global']::text[]),
      deal_id = r.deal_id,
      deal_ids = COALESCE(r.deal_ids, ARRAY[]::uuid[]),
      partnership_evidence = COALESCE(r.evidence, '[]'::jsonb),
      partnership_confidence = LEAST(100, GREATEST(0, COALESCE(r.confidence, 0))),
      partnership_checked_at = now()
  FROM jsonb_to_recordset(p_rows) AS r(
    id uuid, status text, partner_company_name text, partner_company_id uuid,
    territory_rights_available text[], deal_id uuid, deal_ids uuid[], evidence jsonb, confidence integer
  )
  WHERE ca.id = r.id
    AND r.status IN ('unpartnered', 'partially_partnered', 'partnered')
    AND (r.partner_company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = r.partner_company_id));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.radar_apply_partnership(jsonb) IS
  'Set-based write for lib/radar/partnership.ts refreshPartnershipBatch: one statement per batch of changed rows.';

-- ── B4. Steady state: assets whose evidence sources changed ─────────────
-- Companies with a deal created/updated, a licensing / m&a press item
-- ingested, or a new trial row with collaborators since p_since; returns
-- the assets of those companies (and assets on the changed NCTs) that were
-- checked before the change. company_trials.updated_at is bumped by every
-- CT.gov sweep, so trials are keyed on created_at; collaborator edits on
-- existing trials are caught by the rolling 30-day re-check in the driver.

CREATE OR REPLACE FUNCTION public.radar_partnership_changed_assets(
  p_since timestamptz,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(id uuid, changed_at timestamptz, reason text)
LANGUAGE sql STABLE
SET statement_timeout = '90s'
AS $$
  WITH deal_companies AS (
    SELECT d.licensor_id AS company_id, lower(d.licensor_name) AS name_key,
           GREATEST(d.created_at, d.updated_at) AS at
    FROM public.deals d
    WHERE GREATEST(d.created_at, d.updated_at) > p_since
  ),
  press_companies AS (
    SELECT cid AS company_id, NULL::text AS name_key, p.created_at AS at
    FROM public.press_releases p
    CROSS JOIN LATERAL unnest(p.company_ids) AS cid
    WHERE p.created_at > p_since
      AND p.categories && ARRAY['licensing', 'm&a']::text[]
    UNION ALL
    SELECT NULL::uuid, lower(m), p.created_at
    FROM public.press_releases p
    CROSS JOIN LATERAL unnest(p.companies_mentioned) AS m
    WHERE p.created_at > p_since
      AND p.categories && ARRAY['licensing', 'm&a']::text[]
  ),
  changed_ncts AS (
    SELECT t.nct_id, t.created_at AS at
    FROM public.company_trials t
    WHERE t.created_at > p_since
  ),
  -- One arm per join key so each can use its own index (company_id, lower(company_name)).
  hits AS (
    SELECT ca.id, dc.at, 'deal'::text AS reason
    FROM deal_companies dc
    JOIN public.clinical_assets ca ON ca.company_id = dc.company_id
    WHERE dc.company_id IS NOT NULL
      AND (ca.partnership_checked_at IS NULL OR ca.partnership_checked_at < dc.at)
    UNION ALL
    SELECT ca.id, dc.at, 'deal'
    FROM deal_companies dc
    JOIN public.clinical_assets ca ON lower(ca.company_name) = dc.name_key
    WHERE dc.name_key IS NOT NULL
      AND (ca.partnership_checked_at IS NULL OR ca.partnership_checked_at < dc.at)
    UNION ALL
    SELECT ca.id, pc.at, 'press'
    FROM press_companies pc
    JOIN public.clinical_assets ca ON ca.company_id = pc.company_id
    WHERE pc.company_id IS NOT NULL
      AND (ca.partnership_checked_at IS NULL OR ca.partnership_checked_at < pc.at)
    UNION ALL
    SELECT ca.id, pc.at, 'press'
    FROM press_companies pc
    JOIN public.clinical_assets ca ON lower(ca.company_name) = pc.name_key
    WHERE pc.name_key IS NOT NULL
      AND (ca.partnership_checked_at IS NULL OR ca.partnership_checked_at < pc.at)
    UNION ALL
    SELECT ca.id, n.at, 'trial'
    FROM changed_ncts n
    JOIN public.clinical_assets ca ON ca.nct_ids && ARRAY[n.nct_id]
    WHERE ca.partnership_checked_at IS NULL OR ca.partnership_checked_at < n.at
  )
  SELECT h.id, MAX(h.at) AS changed_at, MIN(h.reason) AS reason
  FROM hits h
  GROUP BY h.id
  ORDER BY MAX(h.at) ASC
  LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
$$;

COMMENT ON FUNCTION public.radar_partnership_changed_assets(timestamptz, integer) IS
  'Steady-state change detection for the partnership refresh: assets whose company gained a deal, press mention or trial row after they were last checked.';

-- ── B5. Backlog figure for the run log ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.radar_partnership_backlog()
RETURNS jsonb
LANGUAGE sql STABLE
SET statement_timeout = '30s'
AS $$
  SELECT jsonb_build_object(
    'never_checked', (SELECT COUNT(*) FROM public.clinical_assets WHERE partnership_checked_at IS NULL),
    'checked', (SELECT COUNT(*) FROM public.clinical_assets WHERE partnership_checked_at IS NOT NULL),
    'stale_30d', (SELECT COUNT(*) FROM public.clinical_assets WHERE partnership_checked_at < now() - interval '30 days')
  );
$$;

COMMIT;
