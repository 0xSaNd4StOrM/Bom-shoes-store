-- Phase: product bundles, buy-X-get-Y coupons, and coupon/bundle stacking.
--
-- Three additive extensions to the discount engine (see
-- supabase/functions/_shared/pricing.ts for the combining logic that ties
-- them together):
--   1. bundles/bundle_items -- a new, standalone "buy these products
--      together for a discount" mechanism.
--   2. buy_x_get_y -- a new discount_type on the EXISTING coupons table,
--      reusing its existing target_type/target_category/target_product_ids
--      scope for which cart items qualify as both the "buy" and "get" pool
--      (deliberately one scope mechanism, not a second targeting system).
--   3. stackable -- a single boolean on coupons letting a coupon/promotion
--      combine with an independently-qualifying bundle (see pricing.ts).

-- ---------------------------------------------------------------------------
-- bundles / bundle_items
--
-- Public SELECT on both, same as product_images/product_variants: the
-- active=true filter that decides whether a bundle is "on" is the querying
-- code's job (see pricing.ts's findBestBundle), not RLS -- bundle_items rows
-- must stay publicly readable so the storefront can list what's inside an
-- active bundle. Admin-only write, same exists(...) pattern as every other
-- admin-write table in this codebase.
-- ---------------------------------------------------------------------------
create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.bundles is
  'Product bundles ("buy these N products together for a discount"). Public SELECT (the active=true filter is the querying code''s job, not RLS); admin-only write.';

alter table public.bundles enable row level security;

create policy "Public can view bundles"
  on public.bundles for select
  using (true);

create policy "Admins can insert bundles"
  on public.bundles for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update bundles"
  on public.bundles for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete bundles"
  on public.bundles for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create table public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0)
);

create index bundle_items_bundle_id_idx on public.bundle_items(bundle_id);

comment on table public.bundle_items is
  'Required product_id + quantity for a bundle, matched by product_id only (not size/color) -- bundles are product-level, not variant-level. Public SELECT so an active bundle''s contents can be shown; admin-only write.';

alter table public.bundle_items enable row level security;

create policy "Public can view bundle items"
  on public.bundle_items for select
  using (true);

create policy "Admins can insert bundle items"
  on public.bundle_items for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update bundle items"
  on public.bundle_items for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete bundle items"
  on public.bundle_items for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Same audit trail every other admin-managed table gets (see
-- 20260704005000_hero_banners_and_activity_logs.sql for log_activity()).
-- bundle_items isn't wired up: it's a pure child of bundles with no
-- independent lifecycle worth auditing on its own, same reasoning as
-- product_images/product_variants not getting their own trigger either.
create trigger log_bundles_activity
  after insert or update or delete on public.bundles
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- coupons: buy-X-get-Y discount type + stacking flag.
--
-- Single ALTER TABLE + a dropped-and-recreated CHECK constraint -- not a
-- per-row UPDATE loop. There is no per-row data migration needed here since
-- these are brand new, nullable (or safely defaulted) columns; the earlier
-- phase's "batch, don't diff row-by-row" lesson is about avoiding a
-- migration racing a unique constraint with N individual UPDATEs, which
-- doesn't apply to a schema-only change like this one.
-- ---------------------------------------------------------------------------
alter table public.coupons
  drop constraint coupons_discount_type_check;

alter table public.coupons
  add constraint coupons_discount_type_check
  check (discount_type in ('percentage', 'fixed', 'free_shipping', 'buy_x_get_y'));

alter table public.coupons
  add column if not exists buy_quantity int,
  add column if not exists get_quantity int,
  add column if not exists get_discount_percent numeric,
  add column if not exists stackable boolean not null default false;

comment on column public.coupons.buy_quantity is
  'Only meaningful when discount_type = ''buy_x_get_y''. Qualifying units required to unlock a discount on get_quantity more, drawn from the SAME target_type/target_category/target_product_ids pool as the "get" side (see pricing.ts computeBxgyDiscount) -- not a separate cross-product pairing.';
comment on column public.coupons.get_quantity is
  'Only meaningful when discount_type = ''buy_x_get_y''. Number of qualifying units discounted per complete (buy_quantity + get_quantity) set.';
comment on column public.coupons.get_discount_percent is
  'Only meaningful when discount_type = ''buy_x_get_y''. 100 = the get_quantity items are free, 50 = half off, etc.';
comment on column public.coupons.stackable is
  'When true, this coupon/promotion may combine with a simultaneously-qualifying bundle discount (see pricing.ts resolveBestDiscount) -- the only stacking this engine allows. Two coupons never stack with each other, and a bundle never stacks with another bundle.';
