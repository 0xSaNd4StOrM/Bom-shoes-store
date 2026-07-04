-- Ensure kashier_order_id is unique: the webhook looks up an order by this
-- column (Kashier's merchantOrderId echoed back to us), and create-order
-- relies on each generated reference being unique. Guard with a existence
-- check so this migration is safe to re-run / apply on top of a schema that
-- may already have added the same constraint by hand.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_kashier_order_id_key'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_kashier_order_id_key unique (kashier_order_id);
  end if;
end $$;

-- Atomically fulfills an order after Kashier confirms payment:
--   1. locks the order row so concurrent calls (e.g. a duplicate webhook
--      firing before the first insert into processed_webhook_events lands)
--      can't race each other,
--   2. locks every product row referenced by the order's item snapshot and
--      checks stock is sufficient for ALL items first,
--   3. only if every item clears the check does it decrement stock for
--      every item and mark the order paid.
-- If any item is short on stock, the function raises, the whole transaction
-- (including the row locks and any earlier decrements in this call) rolls
-- back, and the exception handler marks the order 'failed' before returning
-- false. This is the ONLY place stock is ever decremented, and it must only
-- ever be invoked after payment is confirmed (see kashier-webhook).
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

  -- Idempotency guard: the order row itself is the source of truth, not the
  -- caller's transactionId ledger. Kashier can (and does) deliver more than
  -- one SUCCESS event for the same order (authorize + capture, retries that
  -- mint a new transactionId, etc). If we already marked this order paid,
  -- do nothing -- don't decrement stock twice or trigger a second email.
  if v_payment_status = 'paid' then
    return false;
  end if;

  -- Pass 1: verify. Lock every product row up front (in a canonical,
  -- order-independent sequence -- sorted by product id -- so two concurrent
  -- fulfill_order calls that share products can't deadlock by locking them
  -- in opposite orders) and bail before mutating anything if any single item
  -- can't be satisfied.
  for v_product_id in
    select distinct (i->>'product_id')::uuid
    from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) i
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
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select stock into v_stock
    from public.products
    where id = v_product_id;

    if v_stock < v_qty then
      raise exception 'fulfill_order: insufficient stock for product % (have %, need %)',
        v_product_id, v_stock, v_qty;
    end if;
  end loop;

  -- Pass 2: commit. Every item passed the check above, so it's safe to
  -- decrement all of them and mark the order paid.
  for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb))
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    update public.products
    set stock = stock - v_qty
    where id = v_product_id;
  end loop;

  update public.orders
  set payment_status = 'paid',
      status = 'processing'
  where id = p_order_id;

  return true;
exception
  when others then
    -- The EXCEPTION clause rolls back everything done in this block
    -- (the stock decrements and locks above), but code below still runs in
    -- the live transaction -- so this update is the only effect that
    -- survives, recording the failure without any partial stock changes.
    raise warning 'fulfill_order failed for order %: %', p_order_id, sqlerrm;

    update public.orders
    set payment_status = 'failed'
    where id = p_order_id;

    return false;
end;
$$;

comment on function public.fulfill_order(uuid) is
  'Atomically checks stock and decrements it for every item on an order, then marks it paid. Only ever called after Kashier confirms successful payment. Rolls back and marks the order failed if any item is out of stock.';

-- Lock this down hard: it is SECURITY DEFINER and mutates stock + payment
-- status, so only the kashier-webhook edge function (via the service-role
-- key) may call it. Without this revoke, Postgres' default grant to PUBLIC
-- would let any anon/authenticated client call it directly over PostgREST
-- (supabase.rpc('fulfill_order', ...)) and mark arbitrary orders paid.
revoke all on function public.fulfill_order(uuid) from public;
grant execute on function public.fulfill_order(uuid) to service_role;
