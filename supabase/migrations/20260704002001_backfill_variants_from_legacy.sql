-- Backfill product_variants from the legacy flat products.sizes / colors /
-- stock columns, so every existing product gets real variant rows instead
-- of falling through the product_catalog view's zero-variant fallback.
--
-- ****************************************************************************
-- IMPORTANT -- READ BEFORE TRUSTING THESE NUMBERS:
-- This backfill copies each product's CURRENT flat `stock` value VERBATIM
-- into EVERY generated variant row for that product. A product with
-- stock = 20 and 3 sizes x 2 colors = 6 variants ends up with 6 variant rows
-- that EACH say stock = 20 -- i.e. this OVERSTATES real total inventory by
-- 6x, because the old schema never tracked stock per size/color, only one
-- flat count for the whole product. Whoever migrates real production data
-- MUST go back and correct actual per-variant stock counts after running
-- this. Do not treat the numbers this produces as real inventory.
-- ****************************************************************************
--
-- Legacy sizes/colors/stock columns are NOT dropped by this migration (see
-- the previous migration's header) -- only additive changes here.
--
-- Assumption: sku format is UPPER(slug)-UPPER(size, whitespace stripped)-
-- first 3 letters of color (uppercased, non-letters stripped). Collisions
-- (e.g. two colors both starting "BLA...") are deduped by appending -2, -3,
-- etc, keeping global uniqueness (product_variants.sku is unique).
--
-- A product with an empty sizes or colors array would cross-join to zero
-- rows and get NO variant at all -- unlike the documented N-x overstatement
-- above, that's a silent drop to product_catalog's total_stock = 0 (shows
-- out-of-stock) for a product that may have had real flat `stock`. Coalesce
-- both arrays to a single '' sentinel entry first so every product gets at
-- least one variant row carrying its legacy stock.
with legacy as (
  select
    p.id as product_id,
    p.slug,
    p.stock,
    sz.size,
    col.color
  from public.products p
  cross join unnest(case when array_length(p.sizes, 1) > 0 then p.sizes else array['']::text[] end) as sz(size)
  cross join unnest(case when array_length(p.colors, 1) > 0 then p.colors else array['']::text[] end) as col(color)
),
candidates as (
  select
    product_id,
    stock,
    size,
    color,
    upper(slug) || '-' ||
      regexp_replace(upper(size), '\s+', '', 'g') || '-' ||
      left(regexp_replace(upper(color), '[^A-Z]', '', 'g'), 3) as base_sku
  from legacy
),
numbered as (
  select
    *,
    row_number() over (partition by base_sku order by product_id, size, color) as rn
  from candidates
)
insert into public.product_variants (product_id, size, color, sku, stock)
select
  product_id,
  size,
  color,
  case when rn = 1 then base_sku else base_sku || '-' || rn end as sku,
  stock
from numbered
on conflict (product_id, size, color) do nothing;
