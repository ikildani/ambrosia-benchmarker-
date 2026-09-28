-- Migration 140 — Stripe invoice on a brief request (lib/brief/invoice.ts)
ALTER TABLE benchmark_requests
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS invoice_url text;
CREATE INDEX IF NOT EXISTS benchmark_requests_stripe_invoice_idx ON benchmark_requests (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
