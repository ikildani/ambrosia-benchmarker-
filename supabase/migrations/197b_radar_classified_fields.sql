-- 197b: classifier answers stop disappearing; therapeutic area for the rows the model leaves empty.
--
-- Why (measured Nov 23 2026): the registry re-index (lib/radar/asset-universe.ts) upserts every
-- program it re-reads with its own keyword guesses for therapeutic_area, modality, indication_category
-- and indication_specific, so each re-index overwrote what the classifier had written, mostly with
-- NULL. Universe-wide, classified rows whose evidence records a written value but whose column now
-- differs: therapeutic_area 6,903 NULL + 1,973 changed, modality 4,183 + 3,998, indication_category
-- 6,898 + 3,327, indication_specific 21,612 + 6,009. In the default feed this alone is 3,184 of the
-- 6,979 programs without a therapeutic area (feed TA share 82.4%).
--
--   1. trg_keep_classified_fields: on a classified row, an update that is not a re-classification
--      (classified_at unchanged) may fill these four columns but not overwrite or clear them.
--      SET radar.classification_override = 'on' for a deliberate correction.
--   2. One-off restore of the classifier's values from classification_evidence where a re-index
--      came after the classification.
--   3. radar_infer_ta(): rule-based therapeutic area, no model spend, labelled in
--      therapeutic_area_source: the program's trial conditions (keyword vote, migration 166),
--      its own indication text, the drug's other programs (>= 60% agreement), then its name /
--      mechanism. Dry run on the feed after the restore: conditions 539, indication text and
--      name 705, drug siblings 429; ~2,100 left, mostly healthy-volunteer Phase 1 rows the model
--      parked at confidence < 40 and non-drug arm text.
--   4. Skipped rows in the feed: the name rules skip any 8+ word name without a code as "generic",
--      which also skipped descriptive programs ("human IgG4 bispecific antibody recognizing factor
--      VIIa and TLT-1", "SHP2 inhibitor", CAR-T descriptions; 1,222 feed rows marked
--      placebo_or_generic). Generic bioequivalence arms ("Intervention group: ... single oral dose")
--      and devices / procedures leave the feed as not_a_program; every other skipped feed row goes
--      back to the classifier queue flagged rule_skip_overridden, which classify.ts honours.
-- Apply after 197. Idempotent.

-- ── 1. Keep classifier values ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.radar_keep_classified_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.classification_status = 'classified'
     AND NEW.classification_status = 'classified'
     AND NEW.classified_at IS NOT DISTINCT FROM OLD.classified_at
     AND coalesce(current_setting('radar.classification_override', true), '') <> 'on' THEN
    NEW.therapeutic_area := coalesce(OLD.therapeutic_area, NEW.therapeutic_area);
    NEW.modality := coalesce(OLD.modality, NEW.modality);
    NEW.indication_category := coalesce(OLD.indication_category, NEW.indication_category);
    NEW.indication_specific := coalesce(OLD.indication_specific, NEW.indication_specific);
    IF OLD.therapeutic_area IS NOT NULL THEN
      NEW.therapeutic_area_source := OLD.therapeutic_area_source;
    END IF;
  END IF;
  RETURN NEW;
END
$$;

ALTER TABLE public.clinical_assets ADD COLUMN IF NOT EXISTS therapeutic_area_source text;
COMMENT ON COLUMN public.clinical_assets.therapeutic_area_source IS
  'NULL = classifier or ingestion; trial_conditions / indication_text / drug_siblings / program_name = rule-based inference (radar_infer_ta, migrations 166 and 197b).';


-- ── 2. Restore what re-indexing overwrote ────────────────────────────────

