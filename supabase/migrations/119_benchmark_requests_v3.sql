-- Deal Intelligence Brief v3 — asset-specific intake and Managing Partner review.
--
-- Requires 075_benchmark_requests.sql (table creation). As of 2026-09-23 that
-- migration is NOT applied in production: the intake route inserts into a
-- table that does not exist. Apply 075 first, then this file.

alter table benchmark_requests
  add column if not exists modality text,                 -- calc modality key (mab, small_molecule, adc, …)
  add column if not exists asset_name text,
  add column if not exists mechanism text,                -- e.g. "anti-pTau217 antibody"
  add column if not exists target text,                   -- e.g. "MAPT"
  add column if not exists target_deal_type text,         -- licensing | option | co_development | acquisition
  add column if not exists differentiation_notes text,    -- client's own differentiation claims
  add column if not exists data_package_stage text,       -- e.g. "IND-enabling complete"
  add column if not exists diligence_ready text[] not null default '{}',
  add column if not exists diligence_gaps text[] not null default '{}',
  add column if not exists mp_opinion text,               -- signed Managing Partner view printed on page 3
  add column if not exists mp_reviewer text,
  add column if not exists mp_reviewed_at timestamptz,
  add column if not exists brief_version text not null default 'v3';

comment on column benchmark_requests.mp_opinion is
  'Managing Partner written opinion. Printed verbatim on the Decision page; never generated.';
