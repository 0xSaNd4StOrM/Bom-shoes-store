# Staying comfortably inside the Supabase + Vercel free tiers

## Problem

BOM Store runs on the Supabase Free plan (paused after **7 days** of DB
inactivity) and Vercel Hobby (100 GB transfer/mo). The store gets little
traffic while launching, so the real, guaranteed risk is the **7-day pause** —
not resource limits (a small catalog is well under 500 MB DB / 1 GB storage /
5 GB Supabase egress / 100 GB Vercel transfer).

## Decisions

- **Keep-alive: GitHub Actions cron, 3×/week (Mon/Wed/Fri).** External to
  Supabase (a paused project can't wake itself), free, no Vercel/Supabase
  compute used. Makes one small authenticated REST query (`select` on
  `site_content`) — real Postgres activity that resets the inactivity clock.
  Also `workflow_dispatch` so it can be run manually. The query uses the
  public anon key (already shipped in the client bundle), hardcoded in the
  workflow — no repo secret to configure.
- **Admin-upload compression.** Static catalog/marketing images already live
  in Vercel `public/` (off Supabase's smaller egress). The gap is
  admin-uploaded images (product photos, store logo, brand logos) which go to
  Supabase storage as-is. Add client-side compression (canvas → resize to a
  max edge + WebP, keeping alpha for transparent logos) before upload, so
  uploads stay ~50–150 KB. Protects both the 1 GB storage cap and 5 GB egress.
  - Product photos: max edge 1200 px (shown large on the product page).
  - Store logo / brand logos: max edge 600 px (shown small).
  - **Favicon and SVG/GIF uploads are left untouched** (favicons must stay
    tiny/native; SVG is already tiny and can't round-trip through canvas).
  - If compression yields a *larger* file than the original (already-optimized
    input), keep the original — never bloat.

## Components

- `.github/workflows/supabase-keepalive.yml` — the scheduled ping.
- `src/lib/compressImage.ts` — `compressImage(file, { maxDim, quality })`,
  returns a (possibly) smaller `File`; returns the input unchanged for
  SVG/GIF or when compression doesn't help.
- Wire `compressImage` into the three raster upload sites: AdminProducts
  product-image upload, AdminSettings store-logo upload, AdminSettings brand-
  logo upload. Favicon upload stays as-is.

## Non-goals

- No JS bundle code-splitting (Vercel transfer isn't near the limit; YAGNI).
- No move of the seeded `public/` images to storage (they're correctly on
  Vercel already).
- No paid-tier features.

## Monitoring (no code)

Watch usage in the Supabase dashboard (Reports → egress/storage/DB size) and
Vercel dashboard (Usage → Fast Data Transfer). Nothing is close today.
