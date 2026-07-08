-- Phase: customer product reviews + rating aggregates on product_catalog.
--
-- reviews is customer-facing content (unlike coupons/activity_logs elsewhere
-- in this schema) -- public SELECT, but insert/update/delete restricted to
-- the authoring user's own row.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

comment on table public.reviews is
  'Customer product reviews, one per (product, user). Public SELECT (customer-facing content); insert/update/delete restricted to the authoring user via user_id = auth.uid().';

alter table public.reviews enable row level security;

create policy "Public can view reviews"
  on public.reviews for select
  using (true);

create policy "Users can insert their own reviews"
  on public.reviews for insert
  with check (user_id = auth.uid());

create policy "Users can update their own reviews"
  on public.reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own reviews"
  on public.reviews for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- set_review_verified_purchase(): BEFORE INSERT trigger that stamps
-- verified_purchase = true iff the reviewing user has a paid order
-- containing this exact product.
--
-- Unlike log_activity() (or any trigger on products/orders/product_variants),
-- this trigger only ever mutates NEW -- the row being inserted into reviews
-- itself -- it can't abort or corrupt any other table's write, so there's no
-- fulfill_order-style blast radius to isolate here. It's still wrapped in its
-- own exception handler for a narrower reason: a customer submitting their
-- own review should never fail because this best-effort lookup hit some
-- unexpected error -- fall back to verified_purchase = false and let the
-- insert continue rather than raise.
--
-- SECURITY DEFINER so the lookup isn't at the mercy of whatever RLS policy
-- orders has for the calling user (same rationale as fulfill_order() and
-- log_activity() elsewhere in this schema reading/writing tables the caller
-- may not have direct SELECT access to).
-- ---------------------------------------------------------------------------
create or replace function public.set_review_verified_purchase()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    select exists (
      select 1
      from public.orders o
      cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
      where o.user_id = NEW.user_id
        and o.payment_status = 'paid'
        and (item->>'product_id')::uuid = NEW.product_id
    )
    into NEW.verified_purchase;
  exception when others then
    raise warning 'set_review_verified_purchase: lookup failed for user % product %: %',
      NEW.user_id, NEW.product_id, sqlerrm;
    NEW.verified_purchase := false;
  end;

  return NEW;
end;
$$;

comment on function public.set_review_verified_purchase() is
  'Sets NEW.verified_purchase on review insert based on whether the reviewing user has a paid order containing this product. Defaults to false (never aborts the insert) if the lookup itself errors.';

create trigger set_review_verified_purchase
  before insert on public.reviews
  for each row execute function public.set_review_verified_purchase();

-- ---------------------------------------------------------------------------
-- product_catalog view: add rating aggregates. Every existing column/join from
-- 20260704002000_product_images_and_variants.sql is preserved -- only the new
-- LEFT JOIN and its two columns are added. avg_rating is left NULL (not
-- coalesced to 0) for a product with no reviews yet, so the storefront can
-- render "no ratings yet" instead of a misleading 0-star average; review_count
-- coalesces to 0 since a count has no such ambiguity.
--
-- DROP + CREATE (not CREATE OR REPLACE): between 20260704002000 (which created
-- this view) and now, 20260704004000 added a `search_vector` column to
-- products. `select p.*` therefore expands to a different column SET/ORDER than
-- the existing view has, and CREATE OR REPLACE VIEW rejects any change to the
-- leading columns' names/order. Dropping first sidesteps that entirely. No
-- other object depends on this view (RLS policies don't; edge functions query
-- it only at runtime), so a plain DROP is safe.
-- ---------------------------------------------------------------------------
drop view if exists public.product_catalog;

create view public.product_catalog
with (security_invoker = true) as
select
  p.*,
  coalesce(v.total_stock, 0) as total_stock,
  coalesce(v.available_sizes, '{}') as available_sizes,
  coalesce(v.available_colors, '{}') as available_colors,
  coalesce(v.min_price, p.price) as min_price,
  r.avg_rating,
  coalesce(r.review_count, 0) as review_count
from public.products p
left join (
  select
    pv.product_id,
    sum(pv.stock) as total_stock,
    array_agg(distinct pv.size) as available_sizes,
    array_agg(distinct pv.color) as available_colors,
    min(coalesce(pv.price_override, pr.price)) as min_price
  from public.product_variants pv
  join public.products pr on pr.id = pv.product_id
  group by pv.product_id
) v on v.product_id = p.id
left join (
  select
    product_id,
    avg(rating) as avg_rating,
    count(*)::int as review_count
  from public.reviews
  group by product_id
) r on r.product_id = p.id;
