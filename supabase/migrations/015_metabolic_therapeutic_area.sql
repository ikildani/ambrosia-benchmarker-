-- Add metabolic as a recognized therapeutic area value
-- Backfill any existing deals with metabolic indication_category
UPDATE deals SET therapeutic_area = 'metabolic'
WHERE indication_category = 'metabolic' AND therapeutic_area IS DISTINCT FROM 'metabolic';
