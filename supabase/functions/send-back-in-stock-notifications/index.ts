// supabase/functions/send-back-in-stock-notifications/index.ts
//
// Invoked every 15 minutes by a pg_cron job (see
// supabase/migrations/20260704007001_stock_notify_requests_and_cron.sql)
// via net.http_post, authenticated with the project's service-role key as a
// Bearer token. That's a valid Supabase JWT, so this function keeps the
// default verify_jwt = true (no supabase/config.toml entry added for it)
// rather than layering on a separate shared-secret header -- the same
// credential that satisfies verify_jwt is also exactly what's needed below
// to build the admin client. Document this choice here since there's
// nowhere else to see it: nothing but that cron job is expected to call this
// function.
//
// For every stock_notify_requests row whose variant is back in stock and
// notified = false, atomically claims the row (flips notified = true) BEFORE
// sending -- see the in-loop comment below for why an after-send claim isn't
// safe against pg_cron firing overlapping invocations -- then sends one
// "back in stock" email via Resend (same plain fetch() pattern as
// kashier-webhook's order-confirmation email). A failed send flips the row's
// claim back to notified = false so the next cron run retries it.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type PendingRow = {
  id: string
  email: string
  product_variants: {
    size: string
    color: string
    stock: number
    products: { name: string; slug: string } | null
  } | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!resendApiKey || !fromEmail) {
    console.error('send-back-in-stock-notifications: missing RESEND config')
    return new Response('missing RESEND config', { status: 500 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // !inner turns the embed into an inner join, so .gt() on the embedded
  // column actually filters the parent (stock_notify_requests) rows too --
  // a left-joined embed's filter would only null out the embed, not drop the
  // row. This is the documented PostgREST/supabase-js way to filter on a
  // joined table's column.
  const { data: pending, error } = await admin
    .from('stock_notify_requests')
    .select('id, email, product_variants!inner(size, color, stock, products(name, slug))')
    .eq('notified', false)
    .gt('product_variants.stock', 0)

  if (error) {
    console.error('send-back-in-stock-notifications: query failed', error)
    return new Response('query failed', { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const row of (pending ?? []) as unknown as PendingRow[]) {
    const variant = row.product_variants
    if (!variant) continue // defensive only; !inner guarantees this is present

    // Claim this row BEFORE sending, not after: pg_cron's job body just fires
    // an async net.http_post and returns (see the migration header), so it
    // has no idea whether the previous invocation is still running and will
    // fire again every 15 minutes regardless. Two overlapping invocations
    // both select this same row while notified is still false; putting
    // `notified = false` in the UPDATE's WHERE clause (not just the id) means
    // whichever one commits first wins the row, and the second one's UPDATE
    // re-checks the condition post-lock, sees notified already true, and
    // updates zero rows -- so `claimed` comes back empty and it skips
    // sending. Same idempotency trick fulfill_order uses with `for update`.
    const { data: claimed, error: claimError } = await admin
      .from('stock_notify_requests')
      .update({ notified: true })
      .eq('id', row.id)
      .eq('notified', false)
      .select('id')

    if (claimError) {
      console.error('send-back-in-stock-notifications: claim failed', row.id, claimError)
      continue
    }
    if (!claimed || claimed.length === 0) {
      continue // already claimed (and presumably sent) by an overlapping run
    }

    const productName = variant.products?.name ?? 'An item on your wishlist'
    const productUrl = variant.products?.slug
      ? `https://bomstore.com/products/${variant.products.slug}`
      : 'https://bomstore.com'

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: row.email,
          subject: `${productName} is back in stock`,
          html: renderBackInStockEmail({
            productName,
            size: variant.size,
            color: variant.color,
            productUrl,
          }),
        }),
      })

      if (!res.ok) {
        console.error('send-back-in-stock-notifications: Resend send failed', res.status, await res.text())
        failed++
        // Release the claim so the next cron run retries this row.
        await admin.from('stock_notify_requests').update({ notified: false }).eq('id', row.id)
        continue
      }

      sent++
    } catch (err) {
      console.error('send-back-in-stock-notifications: error sending to', row.email, err)
      failed++
      await admin.from('stock_notify_requests').update({ notified: false }).eq('id', row.id)
    }
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// Small inline template (see file header for why this isn't in
// _shared/email-templates.ts) -- same plain inline-styled HTML style as the
// order-confirmation email.
function renderBackInStockEmail(opts: {
  productName: string
  size: string
  color: string
  productUrl: string
}): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e0;max-width:480px;width:100%;">
            <tr>
              <td style="padding:32px 32px 16px;text-align:center;letter-spacing:2px;text-transform:uppercase;font-size:13px;color:#888;">
                BOM Store
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;text-align:center;">
                <h1 style="font-size:24px;font-weight:normal;margin:0 0 8px;">Back in stock</h1>
                <p style="font-size:14px;color:#555;margin:0;">
                  ${escapeHtml(opts.productName)} (${escapeHtml(opts.color)}, ${escapeHtml(opts.size)}) is available again.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;text-align:center;">
                <a href="${escapeHtml(opts.productUrl)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:1px;text-transform:uppercase;">
                  Shop now
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
