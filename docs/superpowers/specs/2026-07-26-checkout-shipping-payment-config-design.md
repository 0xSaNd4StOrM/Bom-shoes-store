# Admin-controlled payment methods, region shipping & required-phone checkout

## Problem

Three checkout gaps:

1. **Payment methods aren't admin-controlled.** Both "Pay online" and "Cash on
   delivery" are hardcoded-visible at checkout. The owner wants to toggle each
   on/off from the admin (e.g. run cash-only for a while).
2. **Shipping is a flat 15 EGP** (free over 200). The owner wants a price
   **per Egyptian governorate** (27 regions), set in the admin, shown as a
   dropdown at checkout, and charged based on the region the customer picks.
3. **Email is required, phone is optional** at checkout — backwards for an
   Egyptian COD store where the courier calls the customer. Phone must be
   **required**, email **optional**.

## Decisions

### Storage — reuse the `site_content` key/value table (no schema migration)

- `checkout_config` → `{ "online_enabled": true, "cash_enabled": true }`
- `shipping` → `{ "regions": [ { "code", "name_en", "name_ar", "price" } ] }`

Both seeded by one migration. `site_content` is public-read / admin-write
already, matching the existing whatsapp/contact/hero rows.

- **Seed all 27 governorates now, price 0.** The user asked to "start empty"
  (they set prices themselves) but an empty dropdown = a checkout no one can
  complete. Compromise: seed the 27 names with price **0** so the dropdown
  works day one; the owner edits prices in the admin. Price 0 is a valid
  "free to here" value, so nothing is broken while prices are unset.

### Shipping rule — region price always applies

No automatic free-over-threshold. The region's price is the shipping cost,
full stop. Coupons granting free shipping still zero it out (unchanged). This
removes the old `subtotal > 200 ? 0 : 15` logic from Cart, Checkout, and the
edge function.

### Server is authoritative for shipping

The client sends only the chosen **region code**. `create-order` looks up that
region's price from the `shipping` row (service role) and computes shipping
itself — never trusts a client-sent shipping amount (same principle already
used for item prices). An unknown/missing code → 400. The order stores the
resolved `shipping_amount` and the region label in the address string.

### Contact fields — phone required, email optional

- Frontend: swap the `required` flags; the region `<select>` is required.
- Edge function: validate `phone` present, drop the `email` requirement.
  `customer_email` is already nullable in the orders insert path? No — it's
  passed straight through; make it `|| null`. Coupon/receipt emails simply
  don't send when there's no email (Resend call is already best-effort).
- Keep a free-text **City/area** field for the detailed address; the region
  dropdown drives shipping, the city refines the address. Drop the Country
  field (Egypt-only store).

## Components

- `supabase/migrations/2026…_checkout_shipping_config.sql` — seed the two
  `site_content` rows (27 governorates @ price 0).
- `src/lib/checkoutConfig.ts` — small fetch helpers + the governorate seed
  list (single source of truth for names, imported by the migration-less UI
  fallback and the admin "reset to 27" action). Types for the two configs.
- `src/pages/admin/AdminSettings.tsx` — two new cards: **Payment methods**
  (two toggles) and **Shipping by region** (editable price per governorate,
  add/rename/remove, "restore 27 governorates" button).
- `src/pages/Checkout.tsx` — region `<select>` (required), phone required,
  email optional, Country field removed, shipping from selected region,
  payment-method cards filtered by `checkout_config`. If only one method is
  enabled, it's auto-selected and the picker collapses to a single card.
- `src/pages/Cart.tsx` — the mini order summary can't know the region yet, so
  it shows shipping as "calculated at checkout" instead of the old flat 15.
- `supabase/functions/create-order/index.ts` — read `regionCode`, look up
  price, compute shipping, validate phone, email optional, enforce the
  enabled-payment-method server-side (reject a disabled method).
- `src/lib/kashier.ts` — `CreateOrderRequest`: add `regionCode`, make `email`
  optional in the customer type.

## Non-goals

- No new DB table for regions (the JSON list is small and admin-edited rarely).
- No per-region delivery-time estimates, no weight-based shipping (YAGNI).
- No change to the COD stock/fulfillment logic — `place_cod_order` already
  reads the stored order; shipping is baked into `total_amount` before it runs.

## Validation

- Edge function: unknown region → 400; disabled payment method → 400; missing
  phone → 400; missing email → allowed.
- One runnable check: a self-check on the region-price lookup + shipping math
  (pure function extracted so it's testable without Supabase).
