-- Phase: personal wishlists + full-text product search.

-- ---------------------------------------------------------------------------
-- wishlist_items: purely personal data, one row per (user, product) they've
-- saved. No admin/public access needed -- RLS restricts every operation to
-- the owning user, full stop.
-- ---------------------------------------------------------------------------
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

comment on table public.wishlist_items is
  'Per-user saved products. Strictly personal -- RLS allows a user to see/insert/delete only their own rows, no admin or public access.';

alter table public.wishlist_items enable row level security;

create policy "Users can view their own wishlist items"
  on public.wishlist_items for select
  using (user_id = auth.uid());

create policy "Users can insert their own wishlist items"
  on public.wishlist_items for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own wishlist items"
  on public.wishlist_items for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Full-text search on products. Generated column so it stays in sync with
-- name/description/category/tags automatically; GIN index makes @@ queries
-- fast. product_catalog already does `select p.*` from products, so it picks
-- up this column for free -- no view change needed.
--
-- Postgres requires a GENERATED column's expression to be IMMUTABLE, but the
-- `to_tsvector('english', ...)` config-name form is only STABLE (resolving the
-- 'english' text config goes through a catalog lookup). We wrap it in an
-- explicitly IMMUTABLE SQL function with the search config hard-coded: the
-- document is genuinely deterministic (fixed 'english' config, pure string
-- concatenation), so labelling it immutable is correct, and it satisfies the
-- generated-column requirement. This is the standard Supabase/Postgres pattern
-- for a generated tsvector column.
-- ---------------------------------------------------------------------------
create or replace function public.products_search_document(
  p_name text,
  p_description text,
  p_category text,
  p_tags text[]
) returns tsvector
language sql
immutable
as $$
  select to_tsvector('english',
    coalesce(p_name, '') || ' ' ||
    coalesce(p_description, '') || ' ' ||
    coalesce(p_category, '') || ' ' ||
    array_to_string(coalesce(p_tags, '{}'), ' ')
  )
$$;

alter table public.products
  add column search_vector tsvector generated always as (
    public.products_search_document(name, description, category, tags)
  ) stored;

create index products_search_vector_idx on public.products using gin (search_vector);
