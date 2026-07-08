# Full homepage/store CMS control

User report: several homepage sections render regardless of admin input, some list content is locked to a fixed count, and some content (announcement ticker, footer links) isn't in the CMS at all. Goal: every homepage section gets a show/hide toggle, and every list-shaped section supports add/remove, not just editing existing entries.

## Gaps closed (from a full section-by-section audit)

| Section | Fix |
|---|---|
| Hero, Showcase, Curated, Limited Drop, Trust Badges, Atelier, Newsletter | Add `enabled: boolean` to each `site_content` row; Home.tsx skips rendering when `false`. Admin gets a "Show this section" checkbox per tab. |
| Categories strip | New `categories_strip` site_content row with just `enabled`, since the strip's items already come live from the `categories` table. |
| Announcement/marquee ticker | Currently hardcoded in translations.ts. New `announcement` site_content row: `{ enabled, lines: [{en, ar}] }`. New admin tab: add/remove/reorder lines. Layout.tsx reads from it, falls back to the old hardcoded lines if the row is empty/missing. |
| Atelier `stats` | Currently locked to exactly 3 entries in both the admin form and Home.tsx's `grid-cols-3`. Unlock to a variable-length array (same add/remove pattern as Trust Badges' `items`); Home.tsx grid adapts to count. |
| Footer "Shop" column | Hardcoded 4-category list, missing 2 real categories and unaware of admin-added ones. Switch to rendering from `useCategories()` (already live-updating). |
| Footer "Atelier" column | Three dead `href="#"` links. New `footer_links` site_content row: array of `{label_en, label_ar, url}`, admin add/remove/edit. Renders nothing extra if empty (no dead links shown). |
| Newsletter signup form | Submit button has no handler at all today — found during the audit, unrelated to CMS scope but a real defect. New `newsletter_subscribers` table (email, created_at), public insert-only RLS, footer form wired to insert. Admin sees a read-only count/list under the Homepage editor's Newsletter tab (view only, no separate CRUD needed for subscribers). |

## Non-goals

- No new destination pages behind the footer Atelier links (e.g., an "Our Story" page) — the admin can point `footer_links` entries at any existing route once such pages exist; building them isn't part of "make the CMS controllable."
- Hero is toggle-able like every other section, per explicit instruction ("every single section"), even though disabling it leaves the page starting at the categories strip. Admin's call.

## Implementation order

One migration for all new/changed shape (`enabled` flags backfilled onto existing rows, new `announcement`/`categories_strip`/`footer_links` rows seeded from today's hardcoded content, new `newsletter_subscribers` table), then Home.tsx, then AdminHomepage.tsx, then Layout.tsx, each verified with a real build and committed/pushed independently so partial progress is never lost.
