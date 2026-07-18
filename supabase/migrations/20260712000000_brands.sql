-- Admin-managed product brands, so BOM Store can operate as a multi-brand
-- retailer. Mirrors the `categories` table: `value` stored as free text on
-- products.brand (no FK), public SELECT, admin-only write. logo_url nullable
-- -- until a real licensed logo asset is uploaded, the storefront renders the
-- brand's name as a plain wordmark.
create table if not exists public.brands (
  value text primary key,
  name text not null,
  logo_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.brands is
  'Admin-managed product brands. Public SELECT (storefront needs it as an anonymous visitor); admin-only write. products.brand stores this table''s `value` as free text, not a foreign key -- same convention as products.category/categories.';

alter table public.brands enable row level security;

drop policy if exists "Public can view brands" on public.brands;
create policy "Public can view brands"
  on public.brands for select
  using (true);

drop policy if exists "Admins can insert brands" on public.brands;
create policy "Admins can insert brands"
  on public.brands for insert
  with check (public.is_admin());

drop policy if exists "Admins can update brands" on public.brands;
create policy "Admins can update brands"
  on public.brands for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete brands" on public.brands;
create policy "Admins can delete brands"
  on public.brands for delete
  using (public.is_admin());

insert into public.brands (value, name, position) values
  ('Nike', 'Nike', 0),
  ('Adidas', 'Adidas', 1),
  ('New Balance', 'New Balance', 2),
  ('Puma', 'Puma', 3),
  ('Amiri', 'Amiri', 4),
  ('Prada', 'Prada', 5),
  ('Gucci', 'Gucci', 6),
  ('Balenciaga', 'Balenciaga', 7)
on conflict (value) do nothing;

-- products.brand: nullable free text, same shape as products.category.
alter table public.products add column if not exists brand text;
