-- Repoints fulfill_order() at product_variants instead of products.stock,
-- now that create-order stamps a variant_id into every order item snapshot.
--
-- Every existing safety property is preserved exactly, just retargeted:
--   1. locks the order row so concurrent calls can't race each other,
--   2. locks every VARIANT row referenced by the order's item snapshot (in a
--      canonical, order-independent sequence -- sorted by variant id -- so
--      two concurrent fulfill_order calls that share variants can't deadlock)
--      and checks stock is sufficient for ALL items first,
--   3. only if every item clears the check does it decrement stock for
--      every item and mark the order paid.
-- If any item is short on stock, the whole transaction rolls back and the
-- exception handler marks the order 'failed'. This is still the ONLY place
-- stock is ever decremented, and it must only ever be invoked after payment
-- is confirmed (see kashier-webhook).
--
-- Deploy-window fallback: an order's `items` snapshot is written once, at
-- create-order time, and can sit 'pending' for a while (customer on Kashier's
-- hosted page). An order created by the PREVIOUS create-order (the one that
-- didn't stamp variant_id yet) still has to fulfill correctly if its payment
-- completes after this migration deploys -- otherwise Kashier charges the
-- customer but we mark the order 'failed' with stock never decremented. So:
-- items with a variant_id use product_variants as normal; items with no
-- variant_id fall back to the legacy flat products.stock column, keyed by
-- the item's product_id (present in every snapshot, old and new). Variants
-- are always locked before products, each group in ascending id order, so
-- this fallback can't introduce a cross-call deadlock.
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
  v_variant_id uuid;
  v_product_id uuid;
  v_qty integer;
  v_stock integer;
begin
  select items, payment_status into v_items, v_payment_status
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

  return true;
exception
  when others then
    -- The EXCEPTION clause rolls back everything done in this block (the
    -- stock decrements and locks above), but code below still runs in the
    -- live transaction -- so this update is the only effect that survives,
    -- recording the failure without any partial stock changes.
    raise warning 'fulfill_order failed for order %: %', p_order_id, sqlerrm;

    update public.orders
    set payment_status = 'failed'
    where id = p_order_id;

    return false;
end;
$$;

comment on function public.fulfill_order(uuid) is
  'Atomically checks stock and decrements it (in product_variants, keyed by each order item''s variant_id; falling back to legacy products.stock by product_id for pre-deploy order snapshots with no variant_id) for every item on an order, then marks it paid. Only ever called after Kashier confirms successful payment. Rolls back and marks the order failed if any item is out of stock or has no resolvable variant/product.';

-- Re-assert lockdown (CREATE OR REPLACE preserves existing grants, but this
-- keeps the migration self-contained/idempotent if run against a schema
-- where that isn't already true).
revoke all on function public.fulfill_order(uuid) from public;
grant execute on function public.fulfill_order(uuid) to service_role;
