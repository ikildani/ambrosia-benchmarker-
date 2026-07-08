-- RWE (Real-World Evidence) Tuning Tables
-- Supports Item 10 of the Engine Grade A+ Roadmap.
-- Stores weekly backtest results, proposed tuning deltas, and promoted overrides.

-- 1. Main results table (one row per weekly run)
create table if not exists rwe_tuning_results (
  id uuid primary key default gen_random_uuid(),
  as_of_date date not null default current_date,
  total_drugs_analyzed integer not null,
  drugs_skipped integer not null default 0,
  overall_mean_error numeric(8, 6) not null,
  overall_mape numeric(8, 6) not null,
  overall_rmse numeric(12, 2) not null,
  drift_alert boolean not null default false,
  holdout_rmse numeric(12, 2),
  holdout_sample_size integer,
  result_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint rwe_tuning_results_as_of_date_key unique (as_of_date)
);

create index if not exists idx_rwe_tuning_results_date on rwe_tuning_results (as_of_date desc);
create index if not exists idx_rwe_tuning_results_drift on rwe_tuning_results (drift_alert) where drift_alert = true;

-- 2. Proposed tuning deltas (one set per run)
create table if not exists rwe_pending_deltas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references rwe_tuning_results(id) on delete cascade,
  parameter text not null,
  current_value numeric(8, 4) not null,
  proposed_value numeric(8, 4) not null,
  expected_error_reduction numeric(12, 2),
  rationale text not null,
  status text not null default 'pending'
    check (status in ('pending', 'promoted', 'rejected', 'expired')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_rwe_pending_deltas_run on rwe_pending_deltas (run_id);
create index if not exists idx_rwe_pending_deltas_status on rwe_pending_deltas (status);

-- 3. Active overrides (promoted deltas currently in effect)
create table if not exists rwe_active_overrides (
  id uuid primary key default gen_random_uuid(),
  delta_id uuid not null references rwe_pending_deltas(id),
  parameter text not null unique,
  override_value numeric(8, 4) not null,
  applied_at timestamptz not null default now(),
  applied_by text not null default 'cron-auto',
  source_rmse numeric(12, 2)
);

-- RLS: read for authenticated users, write only via service role
alter table rwe_tuning_results enable row level security;
alter table rwe_pending_deltas enable row level security;
alter table rwe_active_overrides enable row level security;

create policy "rwe_tuning_results_read" on rwe_tuning_results
  for select to authenticated using (true);
create policy "rwe_tuning_results_service_write" on rwe_tuning_results
  for all to service_role using (true) with check (true);

create policy "rwe_pending_deltas_read" on rwe_pending_deltas
  for select to authenticated using (true);
create policy "rwe_pending_deltas_service_write" on rwe_pending_deltas
  for all to service_role using (true) with check (true);

create policy "rwe_active_overrides_read" on rwe_active_overrides
  for select to authenticated using (true);
create policy "rwe_active_overrides_service_write" on rwe_active_overrides
  for all to service_role using (true) with check (true);
