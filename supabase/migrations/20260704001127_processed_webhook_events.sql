-- Idempotency ledger for the Kashier payment webhook.
--
-- Kashier retries webhook deliveries that don't ack with a 2xx (every 5 min
-- for 15 min, then every 8h for 24h). Recording each event's id here lets
-- kashier-webhook recognize a redelivery and return 200 immediately instead
-- of re-running fulfill_order() / re-sending the confirmation email.
create table if not exists public.processed_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

comment on table public.processed_webhook_events is
  'Kashier webhook event ids already processed, so retried deliveries are safely ignored.';

-- This table is only ever read/written by the kashier-webhook edge function
-- using the service-role key (which bypasses RLS). Lock it down from the
-- anon/authenticated roles so no client can read or forge entries in it.
alter table public.processed_webhook_events enable row level security;
