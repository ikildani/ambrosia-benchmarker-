-- Migration 139 — score archive: an append-only, time-stamped copy of every
-- score and prediction any AlaricAI product produces.
--
-- Why: licensed score feeds and the Alaric track record need point-in-time
-- history — proof of what a model said on a date, before the outcome was
-- known. `predictions` cannot be that record: it is mutable (status moves),
-- deduped per 24 h, and covers three Solidus sources. This archive is written
-- once and never changed.
--
-- What makes it unchangeable:
--   * BEFORE UPDATE / DELETE row triggers and a BEFORE TRUNCATE statement
--     trigger raise on both tables;
--   * UPDATE, DELETE and TRUNCATE are revoked from anon, authenticated and
--     service_role (service_role bypasses RLS, not grants);
--   * recorded_at and the hashes are set by the database, never the caller;
--   * each UTC day is sealed into score_archive_digests: sha256 over the
--     day's row hashes, chained to the previous day's digest. Re-running
--     verify_score_archive() recomputes every row and every day, so an edit
--     made by the database owner with triggers disabled still shows up.
--     Copy the daily chain_sha256 somewhere outside this database (the
--     digest cron logs it) for evidence that does not depend on this project.
--
-- No foreign keys on purpose: ON DELETE SET NULL / CASCADE would need an
-- UPDATE or DELETE here and fail, blocking company merges and account
-- deletion. Entity and source ids are stored as plain text.
--
-- Confidential inputs: for user-originated scores (calculator, brief, share)
-- writers keep only inputs_sha256 plus coarse profile fields (TA, phase,
-- modality, indication); licensor and asset names are hashed. Nothing a
-- client entered in confidence is kept in a table that can never be deleted.
--
-- Writers: DB triggers on predictions / outcomes (below), lib/score-archive
-- from app code, and POST /api/score-archive for Terrain, Augur, IP Map and
-- the Alaric engine (x-api-key = ENTITY_API_KEY).
--
-- Reversal (the only way rows leave this table — drops the whole history):
--   DROP TRIGGER IF EXISTS trg_predictions_score_archive ON predictions;
--   DROP TRIGGER IF EXISTS trg_outcomes_score_archive ON outcomes;
--   DROP FUNCTION IF EXISTS archive_prediction_row() CASCADE;
--   DROP FUNCTION IF EXISTS archive_outcome_row() CASCADE;
--   DROP TABLE IF EXISTS score_archive_digests; DROP TABLE IF EXISTS score_archive;
--   DROP FUNCTION IF EXISTS score_archive_row_sha256(score_archive);
--   DROP FUNCTION IF EXISTS score_archive_before_insert();
--   DROP FUNCTION IF EXISTS score_archive_reject_change();
--   DROP FUNCTION IF EXISTS seal_score_archive_days();
--   DROP FUNCTION IF EXISTS verify_score_archive(date, date);
--   DROP FUNCTION IF EXISTS score_archive_utc_text(timestamptz);

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- 1. score_archive — one row per score / prediction, never changed
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS score_archive (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at       timestamptz NOT NULL DEFAULT clock_timestamp(),

  product           text NOT NULL CHECK (product IN ('solidus', 'terrain', 'augur', 'ip_map', 'alaric')),
  score_type        text NOT NULL CHECK (score_type ~ '^[a-z0-9][a-z0-9_.:-]{0,63}$'),
  model_version     text NOT NULL CHECK (length(model_version) BETWEEN 1 AND 100),
  industry          text NOT NULL DEFAULT 'life_sciences' CHECK (industry ~ '^[a-z0-9_]{1,40}$'),
  origin            text NOT NULL CHECK (origin IN ('platform', 'user', 'api', 'client')),

  entity_type       text NOT NULL CHECK (entity_type IN ('asset', 'company', 'deal', 'indication', 'portfolio', 'profile', 'patent', 'prediction')),
  entity_id         text,
  entity_label      text,
  therapeutic_area  text,
  phase             text,
  modality          text,
  indication        text,

  source_table      text,
  source_id         text,
  prediction_id     uuid,

  inputs            jsonb,
  inputs_sha256     text NOT NULL,
  output            jsonb NOT NULL,
  data_as_of        text,
  horizon_end       date,

  row_sha256        text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_score_archive_recorded_at   ON score_archive (recorded_at);
CREATE INDEX IF NOT EXISTS idx_score_archive_product_type  ON score_archive (product, score_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_archive_entity        ON score_archive (entity_type, entity_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_score_archive_source        ON score_archive (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_score_archive_prediction_id ON score_archive (prediction_id) WHERE prediction_id IS NOT NULL;

COMMENT ON TABLE  score_archive IS 'Sep 2026: append-only, time-stamped copy of every score and prediction from Solidus, Terrain, Augur, IP Map and the Alaric engine. Never updated or deleted (triggers + revoked grants); sealed daily into score_archive_digests. Point-in-time history for accuracy claims and licensed score feeds.';
COMMENT ON COLUMN score_archive.recorded_at IS 'Set by the database (clock_timestamp) on insert; any caller value is overwritten.';
COMMENT ON COLUMN score_archive.product IS 'solidus | terrain | augur | ip_map | alaric.';
COMMENT ON COLUMN score_archive.score_type IS 'What was scored, dotted: calculator.deal_terms, brief.call, radar.licensing_intent, ledger.brief, outcome.accepted, terrain.demand, augur.fair_value, ip_map.loe_year, alaric.deal_likelihood …';
COMMENT ON COLUMN score_archive.model_version IS 'Model / engine version that produced the output.';
COMMENT ON COLUMN score_archive.industry IS 'Industry vertical; life_sciences until a second vertical ships.';
COMMENT ON COLUMN score_archive.origin IS 'platform (cron / nightly), user (a signed-in user asked), api (enterprise or MCP API), client (client-reported outcome).';
COMMENT ON COLUMN score_archive.entity_type IS 'Kind of thing scored; profile = a TA × phase × modality query with no single entity.';
COMMENT ON COLUMN score_archive.entity_id IS 'Shared entity-graph id when known (companies.id, drug_master.id / clinical_assets.id, deals.id, Terrain indication slug). Plain text, no FK.';
COMMENT ON COLUMN score_archive.entity_label IS 'Public name of the entity. Null (or hashed) for confidential client entities.';
COMMENT ON COLUMN score_archive.source_table IS 'Mutable table the score also lives in, when any (calculations, benchmark_requests, clinical_assets, predictions, outcomes).';
COMMENT ON COLUMN score_archive.source_id IS 'Row id in source_table. May point at a row that has since been deleted.';
COMMENT ON COLUMN score_archive.prediction_id IS 'predictions.id this row copies or relates to (no FK).';
COMMENT ON COLUMN score_archive.inputs IS 'Inputs the score was computed from. Null for confidential client inputs — inputs_sha256 still proves what they were.';
COMMENT ON COLUMN score_archive.inputs_sha256 IS 'sha256 of the canonical inputs (writer-supplied for confidential inputs, else computed from inputs by the database).';
COMMENT ON COLUMN score_archive.output IS 'The score / prediction exactly as produced.';
COMMENT ON COLUMN score_archive.data_as_of IS 'As-of marker of the data or priors used (e.g. predictions.priors_as_of, Terrain asOf).';
COMMENT ON COLUMN score_archive.horizon_end IS 'Date by which the prediction can be judged, when it has one.';
COMMENT ON COLUMN score_archive.row_sha256 IS 'sha256 of every other column in canonical form (score_archive_row_sha256). Set by the database.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. Hashing
-- ══════════════════════════════════════════════════════════════════════

-- Timestamps hashed as fixed-format UTC text so the hash never depends on
-- the session TimeZone.
CREATE OR REPLACE FUNCTION score_archive_utc_text(ts timestamptz)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
SET search_path = pg_catalog
AS $$ SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') $$;

-- jsonb text output is canonical (keys sorted, whitespace fixed), so the
-- object below serialises the same way on every run.
CREATE OR REPLACE FUNCTION score_archive_row_sha256(r score_archive)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object(
    'id', r.id,
    'recorded_at', score_archive_utc_text(r.recorded_at),
    'product', r.product,
    'score_type', r.score_type,
    'model_version', r.model_version,
    'industry', r.industry,
    'origin', r.origin,
    'entity_type', r.entity_type,
    'entity_id', r.entity_id,
    'entity_label', r.entity_label,
    'therapeutic_area', r.therapeutic_area,
    'phase', r.phase,
    'modality', r.modality,
    'indication', r.indication,
    'source_table', r.source_table,
    'source_id', r.source_id,
    'prediction_id', r.prediction_id,
    'inputs', r.inputs,
    'inputs_sha256', r.inputs_sha256,
    'output', r.output,
    'data_as_of', r.data_as_of,
    'horizon_end', r.horizon_end
  )::text, 'UTF8')), 'hex')
$$;

CREATE OR REPLACE FUNCTION score_archive_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.id := COALESCE(NEW.id, gen_random_uuid());
  NEW.recorded_at := clock_timestamp();
  IF NEW.inputs IS NOT NULL THEN
    NEW.inputs_sha256 := encode(sha256(convert_to(NEW.inputs::text, 'UTF8')), 'hex');
  ELSIF NEW.inputs_sha256 IS NULL OR NEW.inputs_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'score_archive: inputs or a 64-char hex inputs_sha256 is required';
  END IF;
  NEW.row_sha256 := score_archive_row_sha256(NEW);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION score_archive_reject_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_archive_before_insert ON score_archive;
CREATE TRIGGER trg_score_archive_before_insert
  BEFORE INSERT ON score_archive
  FOR EACH ROW EXECUTE FUNCTION score_archive_before_insert();

DROP TRIGGER IF EXISTS trg_score_archive_no_update_delete ON score_archive;
CREATE TRIGGER trg_score_archive_no_update_delete
  BEFORE UPDATE OR DELETE ON score_archive
  FOR EACH ROW EXECUTE FUNCTION score_archive_reject_change();

DROP TRIGGER IF EXISTS trg_score_archive_no_truncate ON score_archive;
CREATE TRIGGER trg_score_archive_no_truncate
  BEFORE TRUNCATE ON score_archive
  FOR EACH STATEMENT EXECUTE FUNCTION score_archive_reject_change();

-- ══════════════════════════════════════════════════════════════════════
-- 3. score_archive_digests — one sealed, chained digest per UTC day
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS score_archive_digests (
  day           date PRIMARY KEY,
  sealed_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  row_count     integer NOT NULL CHECK (row_count >= 0),
  day_sha256    text NOT NULL,
  prev_sha256   text,
  chain_sha256  text NOT NULL
);

COMMENT ON TABLE  score_archive_digests IS 'Sep 2026: one row per sealed UTC day of score_archive. day_sha256 = sha256 of the day''s row_sha256 values in (recorded_at, id) order; chain_sha256 = sha256(prev_sha256 || day_sha256). Append-only.';
COMMENT ON COLUMN score_archive_digests.day IS 'UTC calendar day of score_archive.recorded_at.';
COMMENT ON COLUMN score_archive_digests.row_count IS 'Rows recorded that day.';
COMMENT ON COLUMN score_archive_digests.day_sha256 IS 'sha256 over the day''s row hashes, newline-joined in (recorded_at, id) order; sha256 of the empty string for a day with no rows.';
COMMENT ON COLUMN score_archive_digests.prev_sha256 IS 'chain_sha256 of the previous day; null for the first sealed day.';
COMMENT ON COLUMN score_archive_digests.chain_sha256 IS 'sha256(coalesce(prev_sha256, '''') || day_sha256). Publish this outside the database.';

DROP TRIGGER IF EXISTS trg_score_archive_digests_no_update_delete ON score_archive_digests;
CREATE TRIGGER trg_score_archive_digests_no_update_delete
  BEFORE UPDATE OR DELETE ON score_archive_digests
  FOR EACH ROW EXECUTE FUNCTION score_archive_reject_change();

DROP TRIGGER IF EXISTS trg_score_archive_digests_no_truncate ON score_archive_digests;
CREATE TRIGGER trg_score_archive_digests_no_truncate
  BEFORE TRUNCATE ON score_archive_digests
  FOR EACH STATEMENT EXECUTE FUNCTION score_archive_reject_change();

-- Seals every unsealed UTC day that ended more than an hour ago, oldest
-- first. Idempotent; safe to call from a cron every day.
CREATE OR REPLACE FUNCTION seal_score_archive_days()
RETURNS TABLE (day date, row_count integer, chain_sha256 text)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  cutoff   date := ((clock_timestamp() - interval '1 hour') AT TIME ZONE 'UTC')::date;
  d        date;
  prev     text;
  n        integer;
  day_hash text;
  chain    text;
BEGIN
  -- One sealer at a time.
  PERFORM pg_advisory_xact_lock(hashtext('seal_score_archive_days'));

  SELECT g.day + 1, g.chain_sha256 INTO d, prev
  FROM score_archive_digests g ORDER BY g.day DESC LIMIT 1;

  IF d IS NULL THEN
    SELECT (min(recorded_at) AT TIME ZONE 'UTC')::date INTO d FROM score_archive;
  END IF;
  IF d IS NULL THEN
    RETURN;
  END IF;

  WHILE d < cutoff LOOP
    SELECT count(*)::integer,
           encode(sha256(convert_to(coalesce(string_agg(s.row_sha256, E'\n' ORDER BY s.recorded_at, s.id), ''), 'UTF8')), 'hex')
      INTO n, day_hash
    FROM score_archive s
    WHERE s.recorded_at >= (d::timestamp AT TIME ZONE 'UTC')
      AND s.recorded_at <  ((d + 1)::timestamp AT TIME ZONE 'UTC');

    chain := encode(sha256(convert_to(coalesce(prev, '') || day_hash, 'UTF8')), 'hex');

    INSERT INTO score_archive_digests (day, row_count, day_sha256, prev_sha256, chain_sha256)
    VALUES (d, n, day_hash, prev, chain);

    day := d; row_count := n; chain_sha256 := chain;
    RETURN NEXT;

    prev := chain;
    d := d + 1;
  END LOOP;
END;
$$;

-- Recomputes row hashes and day digests for sealed days in [from_day, to_day]
-- and returns every mismatch. Empty result = intact.
CREATE OR REPLACE FUNCTION verify_score_archive(from_day date DEFAULT NULL, to_day date DEFAULT NULL)
RETURNS TABLE (day date, problem text, detail text)
LANGUAGE plpgsql STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  g        record;
  n        integer;
  day_hash text;
  prev     text := NULL;
  first    boolean := true;
BEGIN
  FOR g IN
    SELECT * FROM score_archive_digests x
    WHERE (from_day IS NULL OR x.day >= from_day) AND (to_day IS NULL OR x.day <= to_day)
    ORDER BY x.day
  LOOP
    -- Rows whose stored hash no longer matches their content.
    RETURN QUERY
      SELECT g.day, 'row_hash_mismatch'::text, s.id::text
      FROM score_archive s
      WHERE s.recorded_at >= (g.day::timestamp AT TIME ZONE 'UTC')
        AND s.recorded_at <  ((g.day + 1)::timestamp AT TIME ZONE 'UTC')
        AND s.row_sha256 IS DISTINCT FROM score_archive_row_sha256(s);

    SELECT count(*)::integer,
           encode(sha256(convert_to(coalesce(string_agg(s.row_sha256, E'\n' ORDER BY s.recorded_at, s.id), ''), 'UTF8')), 'hex')
      INTO n, day_hash
    FROM score_archive s
    WHERE s.recorded_at >= (g.day::timestamp AT TIME ZONE 'UTC')
      AND s.recorded_at <  ((g.day + 1)::timestamp AT TIME ZONE 'UTC');

    IF n <> g.row_count THEN
      day := g.day; problem := 'row_count_mismatch'; detail := format('sealed %s, now %s', g.row_count, n); RETURN NEXT;
    END IF;
    IF day_hash <> g.day_sha256 THEN
      day := g.day; problem := 'day_hash_mismatch'; detail := day_hash; RETURN NEXT;
    END IF;
    IF NOT first AND g.prev_sha256 IS DISTINCT FROM prev THEN
      day := g.day; problem := 'chain_break'; detail := format('prev_sha256 %s, previous chain %s', g.prev_sha256, prev); RETURN NEXT;
    END IF;
    IF g.chain_sha256 <> encode(sha256(convert_to(coalesce(g.prev_sha256, '') || g.day_sha256, 'UTF8')), 'hex') THEN
      day := g.day; problem := 'chain_hash_mismatch'; detail := g.chain_sha256; RETURN NEXT;
    END IF;

    prev := g.chain_sha256;
    first := false;
  END LOOP;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Automatic copies of the outcome ledger
-- ══════════════════════════════════════════════════════════════════════
-- Every predictions insert and status change, and every outcomes insert and
-- status change, is appended here whatever code path wrote it. Failures are
-- downgraded to a WARNING so the ledger write itself never fails.

CREATE OR REPLACE FUNCTION archive_prediction_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  confidential boolean := NEW.source IN ('calculator', 'brief', 'share');
  hash_name    text;
  profile      jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  profile := jsonb_build_object(
    'licensor', CASE WHEN confidential THEN NULL ELSE NEW.licensor_name END,
    'licensor_sha256', CASE WHEN NEW.licensor_name IS NULL THEN NULL
                            ELSE encode(sha256(convert_to(lower(trim(NEW.licensor_name)), 'UTF8')), 'hex') END,
    'asset', CASE WHEN confidential THEN NULL ELSE NEW.asset_name END,
    'asset_sha256', CASE WHEN NEW.asset_name IS NULL THEN NULL
                         ELSE encode(sha256(convert_to(lower(trim(NEW.asset_name)), 'UTF8')), 'hex') END,
    'company_id', NEW.company_id,
    'asset_id', NEW.asset_id,
    'indication', NEW.indication,
    'therapeutic_area', NEW.therapeutic_area,
    'phase', NEW.phase,
    'modality', NEW.modality,
    'deal_type', NEW.deal_type,
    'territory', NEW.territory,
    'fingerprint', NEW.fingerprint
  );
  hash_name := encode(sha256(convert_to(profile::text, 'UTF8')), 'hex');

  INSERT INTO score_archive (
    product, score_type, model_version, origin,
    entity_type, entity_id, entity_label,
    therapeutic_area, phase, modality, indication,
    source_table, source_id, prediction_id,
    inputs, inputs_sha256, output, data_as_of, horizon_end
  ) VALUES (
    'solidus',
    CASE WHEN TG_OP = 'INSERT' THEN 'ledger.' || NEW.source ELSE 'ledger.' || NEW.source || '.' || NEW.status END,
    COALESCE(NEW.model_version, 'unknown'),
    CASE WHEN NEW.user_id IS NULL THEN 'platform' ELSE 'user' END,
    CASE WHEN NEW.asset_id IS NOT NULL THEN 'asset' WHEN NEW.company_id IS NOT NULL AND NOT confidential THEN 'company' ELSE 'prediction' END,
    COALESCE(NEW.asset_id::text, CASE WHEN confidential THEN NEW.id::text ELSE COALESCE(NEW.company_id::text, NEW.id::text) END),
    CASE WHEN confidential THEN NULL ELSE COALESCE(NEW.asset_name, NEW.licensor_name) END,
    NEW.therapeutic_area, NEW.phase, NEW.modality, NEW.indication,
    'predictions', NEW.id::text, NEW.id,
    CASE WHEN confidential THEN NULL ELSE profile END,
    hash_name,
    jsonb_build_object(
      'status', NEW.status,
      'upfront_low', NEW.upfront_low, 'upfront_mid', NEW.upfront_mid, 'upfront_high', NEW.upfront_high,
      'total_low', NEW.total_low, 'total_mid', NEW.total_mid, 'total_high', NEW.total_high,
      'royalty_low', NEW.royalty_low, 'royalty_high', NEW.royalty_high,
      'predicted_buyers', to_jsonb(NEW.predicted_buyers),
      'predicted_window_start', NEW.predicted_window_start,
      'predicted_window_end', NEW.predicted_window_end,
      'resolve_after', score_archive_utc_text(NEW.resolve_after),
      'created_at', score_archive_utc_text(NEW.created_at)
    ),
    NEW.priors_as_of,
    NEW.predicted_window_end
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[score_archive] prediction % not archived: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION archive_outcome_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO score_archive (
    product, score_type, model_version, origin,
    entity_type, entity_id,
    source_table, source_id, prediction_id,
    inputs, output
  ) VALUES (
    'solidus',
    'outcome.' || NEW.status,
    'outcome-ledger',
    CASE WHEN NEW.matched_by = 'client' THEN 'client' WHEN NEW.matched_by = 'manual' THEN 'user' ELSE 'platform' END,
    CASE WHEN NEW.deal_id IS NOT NULL THEN 'deal' ELSE 'prediction' END,
    COALESCE(NEW.deal_id::text, NEW.prediction_id::text),
    'outcomes', NEW.id::text, NEW.prediction_id,
    jsonb_build_object('matched_by', NEW.matched_by, 'match_confidence', NEW.match_confidence, 'match_evidence', NEW.match_evidence),
    jsonb_build_object(
      'status', NEW.status,
      'deal_id', NEW.deal_id,
      'upfront_m', NEW.upfront_m, 'total_m', NEW.total_m,
      'royalty_low', NEW.royalty_low, 'royalty_high', NEW.royalty_high,
      'licensee_id', NEW.licensee_id,
      'signed_date', NEW.signed_date,
      'deal_type', NEW.deal_type,
      'abs_pct_error_upfront', NEW.abs_pct_error_upfront,
      'abs_pct_error_total', NEW.abs_pct_error_total,
      'within_band_upfront', NEW.within_band_upfront,
      'within_band_total', NEW.within_band_total,
      'buyer_hit', NEW.buyer_hit,
      'window_hit', NEW.window_hit,
      'value_captured_m', NEW.value_captured_m,
      'resolved_at', score_archive_utc_text(NEW.resolved_at)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[score_archive] outcome % not archived: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_predictions_score_archive ON predictions;
CREATE TRIGGER trg_predictions_score_archive
  AFTER INSERT OR UPDATE OF status ON predictions
  FOR EACH ROW EXECUTE FUNCTION archive_prediction_row();

DROP TRIGGER IF EXISTS trg_outcomes_score_archive ON outcomes;
CREATE TRIGGER trg_outcomes_score_archive
  AFTER INSERT OR UPDATE OF status ON outcomes
  FOR EACH ROW EXECUTE FUNCTION archive_outcome_row();

-- ══════════════════════════════════════════════════════════════════════
-- 5. Grants and RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE score_archive         ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_archive_digests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON score_archive, score_archive_digests FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON score_archive, score_archive_digests FROM service_role;
GRANT SELECT, INSERT ON score_archive, score_archive_digests TO service_role;

DROP POLICY IF EXISTS "Service role insert score_archive" ON score_archive;
CREATE POLICY "Service role insert score_archive"
  ON score_archive FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role read score_archive" ON score_archive;
CREATE POLICY "Service role read score_archive"
  ON score_archive FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role insert score_archive_digests" ON score_archive_digests;
CREATE POLICY "Service role insert score_archive_digests"
  ON score_archive_digests FOR INSERT TO service_role WITH CHECK (true);
DROP POLICY IF EXISTS "Service role read score_archive_digests" ON score_archive_digests;
CREATE POLICY "Service role read score_archive_digests"
  ON score_archive_digests FOR SELECT TO service_role USING (true);

REVOKE ALL ON FUNCTION seal_score_archive_days() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION verify_score_archive(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION archive_prediction_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION archive_outcome_row() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION seal_score_archive_days() TO service_role;
GRANT EXECUTE ON FUNCTION verify_score_archive(date, date) TO service_role;

COMMIT;
