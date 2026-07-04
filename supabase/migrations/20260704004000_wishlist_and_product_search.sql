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
-- ---------------------------------------------------------------------------
alter table public.products
  add column search_vector tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      array_to_string(coalesce(tags, '{}'), ' ')
    )
  ) stored;

create index products_search_vector_idx on public.products using gin (search_vector);