UPDATE public.clinical_assets a
   SET therapeutic_area = CASE WHEN a.classification_evidence->'fields'->'therapeutic_area'->>'action' IN ('filled', 'confirmed', 'overwritten')
                                 AND a.classification_evidence->'fields'->'therapeutic_area'->>'value' IS NOT NULL
                               THEN a.classification_evidence->'fields'->'therapeutic_area'->>'value' ELSE a.therapeutic_area END,
       therapeutic_area_source = CASE WHEN a.classification_evidence->'fields'->'therapeutic_area'->>'action' IN ('filled', 'confirmed', 'overwritten')
                                        AND a.classification_evidence->'fields'->'therapeutic_area'->>'value' IS NOT NULL
                                      THEN NULL ELSE a.therapeutic_area_source END,
       modality = CASE WHEN a.classification_evidence->'fields'->'modality'->>'action' IN ('filled', 'confirmed', 'overwritten')
                         AND a.classification_evidence->'fields'->'modality'->>'value' IS NOT NULL
                       THEN a.classification_evidence->'fields'->'modality'->>'value' ELSE a.modality END,
       indication_category = CASE WHEN a.classification_evidence->'fields'->'indication_category'->>'action' IN ('filled', 'confirmed', 'overwritten')
                                    AND a.classification_evidence->'fields'->'indication_category'->>'value' IS NOT NULL
                                  THEN a.classification_evidence->'fields'->'indication_category'->>'value' ELSE a.indication_category END,
       indication_specific = CASE WHEN a.classification_evidence->'fields'->'indication_specific'->>'action' IN ('filled', 'confirmed', 'overwritten')
                                    AND a.classification_evidence->'fields'->'indication_specific'->>'value' IS NOT NULL
                                  THEN a.classification_evidence->'fields'->'indication_specific'->>'value' ELSE a.indication_specific END
 WHERE a.classification_status = 'classified'
   AND a.last_enriched_at > a.classified_at
   AND EXISTS (
     SELECT 1 FROM unnest(ARRAY['therapeutic_area', 'modality', 'indication_category', 'indication_specific']) f
     WHERE a.classification_evidence->'fields'->f->>'action' IN ('filled', 'confirmed', 'overwritten')
       AND a.classification_evidence->'fields'->f->>'value' IS NOT NULL
       AND a.classification_evidence->'fields'->f->>'value' IS DISTINCT FROM
           CASE f WHEN 'therapeutic_area' THEN a.therapeutic_area WHEN 'modality' THEN a.modality
                  WHEN 'indication_category' THEN a.indication_category ELSE a.indication_specific END);

-- The trigger goes on after the restore (the restore is itself an update that keeps classified_at).
DROP TRIGGER IF EXISTS trg_keep_classified_fields ON public.clinical_assets;
CREATE TRIGGER trg_keep_classified_fields
  BEFORE UPDATE OF therapeutic_area, modality, indication_category, indication_specific ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION public.radar_keep_classified_fields();

-- ── 3. Therapeutic area without the model ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.radar_ta_keywords (
  therapeutic_area text PRIMARY KEY,
  priority integer NOT NULL,
  pattern text NOT NULL
);
ALTER TABLE public.radar_ta_keywords ENABLE ROW LEVEL SECURITY;

