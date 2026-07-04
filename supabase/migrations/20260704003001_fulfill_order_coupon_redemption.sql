-- Extends fulfill_order() (unchanged signature/behavior otherwise -- see
-- 20260704002002_fulfill_order_use_variants.sql for the full history of what
-- every step here preserves) to record a coupon redemption once payment is
-- confirmed and stock is successfully decremented.
--
-- ON CONFLICT (coupon_id, order_id) DO NOTHING makes this safe against a
-- Kashier webhook retry: the idempotency guard above (v_payment_status =
-- 'paid' => return false) already stops a second call from re-decrementing
-- stock, but this insert is added as its own belt-and-suspenders guard in
-- case that guard is ever reached concurrently before the first call's
-- transaction commits.
create or replace function public.fulfill_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_items jsonb;
  v_item jsonb;
  v_payment_status text;
  v_coupon_id uuid;
  v_customer_email text;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty integer;
  v_stock integer;
begin
  select items, payment_status, coupon_id, customer_email
  into v_items, v_payment_status, v_coupon_id, v_customer_email
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'fulfill_order: order % not found', p_order_id;
  end if;

  -- Idempotency guard: unchanged from before -- the order row itself is the
  -- source of truth, not the caller's transactionId ledger.
  if v_payment_status = 'paid' then
    return false;
  end if;

  -- Pass 1: verify. Lock every referenced row up front and bail before
  -- mutating anything if any single item can't be satisfied.
  for v_variant_id in
    select distinct (i->>'variant_id')::uuid
    from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) i
    where i->>'variant_id' is not null
    order by 1
  loop
    select stock into v_stock
    from public.product_variants
    where id = v_variant_id
    for update;

    if not found then
      raise exception 'fulfill_order: variant % not found', v_variant_id;
    end if;
  end loop;

  for v_product_id in
    select distinct (i->>'product_id')::uuid
    from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) i
    where i->>'variant_id' is null
    order by 1
  loop
    select stock into v_stock
    from public.products
    where id = v_product_id
    for update;

    if not found then
      raise exception 'fulfill_order: product % not found', v_product_id;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb))
  loop
    v_qty := (v_item->>'quantity')::integer;

    if v_item->>'variant_id' is not null then
      select stock into v_stock from public.product_variants where id = (v_item->>'variant_id')::uuid;
    else
      select stock into v_stock from public.products where id = (v_item->>'product_id')::uuid;
    end if;

    if v_stock < v_qty then
      raise exception 'fulfill_order: insufficient stock for item % (have %, need %)',
        coalesce(v_item->>'variant_id', v_item->>'product_id'), v_stock, v_qty;
    end if;
  end loop;

  -- Pass 2: commit. Every item passed the check above, so it's safe to
  -- decrement all of them and mark the order paid.
  for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb))
  loop
    v_qty := (v_item->>'quantity')::integer;

    if v_item->>'variant_id' is not null then
      update public.product_variants
      set stock = stock - v_qty
      where id = (v_item->>'variant_id')::uuid;
    else
      update public.products
      set stock = stock - v_qty
      where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  update public.orders
  set payment_status = 'paid',
      status = 'processing'
  where id = p_order_id;

  -- New: record the redemption now that stock is committed and the order is
  -- paid. ON CONFLICT DO NOTHING keeps a redelivered webhook from ever
  -- double-counting the same order against the coupon's usage totals.
  if v_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_email)
    values (v_coupon_id, p_order_id, v_customer_email)
    on conflict (coupon_id, order_id) do nothing;
  end if;

  return true;
exception
  when others then
    -- The EXCEPTION clause rolls back everything done in this block (the
    -- stock decrements, the redemption insert, and locks above), but code
    -- below still runs in the live transaction -- so this update is the only
    -- effect that survives, recording the failure without any partial stock
    -- changes.
    raise warning 'fulfill_order failed for order %: %', p_order_id, sqlerrm;

    update public.orders
    set payment_status = 'failed'
    where id = p_order_id;

    return false;
end;
$$;

comment on function public.fulfill_order(uuid) is
  'Atomically checks stock and decrements it (in product_variants, keyed by each order item''s variant_id; falling back to legacy products.stock by product_id for pre-deploy order snapshots with no variant_id) for every item on an order, marks it paid, and records a coupon_redemptions row if the order has a coupon_id. Only ever called after Kashier confirms successful payment. Rolls back and marks the order failed if any item is out of stock or has no resolvable variant/product.';

-- Re-assert lockdown (CREATE OR REPLACE preserves existing grants, but this
-- keeps the migration self-contained/idempotent if run against a schema
-- where that isn't already true).
revoke all on function public.fulfill_order(uuid) from public;
grant execute on function public.fulfill_order(uuid) to service_role;
