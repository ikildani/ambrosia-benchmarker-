-- Migration 135 — the client's own data on a Deal Intelligence Brief request
--
-- The brief was built from public data plus a handful of asset fields. A brief
-- that drives a decision has to read what the client owns: their own model,
-- their runway, the offers already on the table, the buyers they want or will
-- not talk to, and what their data package actually contains. It also records
-- the manual invoice step that replaces a checkout.

ALTER TABLE benchmark_requests
  -- the client's model, $M and %
  ADD COLUMN IF NOT EXISTS client_peak_sales_m numeric,
  ADD COLUMN IF NOT EXISTS client_pos_pct numeric,
  ADD COLUMN IF NOT EXISTS client_launch_year integer,
  ADD COLUMN IF NOT EXISTS client_dev_cost_m numeric,
  ADD COLUMN IF NOT EXISTS client_expected_upfront_m numeric,
  ADD COLUMN IF NOT EXISTS client_expected_total_m numeric,
  ADD COLUMN IF NOT EXISTS client_model_notes text,
  -- runway and financing
  ADD COLUMN IF NOT EXISTS cash_on_hand_m numeric,
  ADD COLUMN IF NOT EXISTS runway_months integer,
  ADD COLUMN IF NOT EXISTS next_raise_m numeric,
  ADD COLUMN IF NOT EXISTS next_raise_date date,
  -- process to date
  ADD COLUMN IF NOT EXISTS prior_offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS term_sheets_received integer,
  ADD COLUMN IF NOT EXISTS target_buyers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_buyers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS upstream_licenses text,
  ADD COLUMN IF NOT EXISTS ip_notes text,
  -- data package checklist (keys from lib/brief/client-intake.ts DATA_PACKAGE_ITEMS)
  ADD COLUMN IF NOT EXISTS data_package jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- manual invoice step
  ADD COLUMN IF NOT EXISTS billing_entity text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS invoice_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  -- where the request came in
  ADD COLUMN IF NOT EXISTS intake_path text;

COMMENT ON COLUMN benchmark_requests.prior_offers IS 'Array of {party, date, upfrontM, totalM, structure, status, notes}; printed against the floor and ask on the "your model vs Solidus" page.';
COMMENT ON COLUMN benchmark_requests.data_package IS 'Map of DATA_PACKAGE_ITEMS key -> boolean; feeds Diligence Readiness (ready vs gaps).';
COMMENT ON COLUMN benchmark_requests.invoice_requested_at IS 'Set at intake; payment_status stays pending until the invoice is sent (invoiced) and paid (paid).';
