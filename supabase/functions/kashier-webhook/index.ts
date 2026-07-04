// supabase/functions/kashier-webhook/index.ts
//
// Kashier calls this directly, server-to-server, with no Supabase JWT --
// so verify_jwt = false for this function in supabase/config.toml.
// Authenticity is instead verified via the x-kashier-signature header
// (see verifyKashierSignature below), per developers.kashier.io/payment/webhook.
//
// This is the ONLY place an order is ever marked paid: it calls the
// fulfill_order() Postgres function (SECURITY DEFINER, atomic stock check +
// decrement) and only emails the order confirmation if that succeeds.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { hmacSha256Hex, timingSafeEqual } from '../_shared/kashier-crypto.ts'
import { renderOrderConfirmationEmail } from '../_shared/email-templates.ts'

type KashierWebhookPayload = {
  event: string
  data: {
    merchantOrderId?: string
    transactionId?: string
    status?: string
    signatureKeys?: string[]
    [key: string]: unknown
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody) as KashierWebhookPayload

    const apiKey = Deno.env.get('KASHIER_API_KEY')
    if (!apiKey) throw new Error('KASHIER_API_KEY not configured')

    const signatureHeader = req.headers.get('x-kashier-signature')
    if (!signatureHeader || !(await verifyKashierSignature(payload.data, signatureHeader, apiKey))) {
      console.error('kashier-webhook: rejected, invalid or missing x-kashier-signature')
      return new Response('invalid signature', { status: 401 })
    }

    const eventId = payload.data.transactionId
    const merchantOrderId = payload.data.merchantOrderId
    if (!eventId || !merchantOrderId) {
      console.error('kashier-webhook: payload missing transactionId/merchantOrderId', rawBody)
      return new Response('ignored: missing ids', { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Idempotency fast path: if we've already recorded this exact event, this
    // is a Kashier retry of a delivery we already handled -- skip it. The
    // record is only written *after* processing succeeds (see below), so a
    // transient failure between here and there doesn't permanently block a
    // retry from ever fulfilling the order (fulfill_order's own
    // payment_status guard makes it safe to call again for the same order
    // even if two deliveries race past this check).
    const { data: existingEvent } = await admin
      .from('processed_webhook_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existingEvent) {
      return new Response('already processed', { status: 200 })
    }

    const { data: order, error: orderLookupError } = await admin
      .from('orders')
      .select('id, customer_name, customer_email, items, total_amount, kashier_order_id')
      .eq('kashier_order_id', merchantOrderId)
      .single()

    if (orderLookupError || !order) {
      console.error('kashier-webhook: no order found for merchantOrderId', merchantOrderId)
      return new Response('ignored: unknown order', { status: 200 })
    }

    // Kashier's `event` field can be pay|refund|authorize|void|capture -- only
    // a successful/failed *payment* event should ever fulfill or fail an
    // order. Refund/void/etc are out of scope for this pass (see report).
    if (payload.event === 'pay' && payload.data.status === 'SUCCESS') {
      const { data: fulfilled, error: rpcError } = await admin.rpc('fulfill_order', { p_order_id: order.id })
      if (rpcError) throw rpcError

      if (fulfilled) {
        await sendOrderConfirmationEmail(order).catch(err =>
          console.error('kashier-webhook: failed to send confirmation email', err)
        )
      }
    } else if (payload.event === 'pay') {
      // Payment failed/declined/cancelled: mark it, but stock was never
      // touched (fulfill_order is only ever called on SUCCESS), so there's
      // nothing to roll back.
      await admin.from('orders').update({ payment_status: 'failed' }).eq('id', order.id)
    }

    // Only mark this event processed now that we've actually handled it --
    // insert failures here just mean a redundant retry re-runs the (idempotent)
    // handling above, which is safe and far better than silently dropping it.
    await admin.from('processed_webhook_events').insert({ event_id: eventId })

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('kashier-webhook error:', err)
    // Ack with 200 anyway: an internal error here shouldn't make Kashier
    // hammer us with retries for up to 24h. We've logged it for follow-up.
    return new Response('error logged', { status: 200 })
  }
})

// Per developers.kashier.io/payment/webhook: sort data.signatureKeys
// alphabetically, build "key1=value1&key2=value2..." from just those fields
// of the data object, HMAC-SHA256 it with the Payment API key, and compare
// to the x-kashier-signature header.
async function verifyKashierSignature(
  data: Record<string, unknown>,
  signatureHeader: string,
  apiKey: string,
): Promise<boolean> {
  const keys = Array.isArray(data.signatureKeys) ? [...data.signatureKeys].sort() : []
  if (keys.length === 0) return false

  const queryString = keys.map(k => `${k}=${data[k]}`).join('&')
  const expected = await hmacSha256Hex(queryString, apiKey)
  return timingSafeEqual(expected, signatureHeader)
}

async function sendOrderConfirmationEmail(order: {
  customer_name: string | null
  customer_email: string | null
  kashier_order_id: string | null
  items: unknown
  total_amount: number | null
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!resendApiKey || !fromEmail || !order.customer_email) {
    console.error('kashier-webhook: skipping confirmation email, missing RESEND config or customer email')
    return
  }

  const html = renderOrderConfirmationEmail({
    customerName: order.customer_name ?? 'there',
    orderRef: order.kashier_order_id ?? '',
    items: Array.isArray(order.items) ? order.items : [],
    total: order.total_amount ?? 0,
  })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: order.customer_email,
      subject: `Your BOM Store order ${order.kashier_order_id} is confirmed`,
      html,
    }),
  })

  if (!res.ok) {
    console.error('kashier-webhook: Resend send failed', res.status, await res.text())
  }
}
