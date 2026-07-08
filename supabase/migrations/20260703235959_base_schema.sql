-- Foundational schema: profiles, products, orders.
--
-- Every later migration in this repo assumes these three tables already
-- exist -- they originally did, in the demo Supabase project this app was
-- first scaffolded against, and were never captured as a tracked migration
-- here. This file reconstructs them from the app code's actual usage
-- (src/lib/supabase.ts's Product/Order/Profile types, AuthContext.tsx,
-- AdminProducts.tsx, AdminOrders.tsx, Checkout.tsx) so a brand-new project
-- can run this migration set from scratch.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, role drives all admin-gated RLS elsewhere.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admin check as a SECURITY DEFINER function. Every admin-gated RLS policy in
-- this schema (products, coupons, banners, ...) needs to know "is the current
-- user an admin?", which means reading profiles.role. If a *profiles* policy
-- answers that by selecting from profiles, evaluating that select re-applies
-- profiles' policies, which select from profiles again -> infinite recursion
-- (Postgres 42P17), and every query touching any admin policy 500s. Because
-- this function is SECURITY DEFINER it reads profiles with RLS bypassed, so the
-- lookup can't recurse. Use it in the profiles policies below (other tables can
-- keep their own `exists(select from profiles ...)` -- that only recurses when
-- it's a *profiles* policy doing the selecting).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "Users can view their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- products: flat legacy stock/sizes/colors columns, later extended by
-- 20260704002000 with images/variants/product_catalog.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric not null,
  category text,
  image_url text,
  stock int not null default 0,
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Public can view products"
  on public.products for select
  using (true);

create policy "Admins can manage products"
  on public.products for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------------
-- orders: created exclusively by the create-order edge function (service
-- role, bypasses RLS) since the Foundation security fix -- no client-side
-- insert/update policy is granted, matching that fix's intent exactly.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_email text,
  customer_phone text,
  shipping_address text,
  total_amount numeric,
  status text not null default 'pending',
  payment_status text not null default 'pending',
  payment_method text,
  kashier_order_id text,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Users can view their own orders"
  on public.orders for select
  using (user_id = auth.uid());

create policy "Admins can view all orders"
  on public.orders for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins can update orders"
  on public.orders for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
