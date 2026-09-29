-- 166: therapeutic area from trial conditions (rule-based, no model spend).
-- Applied to production 2026-09-29 ahead of the PR merging.
--
-- 3,151 default-feed programs had no therapeutic area; 2,607 have trials with
-- conditions. Each condition string votes for every area whose keywords it hits;
-- the area with the most votes wins, ties go to the lower priority number.
-- Rows are labelled therapeutic_area_source = 'trial_conditions' so the model
-- classifier (which writes NULL source) can overwrite them later.

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS therapeutic_area_source text;

COMMENT ON COLUMN public.clinical_assets.therapeutic_area_source IS
  'NULL = classifier or ingestion; trial_conditions = keyword vote over the asset''s trial conditions (166).';

CREATE TABLE IF NOT EXISTS public.radar_ta_keywords (
  therapeutic_area text PRIMARY KEY,
  priority integer NOT NULL,
  pattern text NOT NULL
);

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
  ('rare_disease', 13, '(fabry|gaucher|pompe|mucopolysacchar|duchenne|cystic fibrosis|phenylketon|amyloidosis|hereditary angioedema|rare disease|orphan)')
ON CONFLICT (therapeutic_area) DO UPDATE SET priority = EXCLUDED.priority, pattern = EXCLUDED.pattern;

CREATE OR REPLACE FUNCTION public.radar_fill_ta_from_conditions(p_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout TO '240s'
AS $$
DECLARE n integer := 0;
BEGIN
  WITH todo AS (
    SELECT a.id, a.nct_ids FROM public.clinical_assets a
    WHERE a.therapeutic_area IS NULL AND cardinality(coalesce(a.nct_ids, '{}')) > 0
    ORDER BY a.program_primary DESC, a.id
    LIMIT p_limit
  ), conds AS (
    SELECT DISTINCT t.id, lower(c) AS c
    FROM todo t
    JOIN public.company_trials ct ON ct.nct_id = ANY(t.nct_ids)
    CROSS JOIN LATERAL unnest(ct.conditions) AS c
    WHERE c !~* '^\s*(healthy|healthy volunteers?|healthy subjects?|bioequivalence|pharmacokinetics?|adult|\.+)\s*$'
  ), votes AS (
    SELECT c.id, k.therapeutic_area, k.priority, count(*) AS v
    FROM conds c JOIN public.radar_ta_keywords k ON c.c ~* k.pattern
    GROUP BY 1, 2, 3
  ), best AS (
    SELECT DISTINCT ON (id) id, therapeutic_area
    FROM votes ORDER BY id, v DESC, priority
  )
  UPDATE public.clinical_assets a
     SET therapeutic_area = b.therapeutic_area,
         therapeutic_area_source = 'trial_conditions'
    FROM best b
   WHERE a.id = b.id AND a.therapeutic_area IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
