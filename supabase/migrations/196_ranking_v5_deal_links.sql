-- 196: ranking v5 measurement + deal ledger recall.
--
-- 1. radar_score_backtests gains the honest top-of-list numbers. Backtests up to v4 pooled every
--    test month and every owner type: "precision@100" was the top 100 (asset, month) rows of nine
--    months mixed together, academic and hospital programs padded the negatives (AUC 0.82-0.88 on
--    that pool vs 0.73 on industry programs alone), and the scorecard divided a sampling-weighted
--    precision by an unweighted base rate (positives_test / n_test = 1.34 % vs 0.27 % weighted).
--    Protocol 'feed_monthly_v1' (lib/radar/backtest/run.ts) scores only what the feed shows
--    (industry owner, program primary row, not approved), ranks within each as-of month and
--    averages: base_rate and lift_at_100 are stored so the scorecard needs no re-derivation.
--
-- 2. radar_link_deals() links a deal to a program through four tiers, first hit wins per deal:
--      program_identifier  licensor family holds a program whose name carries the identifier
--                          (all identifiers in all row names, not only the program key token)
--      drug_alias          licensor family holds the drug under another name (drug_aliases:
--                          ervogastat = PF-06865571, lorundrostat = MT-4129)
--      licensee_program    the licensee family runs the program (HPP737 at Newsoara, ORKA-001 at
--                          Oruka): the deal names that program; partnership.ts ignores in-licensed
--                          rows, so this never marks the licensee's program as partnered out
--      unique_identifier   exactly one industry family holds the identifier and the licensor
--                          family does not (CN/EN twins and renames: Genhouse = 勤浩医药, LegoChem =
--                          LigaChem, duplicate Hanmi rows); INN-only matches skip approved products
--    Tiers 2-4 ignore ADC payload / cell-therapy suffix words (deruxtecan, vedotin, autotemcel ...)
--    and radioisotope tokens (AC225, PB212), which name many drugs.
--    Deal-only programs (method deal_created) are created for any phase now, not only preclinical,
--    when no company holds the identifier under any name, for licensors of type industry or unknown,
--    up to three code-shaped identifiers per deal.
--    Measured Nov 23 2026 on the 108 verified named deals of the last 12 months: 60 linked before;
--    tiers 1-4 reach 86, deal-only programs add up to 11 (97 / 108). All deals: 379 -> ~714 of 856.
--
-- 3. radar_qa_scorecard_stats(): forward test and deal recall read the ledger (radar_deal_program_links)
--    as well as clinical_assets.deal_ids; deal recall counts verified deals only (rejected / flagged
--    deals are never linked, so counting them capped recall at 86 %); the forward test ranks the
--    licensed program's best row against the same day's scored feed rows.
--
-- Idempotent. Functions are safe-update clean (every UPDATE / DELETE has a WHERE).

ALTER TABLE public.radar_score_backtests
  ADD COLUMN IF NOT EXISTS base_rate     numeric,
  ADD COLUMN IF NOT EXISTS lift_at_100   numeric,
  ADD COLUMN IF NOT EXISTS eval_protocol text,
  ADD COLUMN IF NOT EXISTS metrics       jsonb;

COMMENT ON COLUMN public.radar_score_backtests.base_rate IS
  'Sampling-weighted positive rate of the evaluated population (mean over test months for feed_monthly_v1).';
COMMENT ON COLUMN public.radar_score_backtests.lift_at_100 IS
  'precision_at_100 / base_rate on the same population (migration 196).';
COMMENT ON COLUMN public.radar_score_backtests.eval_protocol IS
  'NULL = pooled v3/v4 protocol (all owners, all test months pooled); feed_monthly_v1 = feed population ranked per month.';

ALTER TABLE public.radar_deal_program_links DROP CONSTRAINT IF EXISTS radar_deal_program_links_method_check;
ALTER TABLE public.radar_deal_program_links ADD CONSTRAINT radar_deal_program_links_method_check
  CHECK (method IN ('program_identifier', 'drug_alias', 'licensee_program', 'unique_identifier', 'deal_created'));

