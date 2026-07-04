-- Unified coupon / automatic-promotion engine.
--
-- One table models both: a real coupon has requires_code = true and a unique
-- `code` the customer types; an automatic promotion is the same row shape
-- with requires_code = false and code = null, applied without any code being
-- entered. This avoids two parallel systems that would inevitably drift.
--
-- Coupon codes must never be listable by an anonymous client (that would let
-- anyone browse every working code), so -- unlike products -- this table
-- gets NO public read policy at all, admin-only for every operation
-- including SELECT. All validation happens server-side in the
-- validate-coupon / create-order edge functions using the service-role key,
-- which bypasses RLS entirely.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  requires_code boolean not null default true,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed', 'free_shipping')),
  discount_value numeric not null default 0,
  min_order_amount numeric,
  max_discount_amount numeric,
  usage_limit int,
  per_customer_limit int,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  target_type text not null default 'all' check (target_type in ('all', 'category', 'products')),
  target_category text,
  target_product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.coupons is
  'Coupons AND automatic promotions in one table: requires_code=true + a unique code is a real coupon; requires_code=false + code=null is an auto-applied promotion. Admin-only RLS -- never publicly readable, validate via the validate-coupon/create-order edge functions (service-role key) only.';

alter table public.coupons enable row level security;

create policy "Admins can view coupons"
  on public.coupons for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert coupons"
  on public.coupons for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update coupons"
  on public.coupons for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete coupons"
  on public.coupons for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- coupon_redemptions: one row per order a coupon/promotion was actually
-- applied to. Written exactly once, atomically, by fulfill_order() at
-- payment-confirmation time (ON CONFLICT DO NOTHING keyed on (coupon_id,
-- order_id) so a webhook retry can't double-count). usage_limit /
-- per_customer_limit are enforced at order-creation time via a best-effort
-- COUNT against this table (see create-order / pricing.ts) -- not a hard
-- distributed lock; see task notes for why that's an accepted tradeoff.
-- ---------------------------------------------------------------------------
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_email text,
  redeemed_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

-- Speeds up the per-customer-limit check in pricing.ts (filters on both
-- columns); the (coupon_id, order_id) unique index above already covers
-- coupon_id-only lookups (the usage_limit count) via its leading column.
create index coupon_redemptions_coupon_customer_idx on public.coupon_redemptions(coupon_id, customer_email);

comment on table public.coupon_redemptions is
  'Records that a coupon/promotion was applied to a given order. Inserted once by fulfill_order() at payment confirmation, never by client code. Admin-only RLS, no public access.';

alter table public.coupon_redemptions enable row level security;

create policy "Admins can view coupon redemptions"
  on public.coupon_redemptions for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert coupon redemptions"
  on public.coupon_redemptions for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update coupon redemptions"
  on public.coupon_redemptions for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete coupon redemptions"
  on public.coupon_redemptions for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- orders: additive columns recording which coupon/promotion (if any) applied
-- and how much it discounted. Both nullable/defaulted so existing rows and
-- the existing insert in create-order (before this phase) remain valid.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id),
  add column if not exists discount_amount numeric not null default 0;
