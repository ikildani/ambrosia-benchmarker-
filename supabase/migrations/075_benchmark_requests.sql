-- Deal Intelligence Brief — benchmark request intake & workflow tracking
-- Supports the concierge benchmark product: intake → call → generate → deliver → walkthrough

create table if not exists benchmark_requests (
  id uuid primary key default gen_random_uuid(),

  -- Contact
  name text not null,
  email text not null,
  company text,
  title text,
  phone text,

  -- Scope
  therapeutic_area text not null,
  indication text not null,
  phase text not null,
  modalities text[] not null default '{}',
  deal_types text[] not null default '{}',
  analyses text[] not null default '{}',
  territory text not null default 'global',
  custom_notes text,

  -- White-label
  white_label boolean not null default false,
  brand_name text,
  brand_logo_url text,
  brand_primary_color text,
  brand_secondary_color text,

  -- Workflow
  status text not null default 'intake'
    check (status in ('intake', 'scheduled', 'call_complete', 'generating', 'delivered', 'walkthrough_scheduled', 'walkthrough_complete', 'cancelled')),
  call_scheduled_at timestamptz,
  call_completed_at timestamptz,
  generation_started_at timestamptz,
  generation_completed_at timestamptz,
  delivered_at timestamptz,
  walkthrough_scheduled_at timestamptz,
  walkthrough_completed_at timestamptz,
  admin_notes text,

  -- Delivery
  pdf_url text,
  excel_url text,
  brief_token text unique,
  brief_page_count integer,

  -- Payment
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  amount_cents integer default 250000,
  payment_status text default 'pending'
    check (payment_status in ('pending', 'paid', 'invoiced', 'waived', 'refunded')),
  paid_at timestamptz,

  -- Meta
  user_id uuid references auth.users(id) on delete set null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_benchmark_requests_status on benchmark_requests (status);
create index if not exists idx_benchmark_requests_email on benchmark_requests (email);
create index if not exists idx_benchmark_requests_token on benchmark_requests (brief_token) where brief_token is not null;
create index if not exists idx_benchmark_requests_created on benchmark_requests (created_at desc);

-- RLS
alter table benchmark_requests enable row level security;

create policy "benchmark_requests_read_own" on benchmark_requests
  for select to authenticated using (auth.uid() = user_id);

create policy "benchmark_requests_insert_auth" on benchmark_requests
  for insert to authenticated with check (true);

create policy "benchmark_requests_insert_anon" on benchmark_requests
  for insert to anon with check (true);

create policy "benchmark_requests_service_all" on benchmark_requests
  for all to service_role using (true) with check (true);

-- Auto-update updated_at
create or replace function update_benchmark_requests_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger benchmark_requests_updated_at
  before update on benchmark_requests
  for each row execute function update_benchmark_requests_updated_at();