CREATE OR REPLACE FUNCTION public.radar_link_deals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_t1 integer := 0;
  v_t2 integer := 0;
  v_t3 integer := 0;
  v_t4 integer := 0;
  v_created integer := 0;
  -- Words that name many drugs: ADC payloads, cell / gene therapy suffixes, PEG, radioisotopes.
  c_generic text := '(TECAN|DOTIN|TANSINE|TESIRINE|OZOGAMICIN|TEMCEL|LEUCEL|PEGOL)$|^(AC225|PB212|PB203|LU177|GA68|CU64|CU67|ZR89|TB161|RA223|TH227|AT211|IN111|Y90|I131|I124|I125|F18|TC99M?)$';
BEGIN
  DROP TABLE IF EXISTS tmp_dl_deals;
  CREATE TEMP TABLE tmp_dl_deals ON COMMIT DROP AS
  SELECT d.id, d.licensor_id,
         coalesce(lc.family_id, d.licensor_id) AS licensor_family,
         coalesce(ec.family_id, d.licensee_id) AS licensee_family,
         lc.owner_type AS licensor_owner, lc.merged_into AS licensor_merged, lc.name AS licensor_company,
         d.asset_name, d.announced_date, d.source_url, d.press_release_url,
         d.phase_at_signing, d.modality, d.therapeutic_area, d.indication_specific, d.target,
         coalesce(nullif(d.raw_text_excerpt, ''), nullif(d.asset_description, ''), d.asset_name) AS excerpt,
         public.radar_asset_identifiers(d.asset_name) AS ids
  FROM public.deals d
  LEFT JOIN public.companies lc ON lc.id = d.licensor_id
  LEFT JOIN public.companies ec ON ec.id = d.licensee_id
  WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
    AND lower(coalesce(d.verification_status, '')) NOT IN ('rejected', 'flagged')
    AND d.deal_type IN ('license', 'option', 'collaboration')
    AND d.licensor_id IS NOT NULL;
  DELETE FROM tmp_dl_deals WHERE cardinality(ids) = 0;

  DROP TABLE IF EXISTS tmp_dl_tok;
  CREATE TEMP TABLE tmp_dl_tok ON COMMIT DROP AS
  SELECT DISTINCT d.id, t.tok, (t.tok ~ c_generic) AS generic
  FROM tmp_dl_deals d CROSS JOIN LATERAL unnest(d.ids) AS t(tok);
  CREATE INDEX ON tmp_dl_tok (tok);

  -- Every identifier in every keyed row's name, mapped to the row's program.
  DROP TABLE IF EXISTS tmp_dl_pid;
  CREATE TEMP TABLE tmp_dl_pid ON COMMIT DROP AS
  SELECT DISTINCT a.program_key, a.company_id, coalesce(c.family_id, a.company_id) AS family_key,
         coalesce(c.owner_type, 'unknown') AS owner_type, t.tok
  FROM public.clinical_assets a
  LEFT JOIN public.companies c ON c.id = a.company_id
  CROSS JOIN LATERAL unnest(public.radar_asset_identifiers(a.asset_name)) AS t(tok)
  WHERE a.company_id IS NOT NULL AND a.program_key IS NOT NULL;
  CREATE INDEX ON tmp_dl_pid (tok);
  CREATE INDEX ON tmp_dl_pid (family_key, tok);

  -- Deal identifiers that resolve through drug_aliases to a drug some program is on.
  DROP TABLE IF EXISTS tmp_dl_alias;
  CREATE TEMP TABLE tmp_dl_alias ON COMMIT DROP AS
  SELECT DISTINCT t.tok, a.program_key, a.company_id, coalesce(c.family_id, a.company_id) AS family_key
  FROM (SELECT DISTINCT tok FROM tmp_dl_tok WHERE NOT generic) t
  JOIN public.drug_aliases da ON da.alias_normalized = lower(t.tok)
  JOIN public.clinical_assets a ON a.drug_master_id = da.drug_id AND a.program_key IS NOT NULL AND a.company_id IS NOT NULL
  LEFT JOIN public.companies c ON c.id = a.company_id;
  CREATE INDEX ON tmp_dl_alias (tok);

  -- Re-key existing links whose program was regrouped (same as migration 193e).
  DROP TABLE IF EXISTS tmp_dl_rekey;
  CREATE TEMP TABLE tmp_dl_rekey ON COMMIT DROP AS
  SELECT DISTINCT ON (l2.id) l2.id, l2.deal_id, l2.program_key AS old_key, a.program_key AS new_key
  FROM public.radar_deal_program_links l2
  JOIN public.clinical_assets a
    ON a.company_id = l2.company_id AND a.program_key IS NOT NULL
   AND (a.program_key = l2.program_key
        OR a.deal_ids @> ARRAY[l2.deal_id]
        OR public.radar_asset_identifiers(a.asset_name) @> ARRAY[l2.identifier])
  ORDER BY l2.id, (a.program_key = l2.program_key) DESC, a.program_primary DESC;

  DELETE FROM public.radar_deal_program_links l
  USING (SELECT id, row_number() OVER (PARTITION BY deal_id, new_key ORDER BY (old_key = new_key) DESC, id) AS rn
         FROM tmp_dl_rekey) d
  WHERE l.id = d.id AND d.rn > 1;

  UPDATE public.radar_deal_program_links l
     SET program_key = r.new_key
    FROM tmp_dl_rekey r
   WHERE l.id = r.id AND r.old_key <> r.new_key
     AND NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links o
                     WHERE o.deal_id = l.deal_id AND o.program_key = r.new_key AND o.id <> l.id);

  DROP TABLE IF EXISTS tmp_dl_new;
  CREATE TEMP TABLE tmp_dl_new (program_key text) ON COMMIT DROP;

  -- Candidate links per tier.
  DROP TABLE IF EXISTS tmp_dl_hit;
  CREATE TEMP TABLE tmp_dl_hit ON COMMIT DROP AS
  WITH dt AS (SELECT d.id, d.licensor_id, d.licensor_family, d.licensee_family, d.phase_at_signing, t.tok, t.generic
              FROM tmp_dl_deals d JOIN tmp_dl_tok t ON t.id = d.id),
  holders AS (SELECT tok, count(DISTINCT family_key) AS fams FROM tmp_dl_pid WHERE owner_type = 'industry' GROUP BY tok)
  SELECT dt.id, p.program_key, p.company_id, dt.tok, 1 AS tier, 'program_identifier'::text AS method, (p.company_id = dt.licensor_id) AS own_row
  FROM dt JOIN tmp_dl_pid p ON p.family_key = dt.licensor_family AND p.tok = dt.tok
  UNION ALL
  SELECT dt.id, p.program_key, p.company_id, dt.tok, 2, 'drug_alias', (p.company_id = dt.licensor_id)
  FROM dt JOIN tmp_dl_alias p ON p.family_key = dt.licensor_family AND p.tok = dt.tok
  WHERE NOT dt.generic
  UNION ALL
  SELECT dt.id, p.program_key, p.company_id, dt.tok, 3, 'licensee_program', false
  FROM dt JOIN (SELECT program_key, company_id, family_key, tok FROM tmp_dl_pid
                UNION SELECT program_key, company_id, family_key, tok FROM tmp_dl_alias) p
    ON p.family_key = dt.licensee_family AND p.tok = dt.tok
  WHERE NOT dt.generic AND dt.licensee_family IS NOT NULL AND dt.licensee_family <> dt.licensor_family
  UNION ALL
  SELECT dt.id, p.program_key, p.company_id, dt.tok, 4, 'unique_identifier', false
  FROM dt
  JOIN holders h ON h.tok = dt.tok AND h.fams = 1
  JOIN tmp_dl_pid p ON p.tok = dt.tok AND p.owner_type = 'industry'
  WHERE NOT dt.generic
    AND (dt.tok ~ '[0-9]' OR coalesce(dt.phase_at_signing, '') <> 'approved');

  -- First tier per deal wins; within it, prefer the licensor's own row.
  WITH best AS (SELECT id, min(tier) AS tier FROM tmp_dl_hit GROUP BY id),
  ins AS (
    INSERT INTO public.radar_deal_program_links (deal_id, company_id, program_key, identifier, method)
    SELECT DISTINCT ON (h.id, h.program_key) h.id, h.company_id, h.program_key, h.tok, h.method
    FROM tmp_dl_hit h JOIN best b ON b.id = h.id AND b.tier = h.tier
    -- A fallback tier never adds to a deal the ledger already links (links are never removed here).
    WHERE h.tier = 1 OR NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links l WHERE l.deal_id = h.id)
    ORDER BY h.id, h.program_key, h.own_row DESC, h.company_id
    ON CONFLICT (deal_id, program_key) DO NOTHING
    RETURNING program_key, method
  ),
  noted AS (INSERT INTO tmp_dl_new SELECT program_key FROM ins RETURNING 1)
  SELECT count(*) FILTER (WHERE method = 'program_identifier'),
         count(*) FILTER (WHERE method = 'drug_alias'),
         count(*) FILTER (WHERE method = 'licensee_program'),
         count(*) FILTER (WHERE method = 'unique_identifier')
    INTO v_t1, v_t2, v_t3, v_t4
  FROM ins;

  -- Deal-only programs: no company holds any of the deal's identifiers under any name.
  WITH candidates AS (
    SELECT d.*, t.tok
    FROM tmp_dl_deals d
    JOIN tmp_dl_tok t ON t.id = d.id AND NOT t.generic
    WHERE coalesce(d.licensor_owner, 'unknown') IN ('industry', 'unknown')
      AND d.licensor_merged IS NULL
      AND cardinality(d.ids) <= 3
      AND (cardinality(d.ids) = 1 OR t.tok ~ '[0-9]')
      AND coalesce(d.source_url, d.press_release_url) ~ '^https?://'
      AND d.announced_date IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tmp_dl_hit h WHERE h.id = d.id)
      AND NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links l WHERE l.deal_id = d.id)
      -- Join through tmp_dl_tok so the tok indexes are used (= ANY (array) scans the whole table).
      AND NOT EXISTS (SELECT 1 FROM tmp_dl_tok t2 JOIN tmp_dl_pid p ON p.tok = t2.tok WHERE t2.id = d.id)
      AND NOT EXISTS (SELECT 1 FROM tmp_dl_tok t2 JOIN tmp_dl_alias p ON p.tok = t2.tok WHERE t2.id = d.id)
  ),
  created AS (
    INSERT INTO public.clinical_assets (
      company_id, company_name, asset_name, asset_origin, phase, modality, therapeutic_area,
      indication_specific, target, deal_ids, disclosure_source_type, disclosure_url, disclosure_date,
      disclosure_excerpt, classification_status, ownership_status, ownership_evidence, confidence_score)
    SELECT DISTINCT ON (c.licensor_id, c.tok)
           c.licensor_id, c.licensor_company,
           CASE WHEN cardinality(c.ids) = 1 THEN btrim(c.asset_name) ELSE c.tok END,
           'deal',
           CASE c.phase_at_signing
             WHEN 'discovery' THEN 'preclinical' WHEN 'preclinical' THEN 'preclinical'
             WHEN 'phase_1' THEN 'phase_1' WHEN 'phase_2' THEN 'phase_2' WHEN 'phase_3' THEN 'phase_3'
             WHEN 'approved' THEN 'phase_4' ELSE 'unknown' END,
           c.modality, c.therapeutic_area, c.indication_specific, c.target,
           ARRAY[c.id], 'deal', coalesce(c.source_url, c.press_release_url), c.announced_date,
           left(c.excerpt, 1000), 'unclassified', 'unknown',
           jsonb_build_object('rule', 'deal_licensor', 'deal_id', c.id),
           45
    FROM candidates c
    WHERE c.licensor_company IS NOT NULL
    ORDER BY c.licensor_id, c.tok, c.announced_date DESC
    ON CONFLICT (company_name, asset_name) DO NOTHING
    RETURNING id, company_id, asset_name, deal_ids
  )
  INSERT INTO public.radar_deal_program_links (deal_id, company_id, program_key, identifier, method)
  SELECT c.deal_ids[1], c.company_id, c.company_id::text || ':t:' || (public.radar_asset_identifiers(c.asset_name))[1],
         (public.radar_asset_identifiers(c.asset_name))[1], 'deal_created'
  FROM created c
  WHERE cardinality(public.radar_asset_identifiers(c.asset_name)) > 0
  ON CONFLICT (deal_id, program_key) DO NOTHING;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  -- Re-check partnership on the programs that just gained a deal (next refresh run takes them as backlog).
  UPDATE public.clinical_assets a
     SET partnership_checked_at = NULL
   WHERE a.program_key IN (SELECT program_key FROM tmp_dl_new)
     AND a.partnership_checked_at IS NOT NULL;

  RETURN jsonb_build_object(
    'linked_existing', v_t1 + v_t2 + v_t3 + v_t4,
    'program_identifier', v_t1, 'drug_alias', v_t2, 'licensee_program', v_t3, 'unique_identifier', v_t4,
    'programs_created', v_created);
