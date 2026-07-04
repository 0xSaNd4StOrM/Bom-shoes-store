// supabase/functions/create-order/index.ts
//
// Creates an order server-side: looks up REAL product + variant data (never
// trusts a price/total the client might send), recomputes the total,
// generates the order reference, inserts a 'pending' order, and returns a
// signed Kashier hosted-checkout URL.
//
// Each cart line is resolved to its product_variants row (matched by
// product_id + size + color) -- that variant's stock backs the pre-check and
// its price_override (falling back to the product's base price) is the
// authoritative price. The variant's id is stamped into the order item
// snapshot as `variant_id` so fulfill_order() can decrement the right row.
// This resolution now lives in ../_shared/pricing.ts so validate-coupon
// computes the exact same numbers.
//
// Stock is NOT touched here -- it is only ever decremented by
// fulfill_order() (see supabase/migrations), called from kashier-webhook
// once Kashier confirms the payment actually happened.
//
// verify_jwt is left at its default (true) in supabase/config.toml: the
// anon-key frontend client calls this, and the anon key itself is a valid
// JWT, so guest checkout still works.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { hmacSha256Hex } from '../_shared/kashier-crypto.ts'
import { resolveCartPricing, evaluateCouponByCode, resolveBestDiscount, type CartItemInput } from '../_shared/pricing.ts'

type OrderItemInput = CartItemInput

type CustomerInput = {
  fullName: string
  email: string
  phone?: string
  address: string
  city: string
  country: string
  notes?: string
}

