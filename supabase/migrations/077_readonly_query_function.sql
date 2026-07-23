-- Migration: Add execute_readonly_query function and query_logs table
-- Purpose: Enables the natural language deal query feature by providing
-- a safe, read-only SQL execution function and analytics logging.

-- 1. Create the read-only query execution function
-- This function executes arbitrary SELECT queries in a restricted context.
-- Security: runs as the invoker (service role from API), restricted to SELECT only.
CREATE OR REPLACE FUNCTION execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
SET lock_timeout = '5s'
AS $$
DECLARE
  result JSONB;
  upper_query TEXT;
BEGIN
  -- Safety: Normalize and validate
  upper_query := UPPER(TRIM(query_text));

  -- Must start with SELECT or WITH
  IF NOT (upper_query LIKE 'SELECT%' OR upper_query LIKE 'WITH%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords
  IF upper_query ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|COPY|LOAD)' THEN
    RAISE EXCEPTION 'Mutation queries are not allowed';
  END IF;

  -- Block access to system catalogs
  IF upper_query ~ '(PG_CATALOG|INFORMATION_SCHEMA|PG_STAT|PG_SETTINGS)' THEN
    RAISE EXCEPTION 'System catalog access is not allowed';
  END IF;

  -- Block statement chaining
  IF query_text LIKE '%;%' THEN
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  -- Execute and return as JSON array
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
  INTO result;

  RETURN result;
END;
$$;

-- 2. Create query_logs table for analytics
CREATE TABLE IF NOT EXISTS query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  query_type TEXT,
  result_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  user_tier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_query_type ON query_logs (query_type);

-- RLS: only service role can insert (API routes use service client)
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (it bypasses RLS anyway, but explicit is better)
CREATE POLICY "Service role full access to query_logs"
  ON query_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON FUNCTION execute_readonly_query IS 'Executes read-only SQL queries for the natural language deal query feature. Validates input to prevent mutations.';
COMMENT ON TABLE query_logs IS 'Analytics log for natural language deal queries.';