END;
$function$;

CREATE OR REPLACE FUNCTION public.radar_qa_scorecard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_out jsonb;
  v_signal_cos integer := 0;
  v_feed_cos integer := 0;
  v_has_financing boolean := to_regclass('public.company_financing_events') IS NOT NULL;
BEGIN
  -- The default feed: industry programs, one row per program, hidden ownership/phase states excluded.
  CREATE TEMP TABLE IF NOT EXISTS tmp_sc_feed ON COMMIT DROP AS
  SELECT a.id, a.company_id, coalesce(fc.family_id, a.company_id) AS family_key,
         a.drug_master_id, a.program_name, a.asset_name, a.ownership_status,
         a.partnership_basis, a.classification_status, a.therapeutic_area, a.originator_region,
         a.nct_ids, a.disclosure_url, a.score_rank
  FROM public.clinical_assets a
  LEFT JOIN public.companies fc ON fc.id = a.company_id
  WHERE a.program_primary AND a.owner_type = 'industry'
    AND a.phase NOT IN ('phase_4', 'not_applicable', 'unknown')
    AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program');

  SELECT count(DISTINCT company_id) INTO v_feed_cos FROM tmp_sc_feed;

  EXECUTE format($q$
    SELECT count(DISTINCT f.company_id) FROM tmp_sc_feed f
    WHERE EXISTS (SELECT 1 FROM public.company_financials x WHERE x.company_id = f.company_id)
       OR EXISTS (SELECT 1 FROM public.company_intent_signals x WHERE x.company_id = f.company_id)
       %s
  $q$, CASE WHEN v_has_financing
            THEN 'OR EXISTS (SELECT 1 FROM public.company_financing_events x WHERE x.company_id = f.company_id)'
            ELSE '' END)
  INTO v_signal_cos;

  WITH top1k AS (SELECT * FROM tmp_sc_feed ORDER BY score_rank DESC NULLS LAST, id DESC LIMIT 1000),
  top500 AS (SELECT * FROM top1k ORDER BY score_rank DESC NULLS LAST, id DESC LIMIT 500),
  bt AS (
    SELECT b.* FROM public.radar_score_backtests b
    JOIN public.radar_score_models m ON m.version = b.model_version AND m.is_active
    ORDER BY b.created_at DESC LIMIT 1
  ),
  deals12 AS (
    SELECT d.id FROM public.deals d
    WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
      -- Rejected / flagged deals are never linked (radar_link_deals); counting them capped recall (migration 196).
      AND lower(coalesce(d.verification_status, '')) NOT IN ('rejected', 'flagged')
      AND d.announced_date >= current_date - 365
      AND d.deal_type IN ('license', 'option', 'collaboration')
      -- Only deals that name a drug can link to a program (platform and undisclosed-target deals cannot).
      AND cardinality(public.radar_asset_identifiers(d.asset_name)) > 0
  ),
  -- Forward check (migration 196): programs licensed in the last 180 days, found through the deal
  -- ledger or clinical_assets.deal_ids, and their best row's standing on the latest scored day at
  -- least 14 days before the deal, ranked against that day's scored feed rows.
  fwd_links AS (
    SELECT DISTINCT d.id AS deal_id, d.announced_date, x.program_key
    FROM public.deals d
    JOIN LATERAL (
      SELECT l.program_key FROM public.radar_deal_program_links l WHERE l.deal_id = d.id
      UNION
      SELECT a.program_key FROM public.clinical_assets a WHERE a.deal_ids @> ARRAY[d.id] AND a.program_key IS NOT NULL
    ) x ON true
    WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
      AND lower(coalesce(d.verification_status, '')) NOT IN ('rejected', 'flagged')
      AND d.announced_date >= current_date - 180
      AND d.deal_type IN ('license', 'option', 'collaboration')
  ),
  fwd AS (
    SELECT DISTINCT ON (f.deal_id, f.program_key) f.deal_id, f.program_key, s.snapshot_date, s.logit
    FROM fwd_links f
    JOIN public.clinical_assets a ON a.program_key = f.program_key
    JOIN LATERAL (
      SELECT s.snapshot_date, s.logit FROM public.asset_signal_snapshots s
      WHERE s.asset_id = a.id AND s.snapshot_date <= f.announced_date - 14 AND s.logit IS NOT NULL
      ORDER BY s.snapshot_date DESC LIMIT 1
    ) s ON true
    ORDER BY f.deal_id, f.program_key, s.snapshot_date DESC, s.logit DESC
  ),
  fwd_pct AS (
    SELECT f.deal_id, f.program_key,
           (SELECT count(*) FROM public.asset_signal_snapshots s2
              JOIN public.clinical_assets a2 ON a2.id = s2.asset_id AND a2.program_primary AND a2.owner_type = 'industry'
             WHERE s2.snapshot_date = f.snapshot_date AND s2.logit > f.logit)::numeric
           / NULLIF((SELECT count(*) FROM public.asset_signal_snapshots s3
              JOIN public.clinical_assets a3 ON a3.id = s3.asset_id AND a3.program_primary AND a3.owner_type = 'industry'
             WHERE s3.snapshot_date = f.snapshot_date AND s3.logit IS NOT NULL), 0) AS frac_above
    FROM fwd f
  ),
  audits AS (
    SELECT field, count(*) AS n, avg(agrees::int) AS share
    FROM public.radar_qa_human_reviews
    WHERE field IN ('owner', 'availability', 'duplicate') AND reviewed_at >= now() - interval '60 days' AND agrees IS NOT NULL
    GROUP BY field
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'universe_programs', (SELECT count(*) FROM public.clinical_assets WHERE program_primary),
    'feed_programs', (SELECT count(*) FROM tmp_sc_feed),
    'feed_companies', v_feed_cos,
    -- accuracy
    'top500_originator_share', (SELECT avg((ownership_status = 'originator')::int) FROM top500),
    'top1k_duplicates', (SELECT (count(*) - count(DISTINCT coalesce(drug_master_id::text, id::text)))
                              -- same name within one corporate family (migration 193)
                              + (count(*) - count(DISTINCT family_key::text || lower(coalesce(program_name, asset_name)))) FROM top1k),
    'top1k_n', (SELECT count(*) FROM top1k),
    'feed_drug_resolved_share', (SELECT avg((drug_master_id IS NOT NULL)::int) FROM tmp_sc_feed),
    'audit_owner_n', coalesce((SELECT n FROM audits WHERE field = 'owner'), 0),
    'audit_owner_share', (SELECT share FROM audits WHERE field = 'owner'),
    'audit_availability_n', coalesce((SELECT n FROM audits WHERE field = 'availability'), 0),
    'audit_availability_share', (SELECT share FROM audits WHERE field = 'availability'),
    'audit_duplicate_n', coalesce((SELECT n FROM audits WHERE field = 'duplicate'), 0),
    'audit_duplicate_share', (SELECT share FROM audits WHERE field = 'duplicate'),
    -- ranking
    'backtest_model_version', (SELECT model_version FROM bt),
    'backtest_roc_auc', (SELECT roc_auc FROM bt),
    'backtest_precision_at_100', (SELECT precision_at_100 FROM bt),
    -- base_rate / lift_at_100 are stored by feed-protocol backtests (migration 196); older rows fall
    -- back to the unweighted share, which overstates the base rate of a subsampled test set.
    'backtest_base_rate', (SELECT coalesce(base_rate, positives_test::numeric / NULLIF(n_test, 0)) FROM bt),
    'backtest_lift_at_100', (SELECT lift_at_100 FROM bt),
    'backtest_eval_protocol', (SELECT eval_protocol FROM bt),
    'backtest_lift_top_decile', (SELECT lift_top_decile FROM bt),
    'forward_n', (SELECT count(*) FROM fwd_pct WHERE frac_above IS NOT NULL),
    'forward_top_decile_share', (SELECT avg((frac_above < 0.10)::int) FROM fwd_pct WHERE frac_above IS NOT NULL),
    'forward_linked_programs_180d', (SELECT count(*) FROM fwd_links),
    'forward_first_scored_day', (SELECT min(snapshot_date) FROM public.asset_signal_snapshots WHERE logit IS NOT NULL),
    -- coverage
    'deals_12m', (SELECT count(*) FROM deals12),
    'deals_12m_all', (SELECT count(*) FROM public.deals d WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
                      AND d.announced_date >= current_date - 365 AND d.deal_type IN ('license', 'option', 'collaboration')),
    'deals_12m_linked', (SELECT count(*) FROM deals12 d
                         WHERE EXISTS (SELECT 1 FROM public.radar_deal_program_links l WHERE l.deal_id = d.id)
                            OR EXISTS (SELECT 1 FROM public.clinical_assets a WHERE a.deal_ids @> ARRAY[d.id])),
    'feed_classified_share', (SELECT avg((classification_status = 'classified')::int) FROM tmp_sc_feed),
    'feed_ta_share', (SELECT avg((therapeutic_area IS NOT NULL)::int) FROM tmp_sc_feed),
    'feed_region_share', (SELECT avg((originator_region IS NOT NULL)::int) FROM tmp_sc_feed),
    -- signals
    'signal_companies', v_signal_cos,
    -- freshness
    'hours_since_classify_ok', (SELECT extract(epoch FROM now() - max(completed_at)) / 3600 FROM public.data_ingestion_log
                                WHERE source = 'asset_universe' AND parameters->>'stage' = 'classify' AND status = 'completed'),
    'failed_runs_48h', (SELECT count(*) FROM public.data_ingestion_log WHERE started_at > now() - interval '48 hours' AND status = 'failed'),
    -- evidence
    'top500_sourced_share', (SELECT avg((cardinality(coalesce(nct_ids, '{}')) > 0 OR disclosure_url IS NOT NULL)::int) FROM top500),
    'top500_partnership_checked_share', (SELECT avg((partnership_basis IS NOT NULL)::int) FROM top500)
  ) INTO v_out;

  DROP TABLE IF EXISTS tmp_sc_feed;
  RETURN v_out;
END;
$function$;
