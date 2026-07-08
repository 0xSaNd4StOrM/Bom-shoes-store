-- Generic homepage/site content CMS.
--
-- Rather than a rigid column per editable field (which would mean a new
-- migration every time a homepage section grows a field), site_content stores
-- one JSON blob per named block. Shape is documented per-key below and
-- enforced at the app layer (with graceful fallback if a key/field is
-- missing), not by the database -- consistent with how hero_banners/
-- store_settings already degrade gracefully to hardcoded defaults when empty.
--
-- Keys seeded below, each holding today's actual hardcoded copy as the
-- starting value, so editing in the dashboard is a diff from what's already
-- live, not a blank slate:
--   hero          -- eyebrow/title/subtitle/CTA text+links, scroll hint
--   showcase      -- scroll-jacking section: optional product_ids override + eyebrow
--   curated       -- "Curated For You" section heading + product count
--   limited_drop  -- promo banner: eyebrow/title/subtitle/CTA/image/countdown mode
--   trust_badges  -- { items: [{icon,title_en,title_ar,desc_en,desc_ar}] }
--   atelier       -- story section: eyebrow/title/subtitle/stats/CTA
--   newsletter    -- footer newsletter heading/subtitle
--   whatsapp      -- phone + EN/AR message template
--   contact       -- email/phone/address/map link/social links, shown in footer
create table public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.site_content is
  'One JSON blob per named homepage/site content block. Public SELECT (storefront needs it as an anonymous visitor); admin-only write. Shape per key is documented in this migration''s header comment and enforced at the app layer, not the database.';

alter table public.site_content enable row level security;

create policy "Public can view site content"
  on public.site_content for select
  using (true);

create policy "Admins can insert site content"
  on public.site_content for insert
  with check (public.is_admin());

create policy "Admins can update site content"
  on public.site_content for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete site content"
  on public.site_content for delete
  using (public.is_admin());

