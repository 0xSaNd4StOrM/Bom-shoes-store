-- Phase: back-in-stock email capture + the pg_cron job that dispatches it.
--
-- stock_notify_requests captures an email address against a specific variant
-- with NO account required (a common, low-risk email-capture pattern) --
-- public INSERT only. There is deliberately no public SELECT/UPDATE/DELETE
-- policy at all: nobody (not even the submitting visitor) can read who
-- signed up for what, or flip someone else's row to notified. The only
-- reader/writer is the send-back-in-stock-notifications edge function using
-- the service-role key, which bypasses RLS entirely.

create table public.stock_notify_requests (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  email text not null,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (variant_id, email)
);

comment on table public.stock_notify_requests is
  'Email capture for "notify me when back in stock", no account required. Public INSERT only; no SELECT/UPDATE/DELETE policy for any client role -- only the send-back-in-stock-notifications edge function (service-role key) reads/marks rows notified.';

alter table public.stock_notify_requests enable row level security;

create policy "Public can request a stock notification"
  on public.stock_notify_requests for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- pg_cron + pg_net: fire the send-back-in-stock-notifications edge function
-- every 15 minutes.
--
-- ****************************************************************************
-- MANUAL POST-DEPLOY STEP -- cannot be done or verified from this local-only
-- migration, there is no live project wired up here. Before this job can
-- actually succeed against the deployed project, store the two secrets it
-- reads below in Supabase Vault (Database -> Vault in the dashboard, or via
-- SQL as an admin/postgres role):
--
--   select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<the project''s service_role key>', 'service_role_key');
--
-- This is the exact convention Supabase's own docs use for this cron -> edge
-- function pattern -- vault.decrypted_secrets, not a custom
-- app.settings.xxx GUC -- see
-- https://supabase.com/docs/guides/functions/schedule-functions. Until both
-- secrets exist, the url/Authorization expressions below evaluate to NULL
-- and every run of this job just fails harmlessly in the background job
-- queue (it has no bearing on any product/order/payment transaction --
-- nothing here can corrupt or block a purchase). After wiring the secrets
-- up, confirm it's actually firing with:
--   select * from cron.job_run_details order by start_time desc limit 5;
-- ****************************************************************************
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-back-in-stock-notifications',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/send-back-in-stock-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
