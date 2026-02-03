-- Migration: 007_enhanced_scenarios.sql
-- Enhanced Scenarios: Add notes field for scenario descriptions

-- Add notes column to saved_scenarios
ALTER TABLE saved_scenarios ADD COLUMN IF NOT EXISTS notes TEXT;
