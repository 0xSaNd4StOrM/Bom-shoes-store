-- Closes every "admin can't fully control this section" gap found in a full
-- homepage audit: every site_content section gets an `enabled` flag Home.tsx
-- can check before rendering, the announcement ticker and footer links move
-- out of hardcoded translations.ts into editable content, and Atelier's
-- `stats` unlocks from a fixed 3-item shape to an admin-editable list.

-- Backfill `enabled: true` onto every existing text-only section so today's
-- rows keep rendering unchanged once Home.tsx starts checking the flag.
update public.site_content
set value = value || '{"enabled": true}'::jsonb
where key in ('hero', 'showcase', 'curated', 'limited_drop', 'trust_badges', 'atelier', 'newsletter');

-- Categories strip has no site_content row today (it's auto-derived from
-- product categories) -- give it one just for the on/off switch.
insert into public.site_content (key, value) values
  ('categories_strip', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;

-- Announcement/marquee ticker: today hardcoded as marqueeLine1-6 in
-- translations.ts with zero admin control. `lines` is an ordered array so
-- the admin can add/remove/reorder without a schema change.
insert into public.site_content (key, value) values
  ('announcement', '{
    "enabled": true,
    "lines": [
      {"en": "Handcrafted in Cairo", "ar": "يصنع باليد في القاهرة"},
      {"en": "Free shipping over EGP 2000", "ar": "شحن مجاني فوق 2000 جنيه"},
      {"en": "Resoled for life", "ar": "تجديد النعل مدى الحياة"},
      {"en": "30 day quiet returns", "ar": "إرجاع هادئ خلال 30 يوم"},
      {"en": "Goodyear welted", "ar": "مخيط بطريقة Goodyear"},
      {"en": "Italian calfskin", "ar": "جلد عجل إيطالي"}
    ]
  }'::jsonb)
on conflict (key) do nothing;

-- Footer "Atelier/Craft" column: today three dead href="#" links in
-- Layout.tsx. Seeded empty -- an empty list means the footer simply omits
-- this column's extra links rather than showing dead ones, until the admin
-- adds real destinations.
insert into public.site_content (key, value) values
  ('footer_links', '{"items": []}'::jsonb)
on conflict (key) do nothing;

-- Atelier stats: unlock from the hardcoded 3-entry shape (enforced by both
-- the admin form and Home.tsx's grid-cols-3) to a variable-length list, same
-- add/remove pattern as trust_badges.items. Today's 3 stats are already
-- shaped as {value, label_en, label_ar} so no data migration is needed here,
-- just the enabled flag added above and the app-layer count limit removed.

-- Newsletter footer signup: the submit button has never had a handler wired
-- up (a pre-existing, unrelated-to-CMS defect found during this audit).
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.newsletter_subscribers is
  'Footer newsletter signups. Public INSERT only (anyone can subscribe themselves); admin-only SELECT/DELETE.';

alter table public.newsletter_subscribers enable row level security;

create policy "Anyone can subscribe"
  on public.newsletter_subscribers for insert
  with check (true);

create policy "Admins can view subscribers"
  on public.newsletter_subscribers for select
  using (public.is_admin());

create policy "Admins can delete subscribers"
  on public.newsletter_subscribers for delete
  using (public.is_admin());