-- Same rows as migration 166 (applied to production Sep 29 2026); kept as they are where present.
INSERT INTO public.radar_ta_keywords (therapeutic_area, priority, pattern) VALUES
  ('oncology', 1, '(cancer|tumou?r|carcinoma|malignan|leuka?emi|lymphoma|myeloma|sarcoma|melanoma|glioma|glioblastoma|neoplas|metasta|blastoma|mesothelioma|myelodysplastic|癌|肿瘤|白血病|淋巴瘤|骨髓瘤|がん|암)'),
  ('infectious_disease', 2, '(infection|infectious|bacteri|viral|virus|\mhiv\M|hepatitis|covid|sars-cov|influenza|vaccin|pneumonia|tubercul|malaria|fungal|candid|sepsis|pharyngitis|otitis|\mrsv\M|herpes|zoster|dengue|gonorrh|chlamydia|感染|疫苗|病毒)'),
  ('hematology', 3, '(ana?emia|ha?emophilia|thrombocytopeni|sickle|thalass|ha?emosta|bleeding|neutropeni|von willebrand|myelofibrosis|polycyth|hemoglobin)'),
  ('neurology', 4, '(alzheimer|parkinson|epilep|seizure|migraine|headache|\mpain\M|neuropath|multiple sclerosis|amyotrophic|\mals\M|stroke|depress|schizophren|bipolar|anxiety|insomnia|adhd|autism|dementia|huntington|neuralgia|spinal muscular|narcolepsy|opioid use|alcohol use|smoking cessation|analges|anesthes|anaesthes)'),
  ('cardiovascular', 5, '(hypertension|heart failure|cardi|coronary|atrial fibrillation|arrhythm|myocard|atheroscl|venous thrombo|thromboembol|angina|aortic|peripheral arter|vascular surgery)'),
  ('metabolic', 6, '(diabet|obesity|overweight|dyslipid|hyperlipid|cholesterol|triglycerid|\mnash\M|\mmash\M|steatohep|fatty liver|\mgout\M|hyperuric|糖尿病|肥胖)'),
  ('immunology', 7, '(rheumatoid|arthritis|lupus|crohn|ulcerative colitis|graft[- ]versus[- ]host|graft vs host|transplant|sj[oö]gren|spondyl|vasculitis|myasthenia|immune thrombocytop|autoimmun|sarcoidosis)'),
  ('respiratory', 8, '(asthma|\mcopd\M|pulmonary fibrosis|idiopathic pulmonary|cough|rhinitis|sinusitis|bronchi|emphysema|respiratory)'),
  ('dermatology', 9, '(dermatitis|psoria|\macne\M|keratos|wound|eczema|urticaria|alopecia|vitiligo|\mscars?\M|rosacea|hidradenitis|pruritus|skin)'),
  ('ophthalmology', 10, '(macular|retin|glaucoma|\meyes?\M|ocular|uveitis|myopia|conjunctiv|cataract|kerat(itis|oconus)|diabetic macular)'),
  ('gastroenterology', 11, '(gastro|reflux|\mgerd\M|peptic|ulcer|irritable bowel|constipation|diarrh|cirrhosis|pancreatitis|dyspepsia|helicobacter|cholang|bowel)'),
  ('womens_health', 12, '(endometriosis|contracept|menopaus|pregnan|infertil|ovulat|ovarian stimulation|uterine fibroid|vagin|preterm|polycystic ovary|dysmenorrh|子宫内膜异位)'),
  ('rare_disease', 13, '(fabry|gaucher|pompe|mucopolysacchar|duchenne|cystic fibrosis|phenylketon|amyloidosis|hereditary angioedema|rare disease)')
ON CONFLICT (therapeutic_area) DO NOTHING;