const SHIPPING_FLAT = 15
const FREE_SHIPPING_THRESHOLD = 200
const TAX_RATE = 0.08
// ponytail: prices are displayed with "$" everywhere in the UI today, so the
// charged currency is fixed here rather than trusting a client-supplied
// currency. Add a real multi-currency story when the store needs one.
const CURRENCY = 'USD'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      items?: OrderItemInput[]
      customer?: CustomerInput
      couponCode?: string
    } | null

    const items = body?.items
    const customer = body?.customer
    const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim() : ''

    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: 'Cart is empty' }, 400)
    }
    if (!customer?.fullName || !customer?.email || !customer?.address || !customer?.city || !customer?.country) {
      return jsonResponse({ error: 'Missing required customer details' }, 400)
    }
    for (const item of items) {
      if (!item.product_id || !item.size || !item.color || !Number.isInteger(item.quantity) || item.quantity < 1) {
        return jsonResponse({ error: 'Invalid item in cart' }, 400)
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const pricing = await resolveCartPricing(admin, items)
    if (!pricing.ok) {
      return jsonResponse({ error: pricing.error }, 400)
    }
    const { items: orderItems, subtotal, productById } = pricing

    const shipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT
    const tax = subtotal * TAX_RATE

    // Coupon/promotion/bundle resolution -- never trust anything the client
    // says about the discount, re-run the exact same evaluation
    // validate-coupon uses (both call resolveBestDiscount in
    // ../_shared/pricing.ts, so the two can never disagree on the money-
    // critical bundle/BXGY math; see that function's doc comment for the
    // full explicit-code-vs-auto-promotion-vs-bundle precedence rule).
    const couponCtx = {
      subtotal,
      items,
      productById,
      resolvedItems: orderItems,
      customerEmail: customer.email,
      shippingCost: shipping,
    }

    // ponytail: an explicit code that fails re-validation at this point
    // (expired/limit hit/etc between the customer entering it and paying)
    // just falls back to no discount from that code rather than blocking
    // checkout entirely -- matches the "best-effort" tradeoff already
    // accepted for usage limits elsewhere in this system.
    const explicit = couponCode ? await evaluateCouponByCode(admin, couponCode, couponCtx) : null
    const resolution = await resolveBestDiscount(admin, couponCtx, explicit)

    const discountAmount = resolution.discountAmount
    const winningCouponId = resolution.couponId

    // Round to cents so the stored total_amount exactly matches the amount
    // string used in the Kashier hash/redirect below (both derive from the
    // same rounded value, avoiding float-precision drift between the two).
    const total = Math.round((subtotal + shipping + tax - discountAmount) * 100) / 100

    const orderRef = `BOM-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const userId = getUserIdFromAuthHeader(req)

    const { error: insertError } = await admin
      .from('orders')
      .insert({
        user_id: userId,
        customer_name: customer.fullName,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        shipping_address: `${customer.address}, ${customer.city}, ${customer.country}${customer.notes ? ' | ' + customer.notes : ''}`,
        total_amount: total,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'kashier',
        kashier_order_id: orderRef,
        items: orderItems,
        coupon_id: winningCouponId,
        discount_amount: discountAmount,
      })

    if (insertError) throw insertError

    const origin = resolveAllowedOrigin(req.headers.get('origin'))

    const checkoutUrl = await buildKashierCheckoutUrl({ orderRef, amount: total, origin })

    // ponytail: the frontend checkout summary needs this to show what was
    // actually applied (couponCode re-validation can differ from the Cart
    // page's live preview) -- cheap to include since discountAmount is
    // already computed above.
    return jsonResponse({ orderId: orderRef, checkoutUrl, discountAmount })
  } catch (err) {
    console.error('create-order error:', err)
    return jsonResponse({ error: 'Could not create order. Please try again.' }, 500)
  }
})

// Only ever redirect the customer's browser (post-payment, from Kashier's
// hosted checkout page) back to a known site origin. A caller hitting this
// function directly (curl, not the browser) can set an arbitrary Origin
// header; without this check that would become an open redirect on our own
// legitimate Kashier checkout link (phishing vector). SITE_URL must be set to
// the store's real origin(s) (comma-separated if there's more than one, e.g.
// a preview + production domain).
function resolveAllowedOrigin(requestOrigin: string | null): string {
  const allowed = (Deno.env.get('SITE_URL') ?? '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean)

  if (allowed.length === 0) {
    throw new Error('SITE_URL not configured; cannot build a trusted Kashier merchant redirect URL')
  }

  if (requestOrigin && allowed.includes(requestOrigin.replace(/\/$/, ''))) {
    return requestOrigin
  }

  return allowed[0]
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// The Edge Runtime already verified the caller's JWT signature before our
// code ever runs (verify_jwt defaults to true) -- so we just read its claims,
// no need to re-verify. Guest checkouts arrive with the anon key's JWT
// (role: 'anon', no real user), logged-in users with their access token
// (role: 'authenticated', sub: their user id).
function getUserIdFromAuthHeader(req: Request): string | null {
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const payloadB64 = token.split('.')[1]
    if (!payloadB64) return null
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'authenticated' && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

// Builds the signed Kashier hosted-checkout URL. Per
// developers.kashier.io/payment/payment-sessions, the hosted payment page
// takes mid/orderId/amount/currency/hash/merchantRedirect query params, and
// hash = HMAC-SHA256("/?payment=" + mid + "." + orderId + "." + amount + "." + currency, apiKey).
async function buildKashierCheckoutUrl(opts: { orderRef: string; amount: number; origin: string }): Promise<string> {
  const mid = Deno.env.get('KASHIER_MERCHANT_ID')
  const apiKey = Deno.env.get('KASHIER_API_KEY')
  if (!mid || !apiKey) throw new Error('Kashier credentials are not configured')

  // ponytail: KASHIER_MODE isn't in the task's env list -- added because
  // without it there's no way to point at Kashier's live endpoint later
  // without editing code. Defaults to test, which is all that's available
  // (this store isn't live yet).
  const mode = Deno.env.get('KASHIER_MODE') === 'live' ? 'live' : 'test'
  const baseUrl = mode === 'live' ? 'https://iframe.kashier.io/payment' : 'https://test-iframe.kashier.io/payment'

  const amountStr = opts.amount.toFixed(2)
  const path = `/?payment=${mid}.${opts.orderRef}.${amountStr}.${CURRENCY}`
  const hash = await hmacSha256Hex(path, apiKey)

  const merchantRedirect = `${opts.origin}/checkout/success?orderId=${encodeURIComponent(opts.orderRef)}`

  const params = new URLSearchParams({
    mid,
    orderId: opts.orderRef,
    amount: amountStr,
    currency: CURRENCY,
    hash,
    merchantRedirect,
    mode,
  })

  return `${baseUrl}?${params.toString()}`
}
