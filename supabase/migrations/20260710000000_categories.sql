-- Admin-managed product categories, replacing the hardcoded CATEGORY_VALUES
-- constant that used to live in AdminProducts.tsx. `value` is the exact
-- string already stored on products.category (free text, no FK/CHECK
-- constraint existed) -- seeding it with today's six categories keeps every
-- existing product row valid with zero backfill.
create table public.categories (
  value text primary key,
  label_en text not null,
  label_ar text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.categories is
  'Admin-managed product categories. Public SELECT (storefront needs it as an anonymous visitor); admin-only write. products.category stores this table''s `value` as free text, not a foreign key -- consistent with how it worked before this table existed.';

alter table public.categories enable row level security;

create policy "Public can view categories"
  on public.categories for select
  using (true);

create policy "Admins can insert categories"
  on public.categories for insert
  with check (public.is_admin());

create policy "Admins can update categories"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete categories"
  on public.categories for delete
  using (public.is_admin());

insert into public.categories (value, label_en, label_ar, position) values
  ('Sneakers', 'Sneakers', 'أحذية رياضية', 0),
  ('Boots', 'Boots', 'بوط', 1),
  ('Loafers', 'Loafers', 'لوفرز', 2),
  ('Derbies', 'Derbies', 'دربي', 3),
  ('Slippers', 'Slippers', 'نعال', 4),
  ('Sandals', 'Sandals', 'صنادل', 5)
on conflict (value) do nothing;
