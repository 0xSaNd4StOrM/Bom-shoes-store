-- Phase: singleton store settings (logo/favicon), a storage bucket for them,
-- and Realtime on orders for the admin dashboard.

-- ---------------------------------------------------------------------------
-- store_settings: singleton row holding the storefront's logo/favicon.
--
-- Singleton enforcement: rather than a constraint trying to express "at most
-- one row" (there's no clean way to do that in SQL beyond a trigger), this
-- table is seeded with exactly one row at a hardcoded, well-known id --
-- '00000000-0000-0000-0000-000000000001' -- and the app always reads/writes
-- that exact id (select ... where id = '00000000-...0001', upsert with that
-- id, never a bare insert). The check constraint below backs that up at the
-- data layer: it makes any row with a *different* id impossible to insert in
-- the first place, so even a service-role write (which bypasses RLS) can't
-- create a second row by accident. Combined with RLS granting no INSERT/
-- DELETE policy to any client role (the one row is seeded right here, once),
-- this is simpler and more robust than modeling "singleton" as its own
-- constraint type.
create table public.store_settings (
  id uuid primary key default gen_random_uuid()
    check (id = '00000000-0000-0000-0000-000000000001'),
  logo_url text,
  favicon_url text,
  updated_at timestamptz not null default now()
);

comment on table public.store_settings is
  'Singleton store settings row. ALWAYS read/write id = ''00000000-0000-0000-0000-000000000001'' -- seeded once by this migration; the id check constraint makes any other row impossible to insert. Public SELECT (storefront needs the active logo/favicon as an anon visitor); admin-only UPDATE; no INSERT/DELETE policy for any client role.';

insert into public.store_settings (id, logo_url, favicon_url)
values ('00000000-0000-0000-0000-000000000001', null, null);

alter table public.store_settings enable row level security;

create policy "Public can view store settings"
  on public.store_settings for select
  using (true);

create policy "Admins can update store settings"
  on public.store_settings for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for logo/favicon uploads -- mirrors the product-images
-- bucket policy-for-policy (see 20260704002000_product_images_and_variants.sql).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

create policy "Public can view store-assets bucket"
  on storage.objects for select
  using (bucket_id = 'store-assets');

create policy "Admins can upload to store-assets bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'store-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update store-assets bucket"
  on storage.objects for update
  using (
    bucket_id = 'store-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    bucket_id = 'store-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete from store-assets bucket"
  on storage.objects for delete
  using (
    bucket_id = 'store-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Realtime on orders, for the admin dashboard to subscribe to new/changed
-- orders. Guarded with an existence check against pg_publication_tables
-- since re-adding an already-published table errors (there's no
-- `ADD TABLE IF NOT EXISTS` in this Postgres version's ALTER PUBLICATION
-- syntax), matching the do-block-guard idempotency style used elsewhere in
-- this migration set (e.g. the orders_kashier_order_id_key constraint guard
-- in 20260704001128_fulfill_order_function.sql).
--
-- ****************************************************************************
-- CAVEAT -- VERIFY ONCE DEPLOYED, CANNOT BE CHECKED FROM A LOCAL-ONLY
-- MIGRATION: Realtime's postgres_changes still enforces orders' own RLS
-- policies against the subscribing client's role/JWT -- adding the table to
-- supabase_realtime only turns the *feed* on, it does not bypass RLS. This
-- migration has never inspected what SELECT policy (if any) exists on
-- `orders` -- that table predates every migration in this repo. If admins
-- don't already have a SELECT policy on orders (e.g. because admin order
-- reads have so far only ever gone through a service-role edge function),
-- an admin client's realtime subscription will silently receive nothing --
-- no error, just no events. Confirm after deploy with something like:
--   select * from pg_policies where schemaname = 'public' and tablename = 'orders';
-- and add an admin SELECT policy on orders if one isn't already there.
-- ****************************************************************************
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
