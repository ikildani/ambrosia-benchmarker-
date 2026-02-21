-- Reclassify deals with non-oncology indication categories
-- that were incorrectly bucketed under oncology/neurology therapeutic_area

-- Autoimmune deals → immunology
UPDATE deals SET therapeutic_area = 'immunology'
WHERE indication_category = 'autoimmune' AND therapeutic_area NOT IN ('immunology');

-- Metabolic deals → metabolic
UPDATE deals SET therapeutic_area = 'metabolic'
WHERE indication_category = 'metabolic' AND therapeutic_area NOT IN ('metabolic');

-- Cardiovascular deals currently in 'other' → keep as other (no CV TA yet)
-- Rare disease deals with autoimmune indicators → immunology
UPDATE deals SET therapeutic_area = 'immunology'
WHERE indication_category = 'rare_disease'
  AND therapeutic_area = 'other'
  AND (asset_description ILIKE '%autoimmune%' OR asset_description ILIKE '%inflammatory%');