-- Text a keyword vote may read: vector and platform words that are not diseases are removed
-- ("lentiviral vector" is not an infection; "orphan designation" is not a rare-disease indication).
CREATE OR REPLACE FUNCTION public.radar_ta_text(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT regexp_replace(lower(coalesce(p, '')),
    '((lenti|retro|adeno|baculo|onco)?vir(al|us)[- ]vectors?|lentivir[a-z]*|retrovir[a-z]*|adenovir[a-z]*|adeno-associated vir[a-z]*|oncolytic vir[a-z]*|\maav[0-9a-z]*|orphan( drug)?( designation)?|rare pediatric disease|healthy (volunteers?|subjects?|participants?)|bioequivalence|pharmacokinetics?)',
    ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.radar_infer_ta(p_limit integer DEFAULT 20000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '240s'
AS $function$
DECLARE
  v_conditions integer := 0;
  v_indication integer := 0;
  v_siblings integer := 0;
  v_name integer := 0;
BEGIN
  -- Programs a user can see without a therapeutic area, best-ranked first.
  DROP TABLE IF EXISTS tmp_ta_todo;
  CREATE TEMP TABLE tmp_ta_todo ON COMMIT DROP AS
  SELECT a.id, a.nct_ids, a.drug_master_id, a.indication_specific, a.indications_all, a.asset_name,
         a.program_name, a.moa_short, a.mechanism
  FROM public.clinical_assets a
  WHERE a.therapeutic_area IS NULL AND a.program_primary AND a.owner_type = 'industry'
    AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program')
  ORDER BY a.score_rank DESC NULLS LAST, a.id
  LIMIT GREATEST(coalesce(p_limit, 20000), 1);

  DROP TABLE IF EXISTS tmp_ta_pick;
  CREATE TEMP TABLE tmp_ta_pick (id uuid PRIMARY KEY, therapeutic_area text, source text) ON COMMIT DROP;

  -- a. The program's trial conditions (one vote per condition string, migration 166).
  INSERT INTO tmp_ta_pick
  SELECT DISTINCT ON (v.id) v.id, v.therapeutic_area, 'trial_conditions'
  FROM (
    SELECT t.id, k.therapeutic_area, k.priority, count(*) AS n
    FROM tmp_ta_todo t
    JOIN public.company_trials ct ON ct.nct_id = ANY (t.nct_ids)
    CROSS JOIN LATERAL unnest(ct.conditions) c
    JOIN public.radar_ta_keywords k ON public.radar_ta_text(c) ~* k.pattern
    WHERE cardinality(coalesce(t.nct_ids, '{}')) > 0
    GROUP BY 1, 2, 3
  ) v
  ORDER BY v.id, v.n DESC, v.priority;
  GET DIAGNOSTICS v_conditions = ROW_COUNT;

  -- b. Its own indication text.
  INSERT INTO tmp_ta_pick
  SELECT DISTINCT ON (v.id) v.id, v.therapeutic_area, 'indication_text'
  FROM (
    SELECT t.id, k.therapeutic_area, k.priority, count(*) AS n
    FROM tmp_ta_todo t
    CROSS JOIN LATERAL unnest(array_remove(ARRAY[t.indication_specific] || coalesce(t.indications_all, '{}'), NULL)) i
    JOIN public.radar_ta_keywords k ON public.radar_ta_text(i) ~* k.pattern
    WHERE NOT EXISTS (SELECT 1 FROM tmp_ta_pick p WHERE p.id = t.id)
    GROUP BY 1, 2, 3
  ) v
  ORDER BY v.id, v.n DESC, v.priority;
  GET DIAGNOSTICS v_indication = ROW_COUNT;

  -- c. The same drug's other programs, when at least 60% of them agree (inferred areas do not vote).
  INSERT INTO tmp_ta_pick
  SELECT v.id, v.therapeutic_area, 'drug_siblings'
  FROM (
    SELECT t.id, s.therapeutic_area, count(*) AS n,
           sum(count(*)) OVER (PARTITION BY t.id) AS total,
           row_number() OVER (PARTITION BY t.id ORDER BY count(*) DESC, s.therapeutic_area) AS rk
    FROM tmp_ta_todo t
    JOIN public.drug_master d ON d.id = t.drug_master_id AND coalesce(d.confidence, 0) >= 65
    JOIN public.clinical_assets s ON s.drug_master_id = t.drug_master_id AND s.id <> t.id
     AND s.therapeutic_area IS NOT NULL
     AND coalesce(s.therapeutic_area_source, 'trial_conditions') IN ('trial_conditions')
    WHERE NOT EXISTS (SELECT 1 FROM tmp_ta_pick p WHERE p.id = t.id)
    GROUP BY t.id, s.therapeutic_area
  ) v
  WHERE v.rk = 1 AND v.n >= 0.6 * v.total;
  GET DIAGNOSTICS v_siblings = ROW_COUNT;

  -- d. Its name and mechanism ("anti-VEGFR2 gene therapy for wet AMD", "HBV siRNA").
  INSERT INTO tmp_ta_pick
  SELECT DISTINCT ON (t.id) t.id, k.therapeutic_area, 'program_name'
  FROM tmp_ta_todo t
  JOIN public.radar_ta_keywords k
    ON public.radar_ta_text(concat_ws(' ', t.asset_name, t.program_name, t.moa_short, t.mechanism)) ~* k.pattern
  WHERE NOT EXISTS (SELECT 1 FROM tmp_ta_pick p WHERE p.id = t.id)
  ORDER BY t.id, k.priority;
  GET DIAGNOSTICS v_name = ROW_COUNT;

  UPDATE public.clinical_assets a
     SET therapeutic_area = p.therapeutic_area,
         therapeutic_area_source = p.source
    FROM tmp_ta_pick p
   WHERE a.id = p.id AND a.therapeutic_area IS NULL;

  RETURN jsonb_build_object(
    'candidates', (SELECT count(*) FROM tmp_ta_todo),
    'trial_conditions', v_conditions,
    'indication_text', v_indication,
    'drug_siblings', v_siblings,
    'program_name', v_name
  );
END;
$function$;

COMMENT ON FUNCTION public.radar_infer_ta(integer) IS
  'Rule-based therapeutic area for visible programs the classifier left empty (conditions, indication, drug siblings, name); called by the asset-classify cron each run. Migration 197b.';
REVOKE ALL ON FUNCTION public.radar_infer_ta(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_infer_ta(integer) TO service_role;

-- ── 4. Skipped rows in the feed ──────────────────────────────────────────

-- Generic bioequivalence arms, devices and procedures are not programs.
UPDATE public.clinical_assets a
   SET ownership_status = 'not_a_program',
       ownership_evidence = jsonb_build_object('rule', 'not_a_program', 'reason', 'non_drug_arm_text', 'migration', '197b'),
       ownership_checked_at = now()
 WHERE a.program_primary
   AND a.classification_status = 'skipped'
   AND a.classification_evidence->>'reason' IN ('non_drug', 'placebo_or_generic')
   AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program')
   AND NOT public.radar_has_dev_code(a.asset_name)
   AND (
     a.asset_name ~* '^\s*intervention\s*(group|arm)?\s*\d*\s*(\(test\))?\s*[:(]'
     OR a.asset_name ~* '\m(lens|lenses|stent|stents|implant|catheter|radiotherapy|radiation therapy|biopsy|sequencing|surgery|arthroscopy|monitoring|questionnaire|counsel+ing|exercise|diet|contrast medium|screening visit|dialysis solution)\M'
   )
   AND a.asset_name !~* '(gene|aav|vector|cell|mab\M|toxin|vaccin|transdermal|antibod|peptide|rna\M|oligo)';

-- Everything else that was skipped goes back to the model.
UPDATE public.clinical_assets a
   SET classification_status = 'unclassified',
       classification_evidence = coalesce(a.classification_evidence, '{}'::jsonb)
                                 || jsonb_build_object('rule_skip_overridden', true, 'previous_skip_reason', a.classification_evidence->>'reason')
 WHERE a.program_primary
   AND a.owner_type = 'industry'
   AND a.classification_status = 'skipped'
   AND a.phase NOT IN ('phase_4', 'not_applicable', 'unknown')
   AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program')
   AND NOT public.radar_is_comparator_named(a.asset_name);

-- ── 5. Programs the Oct 29 drug identity repair unlinked ─────────────────
--
-- radar_drug_identity_apply (run drugid_202610291947, migration 173) detached 16,647 assets from
-- wrongly merged drug nodes and marked them 'unresolvable'. The drug-resolve job only picks
-- 'unresolved', so none was ever resolved again: 2,169 default-feed programs with a development code
-- (ONO-2506, LY3434172, BAY2666605 ...) have had no drug since, 5.5 points of the feed's
-- drug-resolved share. Rows whose name carries a code or an INN go back to 'unresolved' (unless the
-- name is still an alias of the node they were detached from); the fixed
-- resolver (lib/radar/drug-identity.ts gate) links them to the right node or keys them on an internal
-- one. The local pass takes 5,000 a run (every 3 h), so ~7,000 clear in a day.
DO $$
BEGIN
  IF to_regclass('public.radar_drug_identity_plan') IS NOT NULL THEN
    UPDATE public.clinical_assets a
       SET drug_resolution_status = 'unresolved',
           drug_resolved_at = NULL
     WHERE a.drug_master_id IS NULL
       AND a.drug_resolution_status = 'unresolvable'
       AND (public.radar_has_dev_code(a.asset_name) OR cardinality(public.radar_asset_identifiers(a.asset_name)) > 0)
       AND EXISTS (SELECT 1 FROM public.radar_drug_identity_plan p
                   WHERE p.asset_id = a.id AND p.kind = 'asset' AND p.action = 'unlink'
                     -- precision: if the row's own name is still an alias of the node it was detached
                     -- from, the resolver would re-attach it there (233 of 2,626 feed rows); leave those.
                     AND NOT EXISTS (SELECT 1 FROM public.drug_aliases al
                                     WHERE al.drug_id = p.old_drug_master_id
                                       AND al.alias_normalized = lower(regexp_replace(a.asset_name, '[^A-Za-z0-9]', '', 'g'))));
  END IF;
END $$;
