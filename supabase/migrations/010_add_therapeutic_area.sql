-- Add therapeutic_area column to calculations table
-- This was missing from the original schema but required by the API route
ALTER TABLE calculations ADD COLUMN IF NOT EXISTS therapeutic_area TEXT DEFAULT 'oncology';
