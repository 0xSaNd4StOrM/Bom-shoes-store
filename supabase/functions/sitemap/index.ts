// supabase/functions/sitemap/index.ts
//
// Generates sitemap.xml at request time for search-engine crawlers: the
// static routes (/, /shop) plus one <url> per product_catalog row at
// /product/:slug. No auth -- crawlers hit this directly with no Supabase
// JWT, same reasoning as kashier-webhook, so verify_jwt = false is set in
// supabase/config.toml.
//
// SITE_URL is the same env var create-order already uses for its own
// site-origin needs (see supabase/functions/.env.example) -- reused here so
// the production domain only has to be configured in one place. If it's the
// comma-separated multi-origin form, the first origin is used as the
// canonical sitemap domain.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const STATIC_PATHS = ['/', '/shop']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const siteUrl = (Deno.env.get('SITE_URL') ?? '').split(',')[0]?.trim().replace(/\/$/, '')
  if (!siteUrl) {
    return new Response('SITE_URL not configured', { status: 500 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // product_catalog has no updated_at (see its migration) -- created_at is
  // the closest thing to a lastmod it can offer.
  const { data: products, error } = await admin.from('product_catalog').select('slug, created_at')

  if (error) {
    console.error('sitemap: failed to load products', error)
    return new Response('Could not build sitemap', { status: 500 })
  }

  const urls = [
    ...STATIC_PATHS.map(path => `  <url><loc>${siteUrl}${path}</loc></url>`),
    ...(products ?? []).filter(p => p.slug).map(p => {
      const lastmod = p.created_at ? new Date(p.created_at).toISOString() : undefined
      return `  <url><loc>${siteUrl}/product/${encodeURIComponent(p.slug)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
    }),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml',
      // ponytail: the product catalog doesn't change minute-to-minute, so a
      // short cache is plenty -- avoids re-querying on every crawler hit.
      'Cache-Control': 'public, max-age=300',
    },
  })
})
