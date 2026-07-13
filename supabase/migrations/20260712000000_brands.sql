-- Admin-managed product brands, so BOM Store can operate as a multi-brand
-- retailer (not just its own in-house designs). Mirrors the `categories`
-- table exactly: `value` is stored as free text on products.brand (no FK,
-- consistent with how products.category already works), public SELECT,
-- admin-only write. `logo_url` is nullable -- until the admin uploads a real
-- licensed logo asset for a brand, the storefront renders that brand's name
-- as a plain wordmark instead of fabricating logo artwork.
create table public.brands (
  value text primary key,
  name text not null,
  logo_url text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.brands is
  'Admin-managed product brands. Public SELECT (storefront needs it as an anonymous visitor); admin-only write. products.brand stores this table''s `value` as free text, not a foreign key -- same convention as products.category/categories.';

alter table public.brands enable row level security;

create policy "Public can view brands"
  on public.brands for select
  using (true);

create policy "Admins can insert brands"
  on public.brands for insert
  with check (public.is_admin());

create policy "Admins can update brands"
  on public.brands for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete brands"
  on public.brands for delete
  using (public.is_admin());

insert into public.brands (value, name, position) values
  ('Prada', 'Prada', 0),
  ('Nike', 'Nike', 1),
  ('Balenciaga', 'Balenciaga', 2),
  ('Adidas', 'Adidas', 3),
  ('Amiri', 'Amiri', 4),
  ('New Balance', 'New Balance', 5),
  ('Gucci', 'Gucci', 6)
on conflict (value) do nothing;

-- products.brand: nullable free text, same shape as products.category.
-- Left null on every existing demo product -- assigning real products to
-- real brands is a real catalog decision for the admin to make, not one to
-- guess at here.
alter table public.products add column if not exists brand text;
