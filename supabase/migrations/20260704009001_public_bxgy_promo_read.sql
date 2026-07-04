-- Phase: let the storefront advertise auto-apply Buy-X-Get-Y promotions (see
-- src/pages/Shop.tsx's "Buy 2 Get 1 50% Off" grid badge).
--
-- `coupons` intentionally has NO general public SELECT policy (see
-- 20260704003000_coupons_schema.sql -- codes must never be listable by an
-- anonymous client). This adds a second, narrowly-scoped SELECT policy
-- (permissive policies OR together, so the existing admin-only policy is
-- unaffected) that exposes ONLY rows that are already safe to show every
-- visitor: requires_code = false (code is always null on these -- no
-- customer-typed code is ever exposed), active, and discount_type =
-- 'buy_x_get_y'. Any other coupon row (a real code, an inactive promo, a
-- non-BXGY promo) stays fully admin-only, same as before.
--
-- Precise eligibility (date range, min order amount, exact target match) is
-- still the querying code's job, not RLS -- same "active is the row filter,
-- the rest is application logic" pattern already used for bundles/
-- bundle_items in 20260704009000_bundles_bxgy_stacking.sql. The badge this
-- feeds is informational only; the real discount is always computed
-- server-side at checkout regardless.
create policy "Public can view active auto buy-x-get-y promotions"
  on public.coupons for select
  using (
    requires_code = false
    and active = true
    and discount_type = 'buy_x_get_y'
  );
