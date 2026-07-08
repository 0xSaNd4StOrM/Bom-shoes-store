-- Admin-configurable DISPLAY currency for the storefront.
--
-- This controls only how prices are shown to shoppers (symbol/code). Payment is
-- always settled in EGP by Kashier (see supabase/functions/create-order) -- the
-- gateway is Egyptian and the store charges the numeric price as EGP -- so the
-- default is EGP and matching your display currency to EGP keeps what shoppers
-- see identical to what they're charged.
alter table public.store_settings
  add column if not exists currency text not null default 'EGP';
