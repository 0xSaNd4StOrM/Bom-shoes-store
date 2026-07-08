-- Harden EXECUTE grants on SECURITY DEFINER functions.
--
-- The earlier migrations that created these functions used
-- `revoke all on function ... from public`, intending to keep them callable
-- only by the service_role (edge functions) or only as triggers. That is
-- INSUFFICIENT on Supabase: the platform's default privileges auto-grant
-- EXECUTE to the `anon` and `authenticated` roles on every new function in the
-- public schema, and `revoke ... from public` (the PUBLIC pseudo-role) does not
-- remove those role-specific grants. The Supabase security advisor
-- (lints 0028/0029) confirmed anon/authenticated could still execute them.
--
-- Concretely, the dangerous one is fulfill_order: any signed-in user could call
-- POST /rest/v1/rpc/fulfill_order with their own pending order's id and have it
-- marked paid + stock decremented WITHOUT paying Kashier -- a full payment
-- bypass. fulfill_order must only ever be invoked by the kashier-webhook edge
-- function (service_role) after a verified payment. The trigger functions
-- (log_activity, set_review_verified_purchase, prevent_self_role_change) only
-- ever need to run as triggers -- which do not check EXECUTE on the trigger
-- function -- so revoking direct EXECUTE from clients changes nothing about
-- their trigger behavior, it just closes the RPC surface.

-- fulfill_order already had `revoke ... from public` in its own migration, so
-- revoking the two specific roles fully closes it. The three trigger functions
-- never had a public revoke, so anon/authenticated also inherit EXECUTE via the
-- PUBLIC pseudo-role -- revoke from public AND the roles to fully close them.
-- (Triggers fire their functions regardless of EXECUTE grants, so this only
-- removes the /rest/v1/rpc surface; trigger behavior is unaffected.)
revoke execute on function public.fulfill_order(uuid) from anon, authenticated;
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.set_review_verified_purchase() from public, anon, authenticated;
revoke execute on function public.prevent_self_role_change() from public, anon, authenticated;

-- Pin the search_path on the full-text helper (advisor lint 0011). It's a pure
-- IMMUTABLE function used by the products.search_vector generated column;
-- pinning search_path removes the mutable-search_path warning and is good
-- hygiene. Triggers/generated columns run it regardless of EXECUTE grants, so
-- this is purely additive.
alter function public.products_search_document(text, text, text, text[])
  set search_path = public, pg_temp;
