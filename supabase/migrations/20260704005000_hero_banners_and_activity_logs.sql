-- Phase: homepage hero banners + an admin-visible, tamper-proof activity log.

-- ---------------------------------------------------------------------------
-- hero_banners: rotating promotional banners on the storefront homepage.
-- Public (including anonymous visitors) may only SELECT active=true banners;
-- everything else -- insert/update/delete, and seeing inactive/draft banners
-- at all -- is admin-only, same exists(...) pattern as every other
-- admin-write table in this codebase.
-- ---------------------------------------------------------------------------
create table public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  cta_text text,
  cta_link text,
  image_url text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.hero_banners is
  'Rotating homepage hero banners. Public SELECT is restricted to active=true (storefront-safe for anon visitors); insert/update/delete is admin-only.';

alter table public.hero_banners enable row level security;

create policy "Public can view active hero banners"
  on public.hero_banners for select
  using (active = true);

-- Multiple permissive SELECT policies are OR'd together, so this doesn't
-- narrow the public policy above -- it additionally lets admins (and only
-- admins) see inactive/draft rows too. Without it, the admin screen's own
-- select('*') is filtered by the active=true policy just like the public
-- storefront, so deactivating a banner makes it disappear from the admin
-- table with no way left to reactivate it.
create policy "Admins can view all hero banners"
  on public.hero_banners for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert hero banners"
  on public.hero_banners for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update hero banners"
  on public.hero_banners for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can delete hero banners"
  on public.hero_banners for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- activity_logs: append-only audit trail for products/orders/coupons writes.
--
-- No INSERT/UPDATE/DELETE policy exists for ANY role, on purpose. Rows are
-- only ever written by log_activity() below, a SECURITY DEFINER trigger
-- function that -- like fulfill_order() writing coupon_redemptions despite
-- its admin-only RLS -- bypasses RLS as the table-owning role, not via any
-- policy. That means not even an admin's own client session can insert,
-- edit, or delete a log row directly; the trigger is the only write path.
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  actor_id uuid references auth.users(id),
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is
  'Audit trail of products/orders/coupons writes, populated only by the log_activity() trigger. Admin-only SELECT; deliberately NO insert/update/delete policy for any role -- clients (including admins) cannot write or tamper with entries directly.';

create index activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

alter table public.activity_logs enable row level security;

create policy "Admins can view activity logs"
  on public.activity_logs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- log_activity(): one generic AFTER INSERT/UPDATE/DELETE trigger, attached
-- below to products, orders, and coupons. SECURITY DEFINER so it can insert
-- into activity_logs despite that table having no write policy for any role
-- (same table-ownership RLS bypass fulfill_order() already relies on).
--
-- entity_type is tg_table_name (so one function serves all three tables
-- without a branch per table) and entity_id is NEW/OLD.id -- safe generic
-- field access here because products/orders/coupons all have a uuid `id`
-- primary key.
--
-- details:
--   INSERT -> {"new": <full row as jsonb>}
--   DELETE -> {"old": <full row as jsonb>}
--   UPDATE -> only the columns that actually changed:
--             {"<col>": {"before": <old value>, "after": <new value>}}
--             This is far smaller than a before+after full-row dump on wide
--             tables like orders/products, and more directly useful -- an
--             admin reading the log wants to know *what changed*, not the
--             whole row twice. A no-op UPDATE (nothing actually differs) is
--             skipped entirely rather than logged with an empty details.
--
-- actor_id is auth.uid(), which is null for writes made through a
-- service-role edge function (e.g. fulfill_order's own order updates) --
-- expected, not a bug: there is no client session to attribute those to.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_details jsonb;
  v_key text;
begin
  -- Every insert below is wrapped in its own exception handler: a logging
  -- failure (future activity_logs constraint, disk/quota error, a bug in the
  -- jsonb diff loop, etc) must never propagate out of this trigger, or it
  -- aborts the products/orders/coupons write it's attached to. fulfill_order()
  -- in particular already treats "any exception" as insufficient stock and
  -- reacts by marking the order failed -- a logging hiccup must not be able
  -- to do that to an already-confirmed payment. Swallow and warn instead.
  if tg_op = 'INSERT' then
    begin
      insert into public.activity_logs (action, entity_type, entity_id, actor_id, details)
      values (tg_op, tg_table_name, NEW.id, auth.uid(), jsonb_build_object('new', to_jsonb(NEW)));
    exception when others then
      raise warning 'log_activity: failed to log % on %: %', tg_op, tg_table_name, sqlerrm;
    end;
    return NEW;
  elsif tg_op = 'DELETE' then
    begin
      insert into public.activity_logs (action, entity_type, entity_id, actor_id, details)
      values (tg_op, tg_table_name, OLD.id, auth.uid(), jsonb_build_object('old', to_jsonb(OLD)));
    exception when others then
      raise warning 'log_activity: failed to log % on %: %', tg_op, tg_table_name, sqlerrm;
    end;
    return OLD;
  else -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_details := '{}'::jsonb;

    for v_key in select jsonb_object_keys(v_new) loop
      if v_old -> v_key is distinct from v_new -> v_key then
        v_details := v_details || jsonb_build_object(
          v_key, jsonb_build_object('before', v_old -> v_key, 'after', v_new -> v_key)
        );
      end if;
    end loop;

    if v_details <> '{}'::jsonb then
      begin
        insert into public.activity_logs (action, entity_type, entity_id, actor_id, details)
        values (tg_op, tg_table_name, NEW.id, auth.uid(), v_details);
      exception when others then
        raise warning 'log_activity: failed to log % on %: %', tg_op, tg_table_name, sqlerrm;
      end;
    end if;

    return NEW;
  end if;
end;
$$;

comment on function public.log_activity() is
  'Generic audit trigger for products/orders/coupons: logs INSERT/DELETE as the full row, UPDATE as {column: {before, after}} for only the columns that changed (skipped entirely for a no-op update). SECURITY DEFINER so it can write to activity_logs, which has no client-facing write policy at all.';

create trigger log_products_activity
  after insert or update or delete on public.products
  for each row execute function public.log_activity();

create trigger log_orders_activity
  after insert or update or delete on public.orders
  for each row execute function public.log_activity();

create trigger log_coupons_activity
  after insert or update or delete on public.coupons
  for each row execute function public.log_activity();
