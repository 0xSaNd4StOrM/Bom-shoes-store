-- Phase: multi-image galleries + real per-size/per-color variant stock.
--
-- Adds product_images (ordered gallery per product), product_variants (the
-- new source of truth for per-size/per-color stock and price overrides),
-- a handful of purely-additive columns on products, a product_catalog view
-- for one-round-trip storefront list pages, and a public storage bucket for
-- the gallery images themselves.
--
-- The legacy products.sizes / products.colors / products.stock columns are
-- deliberately left in place (not dropped) -- see the backfill migration's
-- comment for why.

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position int not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images(product_id);

alter table public.product_images enable row level security;

create policy "Public can view product images"
  on public.product_images for select
  using (true);

create policy "Admins can insert product images"
  on public.product_images for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update product images"
  on public.product_images for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete product images"
  on public.product_images for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  sku text unique,
  barcode text,
  stock int not null default 0 check (stock >= 0),
  price_override numeric,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create index product_variants_product_id_idx on public.product_variants(product_id);

alter table public.product_variants enable row level security;

create policy "Public can view product variants"
  on public.product_variants for select
  using (true);

create policy "Admins can insert product variants"
  on public.product_variants for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update product variants"
  on public.product_variants for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete product variants"
  on public.product_variants for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- New products columns (all additive: nullable or defaulted, nothing removed)
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists sale_price numeric,
  add column if not exists materials text,
  add column if not exists weight_grams int,
  add column if not exists tags text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- product_costs: wholesale/COGS, kept OFF the products table on purpose.
-- `products` (and product_catalog, which selects p.* from it) has a public
-- SELECT policy for the storefront, and RLS is row-level only -- it can't
-- hide one column of an otherwise-public row. Putting cost_price here
-- instead, in its own table with an admin-only SELECT policy, keeps
-- wholesale cost out of every anon-key `select('*')` the storefront makes.
-- ---------------------------------------------------------------------------
create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost_price numeric,
  updated_at timestamptz not null default now()
);

alter table public.product_costs enable row level security;

create policy "Admins can view product costs"
  on public.product_costs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert product costs"
  on public.product_costs for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update product costs"
  on public.product_costs for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete product costs"
  on public.product_costs for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- product_catalog view: everything a storefront list page needs in one
-- round trip -- all of products' columns plus stock/price/size/color info
-- aggregated from product_variants.
--
-- security_invoker so the view is subject to the *querying* role's RLS on
-- products/product_variants, not the view owner's (Postgres views otherwise
-- run with the owner's privileges by default, which would bypass RLS since
-- migrations run as a superuser-ish role).
--
-- LEFT JOIN so a product with zero variants still appears, with
-- total_stock = 0 and min_price falling back to products.price. The
-- COALESCE(variant.price_override, products.price) happens PER VARIANT ROW
-- inside the aggregation subquery (joining products back in there so each
-- row has its own product's base price to fall back to) and only THEN is
-- MIN() taken across those already-coalesced values -- so one variant with
-- a null price_override can never collapse the whole MIN() to null the way
-- MIN(COALESCE(...)) would if the coalesce were applied after aggregating.
-- ---------------------------------------------------------------------------
create or replace view public.product_catalog
with (security_invoker = true) as
select
  p.*,
  coalesce(v.total_stock, 0) as total_stock,
  coalesce(v.available_sizes, '{}') as available_sizes,
  coalesce(v.available_colors, '{}') as available_colors,
  coalesce(v.min_price, p.price) as min_price
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
) v on v.product_id = p.id;

-- ---------------------------------------------------------------------------
-- Storage bucket for product gallery images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can view product-images bucket"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Admins can upload to product-images bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update product-images bucket"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete from product-images bucket"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
