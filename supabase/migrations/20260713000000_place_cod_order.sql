-- Cash-on-Delivery order placement. Mirrors fulfill_order's atomic two-pass
-- stock check + decrement (so a COD order can never oversell), but instead of
-- marking the order paid it just CONFIRMS it -- payment_status stays 'pending'
-- until an admin marks the cash collected on delivery. Stock is reserved now,
-- at placement, exactly like a paid order commits it.
--
-- Called only by the create-order edge function (service role) for cash
-- orders; EXECUTE is revoked from client roles below so a customer can never
-- confirm an order / decrement stock directly.
create or replace function public.place_cod_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_items jsonb;
  v_status text;
  v_payment_status text;
  v_coupon_id uuid;
  v_customer_email text;
  v_item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty integer;
  v_stock integer;
begin
  select items, status, payment_status, coupon_id, customer_email
  into v_items, v_status, v_payment_status, v_coupon_id, v_customer_email
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'place_cod_order: order % not found', p_order_id;
  end if;

  -- Idempotency: only reserve stock for a freshly-placed, still-pending order.
  -- A second call (retry) sees status <> 'pending' and no-ops.
  if v_status <> 'pending' or v_payment_status = 'paid' then
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
    select stock into v_stock from public.product_variants where id = v_variant_id for update;
    if not found then
      raise exception 'place_cod_order: variant % not found', v_variant_id;
    end if;
  end loop;

  for v_product_id in
    select distinct (i->>'product_id')::uuid
    from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) i
    where i->>'variant_id' is null
    order by 1
  loop
    select stock into v_stock from public.products where id = v_product_id for update;
    if not found then
      raise exception 'place_cod_order: product % not found', v_product_id;
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
      raise exception 'place_cod_order: insufficient stock for item % (have %, need %)',
        coalesce(v_item->>'variant_id', v_item->>'product_id'), v_stock, v_qty;
    end if;
  end loop;

  -- Pass 2: commit stock.
  for v_item in select * from jsonb_array_elements(coalesce(v_items, '[]'::jsonb))
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_item->>'variant_id' is not null then
      update public.product_variants set stock = stock - v_qty where id = (v_item->>'variant_id')::uuid;
    else
      update public.products set stock = stock - v_qty where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  -- Confirmed, awaiting cash on delivery. payment_status stays 'pending'.
  update public.orders
  set status = 'confirmed'
  where id = p_order_id;

  -- Record the coupon redemption now that the order is committed.
  if v_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_email)
    values (v_coupon_id, p_order_id, v_customer_email)
    on conflict (coupon_id, order_id) do nothing;
  end if;

  return true;
exception
  when others then
    raise warning 'place_cod_order failed for order %: %', p_order_id, sqlerrm;
    update public.orders
    set status = 'cancelled', payment_status = 'failed'
    where id = p_order_id;
    return false;
end;
$function$;

-- Service-role only -- clients must never call this directly.
revoke execute on function public.place_cod_order(uuid) from anon, authenticated, public;
