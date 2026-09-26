-- 124: Deal Intelligence Brief delivery hardening (2026-09-25)
--
-- The generate route now stores the PDF under a signed, expiring link instead
-- of a public object URL. The storage path is kept so a fresh link can be
-- minted for the data room, and the Excel export lands beside it.
--
-- pdf_url continues to hold the most recently minted signed URL (30-day TTL).

alter table public.benchmark_requests
  add column if not exists pdf_storage_path text,
  add column if not exists excel_storage_path text,
  add column if not exists excel_url text,
  add column if not exists delivery_email_sent_at timestamptz;

comment on column public.benchmark_requests.pdf_storage_path is 'Path in the reports bucket; mint signed URLs from this, never expose a public URL.';
comment on column public.benchmark_requests.excel_storage_path is 'Path in the reports bucket for the Excel data export.';
comment on column public.benchmark_requests.delivery_email_sent_at is 'When the client delivery email (signed links + walkthrough scheduling) went out.';

-- The reports bucket is private: objects are reachable only through signed URLs.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do update set public = false;
