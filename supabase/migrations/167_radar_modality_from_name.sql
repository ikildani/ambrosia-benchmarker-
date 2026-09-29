-- 167: modality from the program name (rule-based, no model spend).
-- Applied to production 2026-09-29 ahead of the PR merging (ledger 167 + 167b_radar_modality_from_name_fix); filled 1,882 assets.
--
-- Fills modality only where it is NULL and only from unambiguous name evidence:
-- INN stems (-vedotin, -mab, -rsen, -cel, -tide, -gene), radiolabels ([64Cu], 177Lu),
-- and words ("bispecific", "vaccine", "CAR-T", "AAV", "siRNA"). A bare code with a
-- registry intervention type of DRUG is left empty rather than guessed as a small
-- molecule. First matching rule wins, in the order below.

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS modality_source text;

COMMENT ON COLUMN public.clinical_assets.modality_source IS
  'NULL = classifier or ingestion; name_rules = unambiguous name evidence (167).';

CREATE OR REPLACE FUNCTION public.radar_modality_from_name(p_name text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN n ~* '(vedotin|deruxtecan|govitecan|mafodotin|emtansine|ozogamicin|tesirine|antibody[- ]drug conjugate|\madc\M)' THEN 'adc'
    WHEN n ~* '(\[\s*(64cu|68ga|177lu|18f|89zr|99mtc|111in|225ac|90y|131i|123i|124i|11c)\s*\]|\m(177lu|lu-177|68ga|ga-68|225ac|ac-225|64cu|cu-64)\M|radioligand|radiopharm)' THEN 'radiopharm'
    WHEN n ~* '(bispecific|trispecific|\mx anti-|\mbite\M)' THEN 'bispecific'
    WHEN n ~* '(\mcar[- ]?t\M|chimeric antigen receptor|car[- ]?nk\M)' THEN 'car_t'
    WHEN n ~* '(\maav\d*\M|adeno[- ]associated|gene therapy|gene transfer|lentivir|[a-z]{4,}gene\s+[a-z]+vec\M|\m[a-z]+vec\M)' THEN 'gene_therapy'
    WHEN n ~* '(vaccin|toxoid|\mvlp\M)' THEN 'vaccine'
    WHEN n ~* '(\msirna\M|antisense|oligonucleotide|\maso\M|[a-z]{3,}rsen\M|[a-z]{3,}siran\M)' THEN 'oligonucleotide'
    WHEN n ~* '(stem cells?|\mcells\M|cell therapy|[a-z]{4,}cel\M|\mtil\M|\mnk cells?|t[- ]cells?)' THEN 'cell_therapy'
    WHEN n ~* 'small[- ]molecul' THEN 'small_molecule'
    WHEN n ~* '(\mmrna\M|messenger rna)' THEN 'mrna'
    WHEN n ~* '(monoclonal|antibod|immunoglobulin|\migg[1-4]?\M|[a-z]{3,}(mab|tug|bart)\M|antiserum|anti-?venom|venom serum)' THEN 'antibody'
    WHEN n ~* '([a-z]{4,}(glutide|tide|relin|pressin)\M|\mpeptide\M)' AND n !~* 'nucleotide' THEN 'peptide'
    WHEN n ~* '(small[- ]molecule|[a-z]{4,}(tinib|ciclib|parib|lisib|rafenib|stat|gliflozin|gliptin|prazole|sartan|olol|pril|azole|floxacin|vir|dronate)\M|\minhibitor\M|\magonist\M|\mantagonist\M)' THEN 'small_molecule'
  END
  FROM (SELECT lower(coalesce(p_name, '')) AS n) x;
$$;

UPDATE public.clinical_assets
   SET modality = public.radar_modality_from_name(coalesce(display_name, asset_name)),
       modality_source = 'name_rules'
 WHERE modality IS NULL
   AND public.radar_modality_from_name(coalesce(display_name, asset_name)) IS NOT NULL;