insert into public.site_content (key, value) values
  ('hero', '{
    "eyebrow_en": "New Season", "eyebrow_ar": "الموسم الجديد",
    "title1_en": "Built to last.", "title1_ar": "صنعت لتدوم،",
    "title2_en": "Made to move.", "title2_ar": "وصممت لتتحرك.",
    "subtitle_en": "Handcrafted in small batches from naturally tanned leather. Designed to be worn, weathered, and loved.",
    "subtitle_ar": "مصنوعة بأيد قليلة من جلد مدبوغ طبيعيا. مصممة لتلبس، تتغير، و تحب.",
    "cta1_text_en": "Shop the Collection", "cta1_text_ar": "تسوق المجموعة", "cta1_link": "/shop",
    "cta2_text_en": "Explore Boots", "cta2_text_ar": "اكتشف البوط", "cta2_link": "/shop?category=Boots",
    "scroll_text_en": "Scroll", "scroll_text_ar": "شاهد"
  }'::jsonb),
  ('showcase', '{
    "product_ids": [],
    "label_en": "The Craft Series", "label_ar": "سلسلة الصنعة"
  }'::jsonb),
  ('curated', '{
    "eyebrow_en": "Our Selection", "eyebrow_ar": "مجموعتنا",
    "heading_en": "Curated For You", "heading_ar": "مختارة لك",
    "view_all_en": "View All", "view_all_ar": "عرض الكل",
    "limit": 5
  }'::jsonb),
  ('limited_drop', '{
    "eyebrow_en": "Limited Drop", "eyebrow_ar": "إصدار محدود",
    "title1_en": "A small batch,", "title1_ar": "دفعة صغيرة،",
    "title2_en": "never made twice.", "title2_ar": "لن تصنع مرتين.",
    "subtitle_en": "Once this batch sells out, it''s gone for good -- no restock, no next season.",
    "subtitle_ar": "حين تنفذ هذه الدفعة، لن تعود للمخزون، بلا موسم ثان.",
    "cta_text_en": "Discover Now", "cta_text_ar": "اكتشف الآن", "cta_link": "/shop",
    "image_url": "/stock/hero-banner-moody-sneakers-legs.jpg",
    "countdown_mode": "auto",
    "manual_target": null
  }'::jsonb),
  ('trust_badges', '{
    "eyebrow_en": "Our Promise", "eyebrow_ar": "وعدنا",
    "items": [
      {"icon": "Truck", "title_en": "Free Shipping", "title_ar": "شحن مجاني", "desc_en": "On orders over $200", "desc_ar": "للطلبات فوق 200 دولار"},
      {"icon": "ShieldCheck", "title_en": "Lifetime Quality", "title_ar": "جودة مدى الحياة", "desc_en": "Goodyear welted, built to last", "desc_ar": "مخيط بطريقة Goodyear، يدوم طويلا"},
      {"icon": "RotateCcw", "title_en": "Easy Returns", "title_ar": "إرجاع سهل", "desc_en": "30 days, no questions asked", "desc_ar": "خلال 30 يوم بلا أي أسئلة"},
      {"icon": "Lock", "title_en": "Secure Payments", "title_ar": "دفع آمن", "desc_en": "PCI-DSS compliant via Kashier", "desc_ar": "متوافق مع PCI-DSS عبر كاشير"}
    ]
  }'::jsonb),
  ('atelier', '{
    "eyebrow_en": "The Workshop", "eyebrow_ar": "الورشة",
    "title_en": "A workshop, not a factory.", "title_ar": "ورشة، لا مصنع.",
    "subtitle_en": "Sixteen pairs of hands. One pair of shoes at a time. No seasons, no noise, no shortcuts.",
    "subtitle_ar": "ستة عشر يدا. زوج واحد من الأحذية في كل مرة. بلا مواسم، بلا ضجيج، بلا اختصارات.",
    "tag_en": "The Workshop · 1986", "tag_ar": "الورشة · 1986",
    "stats": [
      {"value": "40", "label_en": "years of craft", "label_ar": "سنوات من الصنعة"},
      {"value": "16", "label_en": "pairs of hands", "label_ar": "زوج من الأيدي"},
      {"value": "3", "label_en": "days per pair", "label_ar": "أيام لكل زوج"}
    ],
    "cta_text_en": "Read Our Story", "cta_text_ar": "اقرأ قصتنا", "cta_link": "/shop",
    "image_url": null
  }'::jsonb),
  ('newsletter', '{
    "title_en": "Stay in the loop", "title_ar": "ابق على اطلاع",
    "subtitle_en": "New arrivals, restocks, and the occasional letter from the workshop.",
    "subtitle_ar": "وصولات جديدة، إعادة تخزين، ورسائل بين الحين والآخر من الورشة."
  }'::jsonb),
  ('whatsapp', '{
    "phone": "+201234567890",
    "message_en": "Hello BOM Store, I would like to ask about your shoes.",
    "message_ar": "مرحبا BOM Store، أرغب في الاستفسار عن أحذيتكم."
  }'::jsonb),
  ('contact', '{
    "email": null,
    "phone": null,
    "address_en": null,
    "address_ar": null,
    "map_url": null,
    "social_instagram": null,
    "social_facebook": null,
    "social_tiktok": null,
    "social_twitter": null
  }'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- testimonials: admin-managed repeatable list (mirrors hero_banners' pattern
-- exactly -- public SELECT restricted to active=true, admin-only write).
-- ---------------------------------------------------------------------------
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_title text,
  quote_en text not null,
  quote_ar text not null,
  rating int check (rating between 1 and 5),
  avatar_url text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.testimonials is
  'Admin-managed customer testimonials. Public SELECT restricted to active=true; admin-only write.';

alter table public.testimonials enable row level security;

create policy "Public can view active testimonials"
  on public.testimonials for select
  using (active = true);

create policy "Admins can view all testimonials"
  on public.testimonials for select
  using (public.is_admin());

create policy "Admins can insert testimonials"
  on public.testimonials for insert
  with check (public.is_admin());

create policy "Admins can update testimonials"
  on public.testimonials for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete testimonials"
  on public.testimonials for delete
  using (public.is_admin());

insert into public.testimonials (author_name, quote_en, quote_ar, avatar_url, position) values
  ('James Whitfield', 'The most comfortable pair of boots I''ve owned. Three years in and they''ve only gotten better with age.', 'أفضل زوج بوت امتلكته على الإطلاق. مضى ثلاث سنوات وهو يزداد جمالا مع الوقت.', '/shoes/cloudwalker.webp', 0),
  ('Amira Youssef', 'You can feel the difference the moment you put them on. Worth every pound.', 'تشعر بالفرق من اللحظة الأولى. تستحق كل جنيه.', '/shoes/atlas-boot.webp', 1),
  ('Marcus Chen', 'Ordered twice already. The Goodyear welt means these will genuinely last a lifetime.', 'طلبت مرتين بالفعل. الخياطة بطريقة Goodyear تعني أنها ستدوم فعلا مدى الحياة.', '/shoes/drift-runner.webp', 2)
on conflict do nothing;
